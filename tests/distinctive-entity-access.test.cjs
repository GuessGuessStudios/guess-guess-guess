const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { fixture } = require('./human-playtest-fixture.cjs');
const { root } = require('./ai-harness.cjs');

test('distinctive dictionary surfaces reach the candidate pool without treating title case as authorization', async () => {
  const { h, board } = await fixture();
  h.location.search = '?humanPlaytestMode=1&ettinPilot=1';
  h.logEttinPilot = () => {};
  const source = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
  vm.runInContext(source.slice(source.indexOf('  const ENTITY_TYPE_ORDER'), source.indexOf('  function candidateEntityTypes')), h);
  vm.runInContext(fs.readFileSync(path.join(root, 'proper-noun-bank.js'), 'utf8'), h);
  await h.GGGProperNounBank.ready();
  const dictionary = h.vault4Dictionary.dictionary;
  dictionary.loadText(fs.readFileSync(path.join(root, 'assets/dictionary/en_US-size-60.txt'), 'utf8') + '\nxQzara\nXZQARA\nQzaran\n');
  assert(dictionary.getProperWordsByLength(6).includes('xQzara'));
  assert(dictionary.getProperWordsByLength(6).includes('XZQARA'));
  assert.equal(h.GGGProperNounBank.resolveProperNounAuthorization('qzaran').authorized, false);
  for (const surface of ['xQzara', 'XZQARA']) {
    const target = board(['we', 'saw', '______']).find(slot => slot.slotIndex === 2);
    const state = h.getHumanPlaytestPublicState(target);
    state.slots[2].letters.forEach((letter, i) => { letter.capital = surface[i] === surface[i].toUpperCase(); });
    const pool = await h.buildHumanPlaytestPool(target, [], state, true);
    assert(pool.hardCandidates.some(c => c.submissionSurface === surface), surface);
    assert(pool.candidates.some(c => c.submissionSurface === surface), surface);
  }
  const first = board([{ pattern: '______', capital: true }, 'saw', 'it']).find(slot => slot.slotIndex === 0);
  const state = h.getHumanPlaytestPublicState(first);
  assert.equal(h.stage1CapitalizationState(state, 0), 'sentence-initial');
  assert.equal(h.GGGHumanPlaytest.properContext(state).strong, false);
});

test('institution category supplies the broad organization type', async () => {
  const { h } = await fixture();
  const source = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
  vm.runInContext(source.slice(source.indexOf('  const ENTITY_TYPE_ORDER'), source.indexOf('  function entityTypeSentenceBounds')), h);
  assert(h.candidateEntityTypes({ properNounBankCategories: ['organizations-institutions'] }).BUSINESS.includes('bank:organizations-institutions'));
});
