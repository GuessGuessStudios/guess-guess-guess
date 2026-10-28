const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test, before } = require('node:test');
const { fixture } = require('./human-playtest-fixture.cjs');
const { root } = require('./ai-harness.cjs');

let h, e, board;
const events = [];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
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

function admission(word, lexicalRoles, proper = { capitalizationState: 'lowercase', nameQueueAllowed: false }) {
  const authorization = h.GGGProperNounBank.resolveProperNounAuthorization(word, { publicEntity: false });
  return h.stage1RoleEligibility({ word, analysis: { lexicalRoles } }, proper, authorization);
}

for (const role of ['possessiveDeterminer', 'possessivePronoun']) {
  test(`his is admitted with its ${role} role alone`, () => {
    assert(h.getHumanPlaytestAnalysis('his').lexicalRoles.includes(role));
    const result = admission('his', [role]);
    assert.equal(result.ordinaryRoleEligible, true);
    assert.equal(result.roleEligible, true);
  });
}

test('the same admission applies to other possessive words', () => {
  for (const word of ['my', 'ours']) {
    assert.equal(admission(word, h.getHumanPlaytestAnalysis(word).lexicalRoles).roleEligible, true, word);
  }
});

test('empty, unknown and proper-name-only roles do not become ordinary roles', () => {
  for (const roles of [[], ['unknownRole'], ['properNoun']]) {
    const result = admission('his', roles);
    assert.equal(result.ordinaryRoleEligible, false);
    assert.equal(result.roleEligible, false);
  }
});

test('possessive admission does not bypass name-only or capitalization restrictions', () => {
  const restricted = h.vault4Dictionary.recognizedNameOnlyWords.values().next().value;
  assert(restricted);
  assert.equal(admission(restricted, ['possessiveDeterminer']).roleEligible, false);
  assert.equal(admission('his', ['possessiveDeterminer'], {
    capitalizationState: 'meaningfully-capitalized', nameQueueAllowed: true,
  }).roleEligible, false);
});

// Public observations from Puzzle 21 session 1792227678517-apgnz2r2,
// events 482, 810 and 2087. No puzzle answer or hidden DOM letters are supplied.
const capitalBlank = { pattern: '___', capital: true };
const states = [
  { name: 'first his', target: 2, rejected: ['are'], tokens:
    [capitalBlank, '_____', '___', 'new', 'robot', '__', '_____', '___', '____.', 'He', '______', '____', '____', '____', '________.'] },
  { name: 'second his', target: 7, rejected: ['the', 'its'], tokens:
    [capitalBlank, 'asked', 'his', 'new', 'robot', 'to', 'clean', '___', 'room.', 'He', '_____d', '____', '____', '____', '________.'] },
  { name: 'late h_s', target: 7, rejected:
    ['the', 'its', 'one', 'her', 'him', 'all', 'and', 'abs', 'was', 'gas', 'has', 'bus', 'ops', 'ads', 'ins', 'cos', 'yes'], tokens:
    ['Max', 'asked', 'his', 'new', 'robot', 'to', 'clean', 'h_s', 'room.', 'He', 'should', 'have', 'been', 'more', 'specific.'] },
];

for (const observed of states) test(`${observed.name} reaches the production ETTIN input boundary`, async () => {
  const target = board(observed.tokens).find(slot => slot.slotIndex === observed.target);
  h.wrongAiGuessesBySlot.set(String(observed.target), new Set(observed.rejected));
  const state = h.getHumanPlaytestPublicState(target);
  const pool = await h.buildHumanPlaytestPool(target, [], state, true);
  const candidate = pool.universe.find(c => c.word === 'his');
  assert(candidate, 'his exists in the ordinary vocabulary');
  assert(e.matchesToken('his', state.slots[observed.target]), 'public letters match');
  assert.equal(candidate.roleEligible, true);
  assert(pool.hardCandidates.some(c => c.word === 'his'), 'his survives hard compatibility');
  assert(pool.candidates.some(c => c.word === 'his'), 'his reaches the unmodified shortlist');

  events.length = 0;
  let input;
  // Observe the real production caller's arguments, then stop before inference.
  // Do not replace preparation, inject candidates, assign scores or select a result.
  h.GGGEttinProvider.scoreCandidates = async (snapshot, candidates) => {
    input = { snapshot, candidates };
    throw Object.assign(new Error('Access observation complete'), { code: 'ACCESS_OBSERVED' });
  };
  const result = await h.buildEttinPilotPool(target);
  assert.equal(result.reason, 'ACCESS_OBSERVED');
  assert(input.candidates.some(c => c.word === 'his'));
  assert.equal(h.GGGEttinProvider.validateCandidate(input.snapshot, 'his').ok, true);
  assert(events.some(event => event.type === 'ettin-input' && event.ettinCandidates.includes('his')));
  assert(!events.some(event => ['ettin-scored', 'ettin-stage3-ranked', 'candidate-selected'].includes(event.type)));
});
