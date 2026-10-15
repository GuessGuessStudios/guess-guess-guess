const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { harness, root } = require('./ai-harness.cjs');
const { observations, installObservations } = require('./prediction-eval.cjs');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const plain = x => JSON.parse(JSON.stringify(x));
async function humanHarness() {
  const h = await harness();
  h.location = { search: '?humanPlaytestMode=1&aiMode=maximum-accuracy' };
  vm.runInContext(read('human-playtest-eligibility.js') + read('human-playtest.js'), h);
  return h;
}
(async () => {
  let checks = 0;
  const check = async (name, fn) => { await fn(); checks++; console.log('PASS', name); };
  const h = await humanHarness();
  await check('playtest-only AI delays are 20%, while normal timing remains exact', () => {
    assert.equal(h.humanPlaytestDelay(750), 150);
    assert.equal(h.humanPlaytestDelay(1500), 300);
    assert.equal(h.humanPlaytestDelay(1), 1);
    h.location.search = '';
    assert.equal(h.humanPlaytestDelay(750), 750);
    assert.equal(h.humanPlaytestDelay(1500), 1500);
    h.location.search = '?humanPlaytestMode=1';
  });
  const fixture = (text, index) => {
    installObservations(h, observations(text, index, 'surrounding'));
    h.clearAiWrongGuessMemory();
    return h.getEligibleAiSlots()[0];
  };
  const smallPool = (slot, words) => ({ predictionMode: 'human-playtest', targetSlot: slot,
    candidates: words.map(word => ({ word, zipf: 5, analysis: h.getHumanPlaytestAnalysis(word) })) });
  await check('browser eligibility core is the frozen general mechanism, without experiment imports', () => {
    const original = read('tests/experiments/evidence-eligibility-refinement-public-text-repair/eligibility.cjs');
    const core = original.slice(original.indexOf('const S='), original.indexOf('module.exports')).replace('function assessEligibility(', 'function core(');
    assert(read('human-playtest-eligibility.js').includes(core));
    assert(!read('human-playtest-eligibility.js').includes('require('));
  });
  await check('all three hard auxiliary form conflicts removed; support 1.25; uncertainty exactly neutral', () => {
    for (const [text, bad, good] of [['They will xxx.', 'ate', 'eat'], ['They did xxxxx.', 'eaten', 'dance'], ['They have xxx.', 'ate', 'had']]) {
      const slot = fixture(text, 2), pool = smallPool(slot, [bad, good]);
      const ranked = h.rankHumanPlaytestPool(pool);
      assert(ranked.suppressed.some(e => e.word === bad), text);
      assert(!ranked.band.some(e => e.word === bad));
    }
    const slot = fixture('They will xxx.', 2);
    const ranked = h.rankHumanPlaytestPool(smallPool(slot, ['eat', 'cat']));
    assert.equal(ranked.ranked.find(e => e.word === 'eat').grammarWeight, 1.25);
    assert.equal(ranked.ranked.find(e => e.word === 'cat').grammarWeight, 1);
    assert.equal(ranked.ranked.find(e => e.word === 'cat').grammarState, 'UNRESOLVED');
  });
  await check('unknown metadata, nominal uncertainty, hidden continuation and internal punctuation abstain', () => {
    let slot = fixture('A xxxx.', 1);
    assert.equal(h.rankHumanPlaytestPool(smallPool(slot, ['cats'])).ranked[0].grammarState, 'UNRESOLVED');
    slot = fixture('They will xxx.', 2);
    const pool = smallPool(slot, ['eat']);
    pool.candidates[0].analysis = { word: 'eat', roles: [], known: false };
    assert.equal(h.rankHumanPlaytestPool(pool).ranked[0].grammarState, 'UNRESOLVED');
    const state = h.getHumanPlaytestPublicState(slot);
    state.slots[2].gaps[1] = '-';
    const analyses = { candidate: h.getHumanPlaytestAnalysis('ate'), visible: state.slots.map((s,i) => i === 2 ? null : h.getHumanPlaytestAnalysis(s.letters.map(l => l.visible).join(''))) };
    assert.equal(h.GGGHumanEligibility.assessEligibility(state, 'ate', analyses).state, 'UNRESOLVED');
    installObservations(h, observations('They will eat food.', 2, 'prefix'));
    assert.equal(h.rankHumanPlaytestPool(smallPool(h.getEligibleAiSlots()[0], ['eat'])).ranked[0].grammarState, 'UNRESOLVED');
  });
  await check('selection cannot read hidden letters, target, puzzle identity, V2/V3/V5, CGA or old grammar scoring', async () => {
    const fail = name => { throw new Error('Forbidden: ' + name); };
    fixture('They will xxx.', 2);
    for (const name of ['vault2ByPuzzle','vault3ByPuzzle','vault5ByPuzzle','puzzleList','currentPuzzleText'])
      Object.defineProperty(h, name, { configurable: true, get: () => fail(name) });
    h.getCorrectGuessChance = () => fail('CGA');
    h.scoreAiCandidateForGrammar = () => fail('old grammar');
    h.inferAiTargetRoles = () => fail('old target roles');
    const slot = h.chooseAiTargetSlot();
    Object.defineProperty(slot, 'answer', { get: () => fail('answer') });
    const pool = await h.buildAiCandidatePool(slot);
    assert(!('answer' in pool.targetSlot)); assert(!('actualAnswer' in pool));
    const decision = h.chooseFinalAiCandidate(pool, 1);
    assert(decision && !('isCorrect' in decision) && !('correctChance' in decision));
    assert(!h.isAiMaximumAccuracyMode());
    const before = plain(h.getAiCandidateDistribution(pool, 1));
    h.aiLogicSettings.correctGuess.entries[0].chance = 100;
    h.aiLogicSettings.rules.noCaseMistakes = false;
    assert.deepEqual(plain(h.getAiCandidateDistribution(pool, 999)), before);
    assert.equal(h.applyAiTargetCapitalization('EAT', slot), 'eat');
    pool.candidates.forEach(c => { c.sources = [2,3,5]; c.sourcePrior = 1e20; });
    assert.deepEqual(plain(h.getAiCandidateDistribution(pool, 1)), before);
    assert.equal(h.getAiCandidateDistribution({ ...pool, predictionMode: 'normal' }, 1).length, 0);
  });
  await check('bounded reproducible randomness picks lower ranks but excludes an implausible tail', () => {
    const slot = fixture('xxx.', 0), pool = smallPool(slot, ['cat','dog','eat','zzz']);
    pool.candidates[0].zipf = 6; pool.candidates[1].zipf = 5.8; pool.candidates[2].zipf = 5.2; pool.candidates[3].zipf = 1;
    const r = h.rankHumanPlaytestPool(pool), chosen = new Set();
    for (let i=0;i<500;i++) {
      const seed = Math.imul(i, 2654435761) >>> 0;
      const a = h.GGGHumanPlaytest.choose(r, seed, 'character1', 1);
      assert.deepEqual(plain(a), plain(h.GGGHumanPlaytest.choose(r, seed, 'character1', 1)));
      assert(r.band.some(e => e.word === a.word)); chosen.add(a.word);
    }
    assert(chosen.size > 1); assert(!chosen.has('zzz'));
    assert(r.counts.allLegitimateMatches >= r.band.length);
  });
  await check('rejected guesses and new visible hints constrain even stale pools', async () => {
    const slot = fixture('xxx.', 0), pool = await h.buildAiCandidatePool(slot);
    const word = h.chooseFinalAiCandidate(pool, 1).word;
    h.recordWrongAiGuessForSlot(slot.slotIndex, word.toUpperCase());
    assert(!h.getAiCandidateDistribution(pool, 2).some(e => e.candidate.normalized === word));
    const block = slot.group.querySelectorAll()[0]; block.dataset.revealed = 'true'; block.textContent = 'c';
    assert(h.getAiCandidateDistribution(pool, 2).every(e => e.candidate.word.startsWith('c')));
  });
  await check('proper nouns use public capitalization and dictionary; no ordinary fallback for missing names', async () => {
    let slot = fixture('Meet Xxxxx.', 1), pool = await h.buildAiCandidatePool(slot);
    const ranking = h.rankHumanPlaytestPool(pool);
    assert(ranking.proper.strong); assert(ranking.band.length);
    assert(ranking.band.every(c => c.properNoun));
    assert.equal(h.rankHumanPlaytestPool(smallPool(slot, ['often'])).band.length, 0);
    slot = fixture('Xxxxx arrived.', 0);
    assert(!h.rankHumanPlaytestPool(smallPool(slot, ['often'])).proper.strong);
    slot = fixture('Meet Xxxxx.', 1);
    pool = await h.buildHumanPlaytestPool(slot, [{ word: 'Zorba', source: 'public-text' }]);
    assert(pool.candidates.some(c => c.word === 'zorba' && c.properNoun));
  });
  await check('all four recognized students use the real recognition path and reach submission without answers', async () => {
    h.HAND_RAISE_STATES = { OPEN:'open', AI_HAND_PENDING: 'pending', ANSWER_LOCKED: 'locked' };
    h.AI_CHARACTERS = ['character1','character2','character3','character4'];
    h.AI_CHARACTER_NAMES = { character1:'Misaki', character2:'Aoi', character3:'Taiga', character4:'Sho' };
    h.clearRaisedAiHand = h.cancelAiTurn = h.setTeacherMessage = h.updateHumanRaiseHandButton = () => {};
    h.gameStarted=true;h.isGameOver=false;h.gameEnded=false;h.humanHandRaised=false;
    h.raiseAiHand=character=>{h.handRaiseState='pending';h.raisedHandCharacter=character;return true;};
    for (const character of h.AI_CHARACTERS) {
      fixture('They will xxx.', 2); h.handRaiseState = 'open'; h.raisedHandCharacter = null;
      const events = []; h.emitDiagnosticEvent = (type, detail) => events.push({type, detail});
      let submitted = false;
      h.currentAttempt = h.createAttempt();
      h.renderAttemptPreview = () => {};
      h.submitGuess = () => { submitted = true; assert.equal(h.recognizedResponder, character); };
      await h.prepareHumanPlaytestOpportunity(character);
      await h.recognizeAiResponder(character); assert(submitted);
      const d = events.find(e => e.type === 'ai-decision').detail;
      assert.equal(d.character, character); assert.equal(d.predictionMode, 'human-playtest');
      for (const key of ['publicBoard','boardId','topSlotOpportunities','random','grammarState','finalCandidateSelectionBand','candidateRankBeforeRandomSelection']) assert(key in d);
      assert(!JSON.stringify(d).includes('actualAnswer'));
    }
  });
  await check('playtest logs autosave per guess and redact puzzle text and hidden answer; correctness follows submission', async () => {
    const saves = [], context = { Date, Math, JSON, console, fetch: async (url, options) => { saves.push({url, body: JSON.parse(options.body)}); return {ok:true}; } };
    context.window = context;
    vm.runInNewContext(read('gameplay-logger.js'), context);
    const log = context.GGGGameplayLogger;
    log.observe('start', { predictionMode:'human-playtest', puzzleNumber:4, puzzleText:'secret' });
    log.observe('ai-decision', { character:'character1', random:{seed:42} });
    await new Promise(r => setImmediate(r));
    assert.equal(saves.length, 1); assert(!('puzzleText' in saves[0].body.session));
    assert(!JSON.stringify(saves[0]).includes('result'));
    log.observe('guess', { responder:'character1', isAi:true, guessedWord:'cat', actualAnswer:'dog', result:'incorrect' });
    await new Promise(r => setImmediate(r));
    assert.equal(saves.length, 2); assert.equal(saves[1].url, '/api/human-playtest-logs');
    assert.equal(saves[1].body.events[1].result, 'incorrect');
    assert(!('actualAnswer' in saves[1].body.events[1]));
    log.observe('complete', { reason:'answer' });
    await new Promise(r => setImmediate(r)); assert(saves.at(-1).body.finished);
  });
  if (process.argv[2]) await check('mode OFF matches the exact pre-edit game: distributions, stochastic candidates and target slots', async () => {
    const before = await harness(path.resolve(process.argv[2])), after = await harness();
    assert(!after.isHumanPlaytestMode());
    for (let i=0;i<6;i++) {
      const a = await before.buildAiCandidatePool(before.getEligibleAiSlots()[i]);
      const b = await after.buildAiCandidatePool(after.getEligibleAiSlots()[i]);
      assert.deepEqual(plain(after.getAiCandidateDistribution(b,1)), plain(before.getAiCandidateDistribution(a,1)));
      for (let j=0;j<25;j++) {
        assert.deepEqual(plain(after.chooseFinalAiCandidate(b,1)), plain(before.chooseFinalAiCandidate(a,1)));
        assert.equal(after.chooseAiTargetSlot().slotIndex, before.chooseAiTargetSlot().slotIndex);
      }
    }
  });
  console.log(`${checks} human-playtest checks passed.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
