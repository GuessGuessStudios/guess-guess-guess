// Offline Stage 1 comparison adapter.
// This module loads only the frozen dependency snapshot under .stage1/baseline.
// It never receives or returns a target answer, correctness label, or answer source.
const assert = require('node:assert/strict');
const path = require('node:path');
const baseline = require('./.stage1/baseline/tests/prediction-eval.cjs');

const FORBIDDEN_KEYS = new Set([
  'answer', 'actualAnswer', 'targetAnswer', 'hiddenAnswer', 'correct', 'isCorrect',
  'correctChance', 'correctGuessAssistance', 'target', 'vault2', 'vault3', 'vault5',
  'answerVault', 'assistance', 'label', 'score', 'outcome',
]);

function assertPublicValue(value, location = 'state') {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) return value.forEach((entry, index) => assertPublicValue(entry, `${location}[${index}]`));
  for (const [key, child] of Object.entries(value)) {
    assert(!FORBIDDEN_KEYS.has(key), `Forbidden non-public field: ${location}.${key}`);
    assertPublicValue(child, `${location}.${key}`);
  }
}

function assertKeys(value, allowed, location) {
  for (const key of Object.keys(value)) assert(allowed.has(key), `Unknown non-public field: ${location}.${key}`);
}

function normalizeRejected(value) {
  if (value === undefined) return [];
  assert(Array.isArray(value), 'rejectedWordsBySlot must be an array');
  return value.map((entry, index) => {
    assert(Array.isArray(entry) && entry.length === 2, `Invalid rejectedWordsBySlot entry ${index}`);
    assert(Number.isInteger(entry[0]) && entry[0] >= 0, `Invalid rejected slot ${index}`);
    assert(Array.isArray(entry[1]) && entry[1].every(word => typeof word === 'string'), `Invalid rejected words ${index}`);
    return [entry[0], entry[1].slice()];
  });
}

function toObservation(state) {
  assert(state && typeof state === 'object' && !Array.isArray(state), 'Public state must be an object');
  assertPublicValue(state);
  assert(Array.isArray(state.slots) && state.slots.length > 0, 'Public state must contain slots');
  assert(Number.isInteger(state.targetSlotIndex) && state.targetSlotIndex >= 0 && state.targetSlotIndex < state.slots.length, 'Invalid targetSlotIndex');
  const observation = state.slots.map((slot, index) => {
    assert(slot && typeof slot === 'object' && !Array.isArray(slot), `Invalid slot ${index}`);
    assertKeys(slot, new Set(['solved', 'trailing', 'letters']), `slots[${index}]`);
    assert(Array.isArray(slot.letters) && slot.letters.length > 0, `Slot ${index} must contain letters`);
    const solved = Boolean(slot.solved);
    const trailing = slot.trailing === undefined ? '' : String(slot.trailing);
    return {
      solved,
      trailing,
      letters: slot.letters.map((letter, letterIndex) => {
        assert(letter && typeof letter === 'object' && !Array.isArray(letter), `Invalid letter ${index}:${letterIndex}`);
        assertKeys(letter, new Set(['capital', 'visible']), `slots[${index}].letters[${letterIndex}]`);
        return { capital: Boolean(letter.capital), visible: letter.visible === undefined ? '' : String(letter.visible) };
      }),
    };
  });
  return { observation, targetIndex: state.targetSlotIndex };
}

async function createPredictor() {
  const engine = await baseline.prepare();
  return Object.freeze({
    async predict(publicState) {
      assertKeys(publicState, new Set(['targetSlotIndex', 'slots', 'rejectedWordsBySlot']), 'state');
      const { observation, targetIndex } = toObservation(publicState);
      const rejected = normalizeRejected(publicState.rejectedWordsBySlot);
      // `baseline.predict` receives only the public observation and rejected
      // words. Evaluation labels are applied by its caller after this returns.
      return baseline.predict(engine, observation, targetIndex, rejected);
    },
  });
}

async function evaluate(split) {
  assert(['development', 'heldout', 'replay'].includes(split), 'Invalid split');
  const engine = await baseline.prepare();
  const manifest = JSON.parse(require('node:fs').readFileSync(path.join(__dirname, '.stage1/baseline/.stage1/inspection.json'), 'utf8'));
  const read = file => require('node:fs').readFileSync(path.join(__dirname, '.stage1/baseline', file), 'utf8');
  const rows = [];
  if (split === 'replay') {
    const log = JSON.parse(read(manifest.verifiedLog));
    const rejected = new Map();
    for (const event of log.events.filter(entry => entry.type === 'guess')) {
      if (event.isAi) {
        const obs = baseline.observations(log.session.puzzleText, event.targetSlot, 'blank');
        event.neighboringWordsBefore.forEach((word, index) => {
          if (word) {
            obs[index].solved = true;
            obs[index].letters.forEach((letter, letterIndex) => { letter.visible = [...word].filter(char => /[A-Za-z]/.test(char))[letterIndex]; });
          }
        });
        obs[event.targetSlot].letters.forEach((letter, index) => { letter.visible = event.revealedLettersBefore[index] || ''; });
        const ranked = await baseline.predict(engine, obs, event.targetSlot, Array.from(rejected));
        rows.push(baseline.scored(event.actualAnswer, ranked));
      }
      if (event.isAi && event.result === 'incorrect') {
        const words = rejected.get(event.targetSlot) || [];
        words.push(event.guessedWord.toLowerCase());
        rejected.set(event.targetSlot, words);
      }
    }
  } else {
    const numbers = split === 'heldout' ? manifest.heldOutPuzzles : manifest.developmentPuzzles;
    for (const number of numbers) {
      const puzzle = JSON.parse(read(`puzzles/puzzle-${String(number).padStart(3, '0')}.json`));
      const tokens = puzzle.text.trim().split(/\s+/);
      for (let index = 0; index < tokens.length; index++) {
        for (const visibility of ['blank', 'prefix', 'surrounding']) for (const firstLetter of [false, true]) {
          const ranked = await baseline.predict(engine, baseline.observations(puzzle.text.trim(), index, visibility, firstLetter), index);
          const label = tokens[index].replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '');
          rows.push(baseline.scored(label, ranked));
        }
      }
    }
  }
  return {
    split,
    summary: {
      cases: rows.length,
      top1: rows.filter(row => row.rank === 1).length,
      top3: rows.filter(row => row.rank && row.rank <= 3).length,
      top5: rows.filter(row => row.rank && row.rank <= 5).length,
      top1Percent: Number((100 * rows.filter(row => row.rank === 1).length / rows.length).toFixed(2)),
      failures: Object.fromEntries([...new Set(rows.map(row => row.failure).filter(Boolean))].map(key => [key, rows.filter(row => row.failure === key).length])),
    },
  };
}

module.exports = {
  BASELINE_ROOT: path.join(__dirname, '.stage1/baseline'),
  createPredictor,
  evaluate,
  toObservation,
};
