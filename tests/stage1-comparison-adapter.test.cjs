const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createPredictor, evaluate } = require('../stage1-comparison-adapter.cjs');

const root = path.join(__dirname, '..');
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');

function publicState() {
  return {
    targetSlotIndex: 1,
    slots: [
      { solved: true, trailing: '', letters: [{ capital: true, visible: 'T' }, { capital: false, visible: 'h' }, { capital: false, visible: 'e' }] },
      { solved: false, trailing: '', letters: [{ capital: false, visible: '' }, { capital: false, visible: 'a' }, { capital: false, visible: '' }] },
      { solved: false, trailing: '.', letters: [{ capital: false, visible: '' }, { capital: false, visible: '' }, { capital: false, visible: '' }] },
    ],
    rejectedWordsBySlot: [[1, ['dog']]],
  };
}

async function main() {
  const predictor = await createPredictor();
  const state = publicState();
  const first = await predictor.predict(state);
  const second = await predictor.predict(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(first, second, 'Stage 1 adapter must be deterministic');
  assert(first.length > 0, 'Stage 1 adapter returned no candidates');
  assert(!first.some(entry => Object.keys(entry).some(key => ['answer', 'actualAnswer', 'isCorrect', 'correctChance'].includes(key))));

  const hiddenChanged = JSON.parse(JSON.stringify(state));
  hiddenChanged.slots[2].letters[0].visible = '';
  assert.deepEqual(first, await predictor.predict(hiddenChanged), 'Only public observations may affect prediction');
  await assert.rejects(() => predictor.predict({ ...state, actualAnswer: 'cat' }), /Unknown non-public field/);
  await assert.rejects(() => predictor.predict({ ...state, hiddenLetters: ['c', 'a', 't'] }), /Unknown non-public field/);

  const expected = {
    development: { cases: 390, top1: 67, top3: 128, top5: 162, top1Percent: 17.18 },
    heldout: { cases: 174, top1: 39, top3: 54, top5: 68, top1Percent: 22.41 },
    replay: { cases: 45, top1: 1, top3: 3, top5: 7, top1Percent: 2.22 },
  };
  for (const split of Object.keys(expected)) {
    const result = await evaluate(split);
    assert.deepEqual(result.summary, { ...expected[split], failures: result.summary.failures }, `Unexpected ${split} parity`);
    const historical = readJson(split === 'development' ? '.stage1/frequency-development.json' : split === 'heldout' ? '.stage1/final-heldout.json' : '.stage1/frequency-replay.json');
    assert.deepEqual(result.summary, historical.summary, `${split} differs from retained Stage 1 artifact`);
  }

  const manifest = readJson('.stage1/baseline-manifest.json');
  for (const [file, expectedHash] of Object.entries(manifest.files)) {
    assert.equal(hash(file), expectedHash, `Baseline dependency changed: ${file}`);
  }
  console.log('PASS Stage 1 adapter public-state isolation and deterministic repeatability');
  console.log('PASS Stage 1 adapter development, held-out, and replay parity');
  console.log(`PASS ${Object.keys(manifest.files).length} frozen baseline dependency hashes`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
