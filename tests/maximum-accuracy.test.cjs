const assert = require('node:assert/strict');
const { harness, group } = require('./ai-harness.cjs');
const { observations, installObservations, prepare, predict, scored } = require('./prediction-eval.cjs');

(async () => {
  const engine = await prepare();
  const h = engine.h;
  let checks = 0;
  const check = async (name, fn) => { await fn(); checks++; console.log('PASS', name); };
  const forbidden = name => { throw new Error('Forbidden access: ' + name); };
  h.Math.random = () => forbidden('random');
  h.getCorrectGuessChance = () => forbidden('CGA');
  for (const name of ['vault2ByPuzzle', 'vault3ByPuzzle', 'vault5ByPuzzle']) {
    Object.defineProperty(h, name, { get: () => forbidden(name), configurable: true });
  }

  await check('full ranking is deterministic and never reads hidden letters, target, CGA or puzzle vaults', async () => {
    const obs = observations('The cat sat on the mat.', 2, 'surrounding', true);
    const a = await predict(engine, obs, 2);
    const b = await predict(engine, obs, 2);
    assert.deepEqual(a, b);
    assert(a.length > 0);
    assert(Math.abs(a.reduce((sum, x) => sum + x.probability, 0) - 1) < 1e-10);
  });
  await check('changing all hidden identities without changing public clues leaves all ranks unchanged', async () => {
    const a = observations('The cat sat on the mat.', 2, 'blank');
    const b = observations('His dog ate by her car.', 2, 'blank');
    assert.deepEqual(a, b);
    assert.deepEqual(await predict(engine, a, 2), await predict(engine, b, 2));
  });
  await check('labels are used only after prediction and do not affect it', async () => {
    const ranked = await predict(engine, observations('The cat sat.', 1, 'surrounding'), 1);
    const snapshot = JSON.stringify(ranked);
    assert.equal(scored(ranked[0].word, ranked).rank, 1);
    assert.equal(scored('zzzzzzzzzzzz', ranked).rank, null);
    assert.equal(JSON.stringify(ranked), snapshot);
  });
  await check('maximum selector chooses the argmax with stable alphabetical ties', async () => {
    installObservations(h, observations('The cat sat.', 1, 'surrounding'));
    const target = h.getEligibleAiSlots()[0];
    assert(!('answer' in target));
    const pool = await h.buildAiCandidatePool(target);
    assert(!('actualAnswer' in pool));
    assert(!('correctCandidates' in pool));
    const ranked = h.rankAiMaximumCandidates(h.getAiCandidateDistribution(pool, 1));
    for (let i = 0; i < 5; i++) assert.equal(h.chooseFinalAiCandidate(pool, 1).normalized, ranked[0].candidate.normalized);
    assert(!('isCorrect' in h.chooseFinalAiCandidate(pool, 1)));
    assert.equal(h.chooseFinalAiCandidate(pool, 1).correctChance, 0);
    const tie = [{ probability: 0.5, candidate: { normalized: 'zoo' } }, { probability: 0.5, candidate: { normalized: 'ant' } }];
    assert.equal(h.rankAiMaximumCandidates(tie)[0].candidate.normalized, 'ant');
  });
  await check('stale assisted pools fail closed in maximum mode', async () => {
    const slot = h.getEligibleAiSlots()[0];
    assert.equal(h.getAiCandidateDistribution({ targetSlot: slot, targetLength: 3, candidates: [{ word: 'cat', normalized: 'cat', sources: [2], sourcePrior: 1000 }] }, 1).length, 0);
  });
  await check('exact length, letters, wrong memory and solved exclusion survive fresh and stale pools', async () => {
    installObservations(h, observations('The cat sat.', 1, 'surrounding'));
    const slot = h.getEligibleAiSlots()[0];
    const pool = await h.buildAiCandidatePool(slot);
    assert(pool.candidates.every(c => /^[a-z]{3}$/i.test(c.word)));
    h.recordWrongAiGuessForSlot(1, 'DOG');
    assert(!h.getAiCandidateDistribution(pool, 1).some(e => e.candidate.normalized === 'dog'));
    assert(!h.hasWrongAiGuessForSlot(2, 'dog'));
    const block = slot.group.querySelectorAll()[0];
    block.dataset.revealed = 'true'; block.textContent = 'c';
    assert(h.getAiCandidateDistribution(pool, 1).every(e => e.candidate.normalized.startsWith('c')));
    assert((await h.buildAiCandidatePool(slot)).candidates.every(c => c.normalized.startsWith('c')));
    slot.group.classList.add('revealed');
    assert.equal(h.getEligibleAiSlots().length, 0);
    assert.equal(h.getAiCandidateDistribution(pool, 1).length, 0);
  });
  await check('maximum mode uses public capital markers even if normal mistakes are enabled', () => {
    h.aiLogicSettings.rules.noCaseMistakes = false;
    installObservations(h, observations('The cat.', 0, 'blank'));
    const slot = h.getEligibleAiSlots()[0];
    assert.equal(h.applyAiTargetCapitalization('tHE', slot), 'The');
    assert.equal(h.normalizeAiCandidate('THE'), 'the');
  });
  await check('slot selection compares every legal top candidate without random or hidden input', async () => {
    installObservations(h, observations('The cat sat.', 1, 'blank', true));
    h.clearAiWrongGuessMemory();
    const expected = [];
    for (const slot of h.getEligibleAiSlots()) {
      const pool = await h.buildAiCandidatePool(slot);
      const top = h.rankAiMaximumCandidates(h.getAiCandidateDistribution(pool, 1))[0];
      if (top) expected.push({ index: slot.slotIndex, probability: top.probability });
    }
    expected.sort((a, b) => b.probability - a.probability || a.index - b.index);
    const best = await h.buildMaximumAccuracyAiPool();
    assert.equal(best.targetSlot.slotIndex, expected[0].index);
    assert.equal((await h.buildMaximumAccuracyAiPool()).targetSlot.slotIndex, expected[0].index);
  });
  await check('maximum recognition uses normal submission ownership and diagnostic event flow', async () => {
    installObservations(h, observations('The cat sat.', 1, 'surrounding', true));
    h.clearAiWrongGuessMemory();
    h.HAND_RAISE_STATES = { AI_HAND_PENDING: 'pending', ANSWER_LOCKED: 'locked' };
    h.handRaiseState = 'pending'; h.raisedHandCharacter = 'character2';
    h.AI_CHARACTERS = ['character2']; h.AI_CHARACTER_NAMES = { character2: 'Aoi' };
    h.clearRaisedAiHand = () => {}; h.cancelAiTurn = () => {}; h.setTeacherMessage = () => {}; h.updateHumanRaiseHandButton = () => {};
    const events = []; h.emitDiagnosticEvent = (type, detail) => events.push({ type, detail });
    let submitted = false;
    h.submitSelectedAiGuess = () => { submitted = true; assert.equal(h.recognizedResponder, 'character2'); };
    assert(await h.recognizeAiResponder('character2'));
    assert(submitted);
    const decision = events.find(e => e.type === 'ai-decision').detail;
    assert.equal(decision.predictionMode, 'maximum-accuracy');
    assert.equal(decision.targetSlotProbability, 1);
    assert.equal(decision.selectedCandidate.correctGuessAssistance, 0);
  });
  await check('default path remains normal and CGA still works there', async () => {
    const normal = await harness();
    assert.equal(normal.isAiMaximumAccuracyMode(), false);
    normal.aiLogicSettings.correctGuess.entries[0].chance = 100;
    const slot = normal.getEligibleAiSlots()[1];
    const pool = await normal.buildAiCandidatePool(slot);
    assert.equal(normal.chooseFinalAiCandidate(pool, 1).normalized, 'cat');
  });
  await check('shared lexical families preserve ambiguity and correct known inflections', () => {
    const roles = w => h.analyzeAiWord(w).roles;
    assert(roles('its').has('possessiveDeterminer'));
    for (const w of ['many', 'both', 'other', 'enough']) assert(roles(w).has('determiner'), w);
    for (const w of ['somebody', 'everyone', 'nothing', 'anyone']) {
      assert(roles(w).has('subjectPronoun') && roles(w).has('objectPronoun'), w);
    }
    assert(roles('herself').has('objectPronoun'));
    assert(roles('her').has('objectPronoun') && roles('her').has('possessiveDeterminer'));
    for (const [word, lemma] of [['children', 'child'], ['women', 'woman'], ['men', 'man'], ['people', 'person'], ['driven', 'drive'], ['lost', 'lose']]) {
      assert(h.analyzeAiWord(word).lemmas.includes(lemma), word);
    }
    for (const w of ['childs', 'womans', 'losed']) assert.equal(h.analyzeAiWord(w).known, false, w);
    for (const w of ['doing', 'having']) assert(roles(w).has('presentParticiple'), w);
    assert(roles('play').has('noun') && roles('play').has('baseVerb'));
  });
  await check('global dictionary names are available only on the opt-in public-capital path', async () => {
    const dictionary = h.vault4Dictionary.dictionary;
    assert(dictionary.isProperWord('Susan'));
    assert(!dictionary.getWordsByLength(5).includes('Susan'));
    assert(dictionary.getProperWordsByLength(5).includes('Susan'));
    installObservations(h, observations('Who loves Susan?', 2, 'surrounding'));
    const names = await h.buildAiCandidatePool(h.getEligibleAiSlots()[0]);
    const susan = names.candidates.find(c => c.normalized === 'susan');
    assert(susan && susan.sources.every(s => s === 4));
    assert(h.analyzeAiWord(susan).roles.has('properNoun'));
    installObservations(h, observations('Who loves candy?', 2, 'surrounding'));
    const ordinary = await h.buildAiCandidatePool(h.getEligibleAiSlots()[0]);
    assert(!ordinary.candidates.some(c => c.normalized === 'susan'));
    const may = h.analyzeAiWord('May').roles;
    assert(may.has('modal') && may.has('properNoun'));
    assert.deepEqual(Array.from(h.classifyVisibleAiWord('May')).sort(), Array.from(h.classifyAiCandidateWord('May')).sort());
  });
  await check('frequency prior is bounded and strong grammar can override it', async () => {
    installObservations(h, observations('The cat sat.', 1, 'surrounding', true));
    const pool = await h.buildAiCandidatePool(h.getEligibleAiSlots()[0]);
    assert(pool.candidates.every(c => c.sourcePrior >= 1 && c.sourcePrior <= 32));
    const d = h.getAiCandidateDistribution(pool, 1);
    const cat = d.find(e => e.candidate.normalized === 'cat');
    const can = d.find(e => e.candidate.normalized === 'can');
    assert(cat.candidate.sourcePrior < can.candidate.sourcePrior);
    assert(cat.probability > can.probability);
  });
  await check('frequency uses documented Zipf bins, favors ordinary words, and never excludes rare words', async () => {
    const f = await h.loadAiWordFrequency();
    assert.equal(f.get('the'), 7.73);
    assert.equal(f.get('word'), 5.26);
    assert.equal(f.get('frequency'), 4.36);
    assert(h.getAiFrequencyEvidence('cheese', f).applied > h.getAiFrequencyEvidence('stoups', f).applied);
    assert.equal(h.getAiFrequencyEvidence('zzzzzz', f).applied, 1);
    installObservations(h, observations('we like cheese.', 2, 'blank'));
    h.clearAiWrongGuessMemory();
    const pool = await h.buildAiCandidatePool(h.getEligibleAiSlots().find(s => s.slotIndex === 2));
    assert(pool.candidates.some(c => c.normalized === 'stoups'), 'rarity must not change eligibility');
    assert(pool.candidates.every(c => c.sourcePrior === c.priorEvidence.applied));
    assert(h.getAiCandidateDistribution(pool, 1).every(e => Math.abs(e.weight - e.grammarWeight * e.candidate.priorEvidence.applied) < 1e-12));
  });
  await check('frequency loads once; missing data fails explicitly only in maximum mode', async () => {
    const local = await harness();
    let requests = 0;
    local.fetch = async () => { requests++; return { ok: false }; };
    await local.buildAiCandidatePool(local.getEligibleAiSlots()[0]);
    assert.equal(requests, 0, 'normal mode must not load the frequency table');
    local.location = { search: '?aiMode=maximum-accuracy' };
    const slot = local.getEligibleAiSlots()[0];
    await assert.rejects(local.buildAiCandidatePool(slot), /frequency could not be loaded/);
    await assert.rejects(local.buildAiCandidatePool(slot), /frequency could not be loaded/);
    assert.equal(requests, 1);
  });
  console.log(checks + ' maximum-accuracy checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
