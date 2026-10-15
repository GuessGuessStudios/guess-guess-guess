// Offline labels never enter the predictor. No packages or network access.
// node tests/prediction-eval.cjs --split=development [--source=.stage1/before-game.js] [--out=...]
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { harness, root } = require('./ai-harness.cjs');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const normalize = word => word.toLowerCase().replace(/[’']/g, '');

// Fixture construction is the observation boundary: only these public fields
// cross into the predictor's VM. Capital markers and punctuation are displayed.
function observations(text, targetIndex, visibility, firstLetter = false) {
  return text.split(/\s+/).map((token, index) => {
    const letters = [...token].filter(c => /[A-Za-z]/.test(c));
    const solved = index !== targetIndex && (visibility === 'surrounding' || (visibility === 'prefix' && index < targetIndex));
    return { solved, trailing: token.match(/[^A-Za-z’']+$/)?.[0] || '',
      letters: letters.map((c, i) => ({ capital: /[A-Z]/.test(c), visible: solved || (index === targetIndex && firstLetter && i === 0) ? c : '' })) };
  });
}

function installObservations(h, observation) {
  h.groups = observation.map(slot => {
    const classes = new Set(slot.solved ? ['revealed'] : []);
    const blocks = slot.letters.map(letter => {
      const dataset = { revealed: String(Boolean(letter.visible)) };
      Object.defineProperty(dataset, 'letter', { get() { throw new Error('Hidden DOM letter read'); } });
      return { dataset, textContent: letter.visible,
        classList: { contains: name => name === 'capital-letter' && letter.capital } };
    });
    if (blocks.length) blocks.at(-1).dataset.trailing = slot.trailing;
    return { dataset: {}, classList: { contains: name => classes.has(name), add: name => classes.add(name), remove: name => classes.delete(name) },
      querySelectorAll: () => blocks };
  });
  h.getActualWord = () => { throw new Error('Answer lookup during prediction'); };
}

async function prepare(source) {
  const h = await harness(source);
  const legacy = typeof h.isAiMaximumAccuracyMode !== 'function';
  h.location = { search: '?aiMode=maximum-accuracy' };
  if (legacy) {
    // Fair counterfactual of the old grammar/prior model, NOT old assisted play.
    // Remove answer-derived sources; no answer is supplied to its old API.
    h.vault3ByPuzzle = {};
    h.vault5ByPuzzle = {};
    h.getCorrectGuessChance = () => 0;
  }
  return { h, legacy };
}

async function predict(engine, observation, targetIndex, rejected = []) {
  const { h, legacy } = engine;
  installObservations(h, observation);
  h.wrongAiGuessesBySlot = new Map(rejected.map(([index, words]) => [String(index), new Set(words)]));
  // Puzzle identity and labels are deliberately absent from the observation.
  h.puzzleList = []; h.currentPuzzleIndex = 0;
  const target = { group: h.groups[targetIndex], slotIndex: targetIndex, length: observation[targetIndex].letters.length };
  if (!legacy) Object.defineProperty(target, 'answer', { get() { throw new Error('Hidden target read'); } });
  const pool = await h.buildAiCandidatePool(target);
  const distribution = h.getAiCandidateDistribution(pool, 1);
  const ranked = Array.from(distribution).sort((a, b) => b.probability - a.probability ||
    (a.candidate.normalized < b.candidate.normalized ? -1 : a.candidate.normalized > b.candidate.normalized ? 1 : 0));
  assert(ranked.every(e => !e.candidate.sources.some(s => [2, 3, 5].includes(s))), 'answer-conditioned source');
  return ranked.map(e => ({ word: e.candidate.word, probability: e.probability,
    grammar: e.grammarWeight, prior: e.candidate.sourcePrior,
    roles: Array.from(h.classifyAiCandidateWord(e.candidate)) }));
}

function scored(label, ranked) {
  // This is called only AFTER predict() has returned.
  const rank = ranked.findIndex(e => normalize(e.word) === normalize(label));
  const answer = ranked[rank];
  return { rank: rank < 0 ? null : rank + 1, candidateCount: ranked.length,
    failure: rank === 0 ? null : !/^[A-Za-z]+$/.test(label) ? 'unsupported-spelling' : rank < 0 ? 'candidate-coverage' :
      !answer.roles.length ? 'lexical-coverage' : 'ranking-or-insufficient-context',
    answerAnalysis: answer || null, top5: ranked.slice(0, 5) };
}

function summarize(rows) {
  return { cases: rows.length, top1: rows.filter(r => r.rank === 1).length,
    top3: rows.filter(r => r.rank && r.rank <= 3).length, top5: rows.filter(r => r.rank && r.rank <= 5).length,
    top1Percent: Number((100 * rows.filter(r => r.rank === 1).length / (rows.length || 1)).toFixed(2)),
    failures: Object.fromEntries([...new Set(rows.map(r => r.failure).filter(Boolean))].map(k => [k, rows.filter(r => r.failure === k).length])) };
}

async function evaluate({ split = 'development', source = path.join(root, 'game.js'), ablation } = {}) {
  assert(['development', 'heldout', 'replay'].includes(split));
  const manifest = JSON.parse(read('.stage1/inspection.json'));
  const engine = await prepare(source);
  if (ablation) {
    assert.equal(ablation, 'legacy-prior');
    const build = engine.h.buildAiCandidatePool;
    engine.h.buildAiCandidatePool = async target => {
      const pool = await build(target);
      pool.candidates.forEach(c => { if (c.priorEvidence) c.sourcePrior = c.priorEvidence.raw; });
      return pool;
    };
  }
  const rows = [];
  const inputHashes = {};
  if (split === 'replay') {
    const contents = read(manifest.verifiedLog), log = JSON.parse(contents);
    inputHashes[manifest.verifiedLog] = hash(contents);
    assert.equal(log.runtime.gameJsHash, manifest.originalHashes['game.js']);
    assert.equal(log.runtime.serverRevisionAtLoad, manifest.originalHashes['server.js']);
    assert.equal(log.runtime.root, root);
    assert(log.finished && log.events.some(e => e.type === 'complete'));
    const rejected = new Map();
    for (const event of log.events.filter(e => e.type === 'guess')) {
      if (event.isAi) {
        const obs = observations(log.session.puzzleText, event.targetSlot, 'blank');
        event.neighboringWordsBefore.forEach((word, i) => {
          if (word) { obs[i].solved = true; obs[i].letters.forEach((letter, j) => { letter.visible = [...word].filter(c => /[A-Za-z]/.test(c))[j]; }); }
        });
        obs[event.targetSlot].letters.forEach((letter, i) => { letter.visible = event.revealedLettersBefore[i] || ''; });
        const ranked = await predict(engine, obs, event.targetSlot, Array.from(rejected));
        rows.push({ puzzle: log.session.puzzleNumber, event: event.event, scenario: 'recorded', label: event.actualAnswer, ...scored(event.actualAnswer, ranked) });
      }
      // Previous publicly rejected AI words, never the current outcome.
      if (event.isAi && event.result === 'incorrect') {
        const words = rejected.get(event.targetSlot) || [];
        words.push(event.guessedWord.toLowerCase()); rejected.set(event.targetSlot, words);
      }
    }
  } else {
    const numbers = split === 'heldout' ? manifest.heldOutPuzzles : manifest.developmentPuzzles;
    for (const number of numbers) {
      const file = `puzzles/puzzle-${String(number).padStart(3, '0')}.json`;
      const contents = read(file), puzzle = JSON.parse(contents);
      assert.equal(hash(contents), manifest.originalHashes[file], 'puzzle changed since the split was fixed: ' + file);
      inputHashes[file] = hash(contents);
      const tokens = puzzle.text.trim().split(/\s+/);
      for (let index = 0; index < tokens.length; index++) {
        for (const visibility of ['blank', 'prefix', 'surrounding']) for (const firstLetter of [false, true]) {
          const ranked = await predict(engine, observations(puzzle.text.trim(), index, visibility, firstLetter), index);
          const label = tokens[index].replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '');
          rows.push({ puzzle: number, slot: index, scenario: visibility + (firstLetter ? '+first-letter' : ''), label, ...scored(label, ranked) });
        }
      }
    }
  }
  for (const file of ['vaults/vault-1.json', 'vaults/vault-4.js', 'vaults/vault-4-blocked.json', 'assets/dictionary/dictionary-manager.js', 'assets/dictionary/en_US-size-60.txt', ...(!engine.legacy ? ['assets/language/english-frequency.json'] : [])]) {
    inputHashes[file] = hash(read(file));
    if (manifest.originalHashes[file] && (file.endsWith('.json') || file.endsWith('.txt'))) assert.equal(inputHashes[file], manifest.originalHashes[file], 'candidate data changed: ' + file);
  }
  return { split, ablation, sourceHash: hash(fs.readFileSync(source)), sourcePolicy: 'Global Vaults 1/4 only; no answer insertion or CGA; deterministic argmax with alphabetic ties.',
    methodology: 'Fixed puzzle-level split; six synthetic public observation states per word, correlated within puzzles. Replay is counterfactual on recorded states, not a simulated full game.',
    inputHashes, summary: summarize(rows), byScenario: Object.fromEntries([...new Set(rows.map(r => r.scenario))].map(k => [k, summarize(rows.filter(r => r.scenario === k))])),
    byPuzzle: Object.fromEntries([...new Set(rows.map(r => r.puzzle))].map(k => [k, summarize(rows.filter(r => r.puzzle === k))])), rows };
}

if (require.main === module) {
  const args = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')));
  evaluate({ split: args.split, source: args.source && path.resolve(root, args.source), ablation: args.ablation }).then(result => {
    if (args.out) fs.writeFileSync(path.resolve(root, args.out), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ split: result.split, summary: result.summary, byScenario: result.byScenario }, null, 2));
  }).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { observations, installObservations, prepare, predict, scored, evaluate };
