const assert = require('node:assert/strict');
const { harness, group } = require('./ai-harness.cjs');
(async () => {
  const h = await harness();
  const slots = h.getEligibleAiSlots();
  let checks = 0;
  function check(name, fn) { fn(); checks++; console.log('PASS', name); }
  const first = await h.buildAiCandidatePool(slots[0]);
  const cat = await h.buildAiCandidatePool(slots[1]);
  check('Vault 2 receives a bounded neutral lexical prior', () => {
    const catCandidate = cat.candidates.find(c => c.normalized === 'cat');
    const ordinary = first.candidates.find(c => c.normalized === 'dog');
    const firstAnswer = first.candidates.find(c => c.normalized === 'the');
    const ordinaryFunctionWord = first.candidates.find(c => c.normalized === 'any');
    assert(catCandidate.sources.includes(2));
    assert(catCandidate.sourcePrior >= 1);
    assert(catCandidate.sourcePrior < ordinary.sourcePrior * 2);
    assert.equal(firstAnswer.sourcePrior, ordinaryFunctionWord.sourcePrior, 'Vault 2 must not stack on Vault 1');
  });
  const roleHarness = await harness();
  roleHarness.groups[0].classList.add('revealed');
  roleHarness.groups[0].querySelectorAll().forEach(block => {
    block.dataset.revealed = 'true';
    block.textContent = block.dataset.letter;
  });
  const rolePool = await roleHarness.buildAiCandidatePool(
    roleHarness.getEligibleAiSlots().find(slot => slot.slotIndex === 1),
  );
  check('Vault 2 does not override stronger grammar evidence', () => {
    const roleDistribution = roleHarness.getAiCandidateDistribution(rolePool, 1);
    const catEntry = roleDistribution.find(entry => entry.candidate.normalized === 'cat');
    const hisEntry = roleDistribution.find(entry => entry.candidate.normalized === 'his');
    assert(catEntry && hisEntry);
    assert(catEntry.grammarWeight > hisEntry.grammarWeight);
    assert(catEntry.weight > hisEntry.weight);
  });
  check('Vault 2: only exact target is correct; sat is wrong for cat', () => {
    assert.deepEqual(Array.from(cat.correctCandidates, c => c.normalized), ['cat']);
    assert(cat.incorrectCandidates.some(c => c.normalized === 'sat'));
    assert.deepEqual(Array.from(first.correctCandidates, c => c.normalized), ['the']);
  });
  let distribution = h.getAiCandidateDistribution(first, 1);
  const find = word => distribution.find(e => e.candidate.normalized === word);
  check('starter candidates share one distribution with declarative question suppression', () => {
    for (const word of ['the','she','her','his','you','who']) assert(find(word).probability > 0.005);
    assert(find('who').probability < find('she').probability);
    // Test the structural preference independently of source mass. The old
    // 4x final-probability threshold encoded stacked legacy multipliers.
    assert(find('the').grammarWeight > find('dog').grammarWeight * 2);
    assert(find('the').heuristicProbability > find('dog').heuristicProbability * 2);
    assert(find('the').probability > find('dog').probability * 2);
    assert(distribution.some(e => e.candidate.sources.includes(3)));
    assert(distribution.some(e => e.candidate.sources.includes(4)));
    assert(Math.abs(distribution.reduce((s,e)=>s+e.probability,0)-1)<1e-10);
  });
  check('unsafe contractions and wrong lengths never enter selectable pool', () => {
    assert(first.candidates.every(c => /^[a-z]{3}$/i.test(c.word)));
  });
  check('difficulty follows heuristics: zero retains successes, 100 exact answer', () => {
    h.aiLogicSettings.correctGuess.entries[0].chance=0;
    const zero=h.getAiCandidateDistribution(first,1).find(e=>e.isCorrect);
    assert(zero.probability>0);
    h.aiLogicSettings.correctGuess.entries[0].chance=100;
    for(let i=0;i<10;i++) assert.equal(h.chooseFinalAiCandidate(cat,1).normalized,'cat');
    h.aiLogicSettings.correctGuess.entries[0].chance=2;
    assert(Math.abs(find('the').probability-(.02+.98*zero.probability))<1e-12);
  });
  check('sentence-initial slot is favored, not guaranteed', () => {
    const counts=Array(6).fill(0);
    for(let i=0;i<10000;i++) counts[h.chooseAiTargetSlot().slotIndex]++;
    assert(counts[0]>5200 && counts[0]<5700);
    assert(counts.slice(1).every(n=>n>750 && n<1100));
  });
  h.recordWrongAiGuessForSlot(0,'SHE');
  check('shared per-slot memory; same word allowed elsewhere; stale pool rechecked', () => {
    assert(h.hasWrongAiGuessForSlot(0,'she'));
    assert(!h.hasWrongAiGuessForSlot(1,'she'));
    assert(!h.getAiCandidateDistribution(first,1).some(e=>e.candidate.normalized==='she'));
  });
  const rebuilt=await h.buildAiCandidatePool(slots[0]);
  check('memory filters rebuilt pool',()=>assert(!rebuilt.candidates.some(c=>c.normalized==='she')));
  h.clearAiWrongGuessMemory();
  check('capitalization uses visible capital markers', () => {
    assert.equal(h.applyAiTargetCapitalization('sHe',slots[0]),'She');
    assert.equal(h.applyAiTargetCapitalization('DOG',slots[1]),'dog');
  });
  const initialQ=find('the').heuristicProbability;
  h.groups[1].classList.add('revealed');
  h.groups[1].querySelectorAll().forEach(b=>{b.dataset.revealed='true';b.textContent=b.dataset.letter;});
  check('solved exclusion and adjacent revealed noun improve article evidence',()=>{
    assert(!h.getEligibleAiSlots().some(s=>s.slotIndex===1));
    assert(h.getAiCandidateDistribution(first,1).find(e=>e.isCorrect).heuristicProbability>initialQ);
  });
  const block=h.groups[0].querySelectorAll()[0];
  block.dataset.revealed='true'; block.textContent='T';
  const partial=await h.buildAiCandidatePool(slots[0]);
  check('partial letters constrain both fresh and stale candidate pools',()=>{
    assert(partial.candidates.every(c=>c.normalized.startsWith('t')));
    assert(h.getAiCandidateDistribution(first,1).every(e=>e.candidate.normalized.startsWith('t')));
    assert(h.getAiCandidateDistribution(partial,1).find(e=>e.isCorrect).probability>find('the').probability);
  });
  check('hidden letters do not affect grammar or revealed-letter matching',()=>{
    const before=JSON.stringify(h.getAiGrammarContext(slots[0]));
    const hidden=h.groups[2].querySelectorAll()[0]; hidden.dataset.letter='X';
    assert.equal(JSON.stringify(h.getAiGrammarContext(slots[0])),before);
    block.dataset.revealed='false';block.textContent='wrong preview';
    assert(h.matchesAiRevealedLetters('she',slots[0]));
  });
  h.groups=[group('The'),group('cat'),group('sat','.')];
  h.groups[2].classList.add('revealed');
  h.groups[2].querySelectorAll().forEach(b=>b.textContent=b.dataset.letter);
  check('grammar does not jump over unknown words',()=>assert.equal(h.getAiGrammarContext({group:h.groups[0]}).nextWord,''));
  h.groups=[group('Well',','),group('the'),group('cat','.')];
  check('comma is not a sentence boundary',()=>assert.equal(h.getAiGrammarContext({group:h.groups[1]}).sentenceInitial,false));
  // Submission boundary test: actual function, with downstream UI/scoring stubbed.
  h.groups=[group('The')];
  h.currentAiTargetSlot=h.getEligibleAiSlots()[0];
  h.currentAiSelectedCandidate={word:'she'};
  h.HAND_RAISE_STATES={ANSWER_LOCKED:'ANSWER_LOCKED'};h.handRaiseState='ANSWER_LOCKED';
  h.AI_CHARACTERS=['character1','character2','character3','character4'];
  h.currentAttempt={};let finished=0, submitted=0;
  h.finishAiGuessOpportunity=()=>{finished++;};
  h.createAttempt=()=>({});h.renderAttemptPreview=()=>{};
  h.submitGuess=(attempt,word,options)=>{submitted++;assert.equal(word,'She');assert.equal(options.character,h.recognizedResponder);};
  check('submission keeps each recognized student as owner',()=>{
    for(const character of h.AI_CHARACTERS){h.recognizedResponder=character;assert(h.submitSelectedAiGuess());}
    assert.equal(submitted,4);
  });
  h.recordWrongAiGuessForSlot(0,'she');
  check('submission rejects repeated wrong word and completes opportunity',()=>{assert.equal(h.submitSelectedAiGuess(),false);assert.equal(finished,1);});
  h.clearAiWrongGuessMemory();
  h.groups[0].querySelectorAll()[0].dataset.revealed='true';h.groups[0].querySelectorAll()[0].textContent='T';
  check('submission rejects newly conflicting hint and completes opportunity',()=>{assert.equal(h.submitSelectedAiGuess(),false);assert.equal(finished,2);});
  h.groups[0].classList.add('revealed');
  check('submission rejects newly solved slot',()=>assert.equal(h.submitSelectedAiGuess(),false));
  console.log(`${checks} focused checks passed.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
