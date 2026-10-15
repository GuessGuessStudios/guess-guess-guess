// Exact candidate probabilities for the real puzzle 002 and local vault files.
// Optional game.js path permits comparison with a pre-repair snapshot.
const { harness } = require('./ai-harness.cjs');
(async () => {
  const h=await harness(process.argv.slice(2).find(arg=>arg!=='--full'));
  const slots=h.getEligibleAiSlots();
  const pool=await h.buildAiCandidatePool(slots[0]);
  const context={...h.getAiGrammarContext(slots[0]),targetLength:3};
  h.Math.random=()=>.5;
  console.log('midpoint-draw target',h.chooseAiTargetSlot().slotIndex);
  console.log('midpoint-draw candidate',h.chooseFinalAiCandidate(pool,1));
  if (!h.getAiCandidateDistribution) {
    console.log('baseline source counts and grammar sums',Object.entries(pool.incorrectCandidatesBySource).map(([s,cs])=>[s,cs.length,cs.reduce((n,c)=>n+h.scoreAiCandidateForGrammar(c,context),0)]));
    return;
  }
  const entries=h.getAiCandidateDistribution(pool,1);
  console.log('candidate count, total score',entries.length,entries.reduce((n,e)=>n+e.weight,0));
  console.log('sources', [1,3,4,5].map(s=>({source:s,count:entries.filter(e=>e.candidate.sources.includes(s)).length,
    finalProbability:entries.filter(e=>e.candidate.sources.includes(s)).reduce((n,e)=>n+e.probability,0)})));
  console.log('starters',entries.filter(e=>['the','she','her','his','you','who','any','our','dog','cat','sat','mat'].includes(e.candidate.normalized)));
  h.groups[1].classList.add('revealed');h.groups[1].querySelectorAll().forEach(b=>{b.dataset.revealed='true';b.textContent=b.dataset.letter;});
  console.log('cat revealed: P(the)',h.getAiCandidateDistribution(pool,1).find(e=>e.isCorrect).probability);
  const b=h.groups[0].querySelectorAll()[0];b.dataset.revealed='true';b.textContent='T';
  console.log('cat and T revealed: P(the)',h.getAiCandidateDistribution(pool,1).find(e=>e.isCorrect).probability);
  // Full pool, scores and probabilities are reproducible without a UI change.
  if(process.argv.includes('--full')) console.log(JSON.stringify(entries,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
