const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { fixture } = require('./human-playtest-fixture.cjs');
const { root } = require('./ai-harness.cjs');

async function setup() {
  const { h, board } = await fixture();
  h.location.search = '?humanPlaytestMode=1&ettinPilot=1'; h.logEttinPilot = () => {};
  const source = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
  vm.runInContext(source.slice(source.indexOf('  const ENTITY_TYPE_ORDER'), source.indexOf('  function candidateEntityTypes')), h);
  const fetch = h.fetch;
  h.fetch = async url => url === 'assets/language/proper-noun-bank.json' ? { ok: true, json: async () => ({
    format: 'ggg-proper-noun-bank-v1', revision: 1,
    categories: [{ id: 'foreign-cities', label: 'Cities' }, { id: 'first-names', label: 'Names' }],
    entries: [
      { id: 'city', display: 'West Harbor', active: true, categories: ['foreign-cities'] },
      { id: 'person', display: 'Nora', active: true, categories: ['first-names'] },
    ],
  }) } : fetch(url);
  vm.runInContext(fs.readFileSync(path.join(root, 'proper-noun-bank.js'), 'utf8'), h);
  await h.GGGProperNounBank.ready();
  return { h, board };
}

async function pool(h, board, words, index) {
  const target = board(words).find(slot => slot.slotIndex === index);
  const state = h.getHumanPlaytestPublicState(target);
  return { target, state, result: await h.buildHumanPlaytestPool(target, [], state, true) };
}

test('banked multiword components require the other public words and respect boundaries', async () => {
  const { h, board } = await setup();
  const input = await pool(h, board, ['near', { pattern: '____', capital: true }, 'Harbor'], 1);
  const candidate = input.result.candidates.find(c => c.word === 'west');
  assert(candidate);
  assert.equal(candidate.properNounBankEntryId, 'city');
  assert.equal(h.stage1CandidateBlockPolicyProblem({ ...candidate, publicBoardKey: h.GGGHumanPlaytest.boardKey(input.state) }, input.result, input.state, candidate.submissionSurface), null);
  const absent = await pool(h, board, ['near', { pattern: '____', capital: true }, 'island'], 1);
  assert(!h.GGGProperNounBank.contextualForms(4, absent.state, 1).some(c => c.word === 'west'));
  const boundary = await pool(h, board, ['near', { pattern: '____.', capital: true }, 'Harbor'], 1);
  assert(!h.GGGProperNounBank.contextualForms(4, boundary.state, 1).some(c => c.word === 'west'));
});

test('titles require a period and a visible recognized following person', async () => {
  const { h, board } = await setup();
  const input = await pool(h, board, [{ pattern: '__.', capital: true }, 'Nora', 'arrived.'], 0);
  assert(input.result.candidates.some(c => c.word === 'dr' && c.submissionSurface === 'Dr'));
  const noPeriod = await pool(h, board, [{ pattern: '__', capital: true }, 'Nora', 'arrived.'], 0);
  assert(!h.GGGProperNounBank.contextualForms(2, noPeriod.state, 0).some(c => c.title));
  const unknown = await pool(h, board, [{ pattern: '__.', capital: true }, 'Qzxv', 'arrived.'], 0);
  assert(!h.GGGProperNounBank.contextualForms(2, unknown.state, 0).some(c => c.title));
});
