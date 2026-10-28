const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test, before } = require('node:test');
const { fixture } = require('./human-playtest-fixture.cjs');
const { root } = require('./ai-harness.cjs');

const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const pos = JSON.parse(read('assets/language/human-playtest-language.json')).pos;
const events = [];
let h, e, board;
before(async () => {
  ({ h, e, board } = await fixture());
  h.location.search = '?humanPlaytestMode=1&ettinPilot=1';
  const source = read('game.js');
  vm.runInContext(source.slice(source.indexOf('  const ENTITY_TYPE_ORDER'), source.indexOf('  function candidateEntityTypes')), h);
  for (const file of ['public-board.js', 'proper-noun-bank.js']) vm.runInContext(read(file), h);
  await h.GGGProperNounBank.ready();
  const provider = read('assets/ettin/ettin-provider.js');
  vm.runInContext(provider.slice(provider.indexOf('function alphaCount('), provider.indexOf('function renderBoard(')), h);
  h.GGGEttinProvider = { validateCandidate: h.validateCandidate };
  h.performance = { now: () => 0 };
  h.logEttinPilot = (type, target, detail) => events.push({ type, ...detail });
});

test('combined Moby codes retain noun and verb evidence', () => {
  for (const [word, codes] of [['copy', 'NV'], ['echo', 'NV'], ['label', 'NVt'], ['catalog', 'Nti']]) {
    assert.equal(pos[word], codes);
    const analysis = h.getHumanPlaytestAnalysis(word);
    assert(analysis.lexicalRoles.includes('noun'), word);
    assert(analysis.lexicalRoles.includes('verb'), word);
  }
});

test('attested NV lemmas license ordinary present participles', () => {
  for (const [word, lemma] of [['copying', 'copy'], ['echoing', 'echo']]) {
    const analysis = h.getHumanPlaytestAnalysis(word);
    assert(analysis.lexicalRoles.includes('verb'), word);
    assert(analysis.lexicalRoles.includes('presentParticiple'), word);
    assert(analysis.lemmas.includes(lemma), word);
    const authorization = h.GGGProperNounBank.resolveProperNounAuthorization(word, { publicEntity: false });
    const admission = h.stage1RoleEligibility({ word, analysis },
      { capitalizationState: 'lowercase', nameQueueAllowed: false }, authorization);
    assert.equal(admission.ordinaryRoleEligible, true, word);
    assert.equal(admission.roleEligible, true, word);
  }
});

test('V participles do not acquire base-form or transitivity evidence from V alone', () => {
  assert.equal(pos.labeling, 'V');
  const labeling = h.getHumanPlaytestAnalysis('labeling');
  assert(labeling.lexicalRoles.includes('verb'));
  assert(labeling.lexicalRoles.includes('presentParticiple'));
  assert(!labeling.lexicalRoles.includes('baseVerb'));
  assert.equal(labeling.ordinaryBase, false);
  assert.equal(h.getHumanPlaytestAnalysis('copy').transitive, false);
});

test('noun-only and other nonverb codes keep their categories without becoming verbs', () => {
  for (const [word, codes, role] of [
    ['banana', 'N', 'noun'], ['kitchen', 'N', 'noun'], ['happy', 'A!', 'adjective'],
    ['quickly', 'v', 'adverb'], ['under', 'Pv', 'preposition'], ['although', 'C', 'conjunction'],
  ]) {
    assert.equal(pos[word], codes);
    const analysis = h.getHumanPlaytestAnalysis(word);
    assert(analysis.lexicalRoles.includes(role), word);
    assert(!analysis.lexicalRoles.includes('verb'), word);
    assert(!analysis.lexicalRoles.includes('baseVerb'), word);
  }
  assert(!h.getHumanPlaytestAnalysis('kitchening').lexicalRoles.includes('presentParticiple'));
});

test('Puzzle 25 public __p__ng state reaches the production ETTIN input boundary', async () => {
  // Recorded public state and slot rejections at event 2152, session
  // 1792247029951-bkkbtg3w. Hidden letters are trapped by the fixture.
  const target = board(['When', 'the', 'timer', 'rang,', 'everyone', 'thought', 'Pip',
    'was', '__p__ng', 'it', 'again,', 'and', 'the', '__o____', '______.'])
    .find(slot => slot.slotIndex === 8);
  h.wrongAiGuessesBySlot.set('8', new Set(['cookies', 'barring', 'meeting', 'current',
    'happens', 'rapping', 'capping', 'lapsing', 'topping', 'ripping', 'hopping', 'tapping', 'mapping']));
  const state = h.getHumanPlaytestPublicState(target);
  const pool = await h.buildHumanPlaytestPool(target, [], state, true);
  const candidate = pool.universe.find(c => c.word === 'copying');
  assert(candidate?.sources.includes('vault-4-public-dictionary'));
  assert(e.matchesToken('copying', state.slots[8]));
  assert.equal(candidate.roleEligible, true);
  assert(pool.hardCandidates.some(c => c.word === 'copying'));
  assert(pool.candidates.some(c => c.word === 'copying'));

  events.length = 0;
  let input;
  // Observe the real caller's candidate list, then stop before inference.
  // No injected candidates, scores, ranking, selection, or completion result.
  h.GGGEttinProvider.scoreCandidates = async (snapshot, candidates) => {
    input = { snapshot, candidates };
    throw Object.assign(new Error('Access observation complete'), { code: 'ACCESS_OBSERVED' });
  };
  const result = await h.buildEttinPilotPool(target);
  assert.equal(result.reason, 'ACCESS_OBSERVED');
  assert(input.candidates.some(c => c.word === 'copying'));
  assert.equal(h.GGGEttinProvider.validateCandidate(input.snapshot, 'copying').ok, true);
  assert(events.some(event => event.type === 'ettin-input' && event.ettinCandidates.includes('copying')));
  assert(!events.some(event => ['ettin-scored', 'ettin-stage3-ranked', 'candidate-selected'].includes(event.type)));
});
