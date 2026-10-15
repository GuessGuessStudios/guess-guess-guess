const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {harness,group,root}=require('./ai-harness.cjs');
(async()=>{
 const h=await harness();vm.runInContext(fs.readFileSync(path.join(root,'hints.js'),'utf8'),h);
 h.MAX_STRIKES=5;h.strikeCount=0;h.hintRevealCount=0;
 h.groups=[group('abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz')];
 h.updateAllPartialUnderlines=()=>{};
 // Every hidden block is displaying a temporary guess, reproducing the old
 // selector's false "no hints" result. It must use revealed state instead.
 h.groups[0].querySelectorAll().forEach(b=>{b.textContent='x';b.classList.remove=()=>{};});
 let hints=0;const commit=(result='incorrect')=>{const a={};const d=h.applyCommittedHintResult(a,result);assert.deepEqual(h.applyCommittedHintResult(a,result),d);if(d.hintCompleted)hints++;return d;};
 for(let n=1;n<=25;n++){
   const d=commit();assert.equal(d.wrongStreakBefore,(n-1)%5);assert.equal(d.wrongStreakAfter,n%5);
   assert.equal(d.hintTriggered,n%5===0);assert.equal(d.hintCompleted,n%5===0);assert.equal(hints,Math.floor(n/5));
   // Preparation, cancellation, stale/rejected submissions never call this
   // committed-result transition. An invalid result is explicitly ignored.
   assert.deepEqual(Object.keys(h.applyCommittedHintResult({},'rejected-before-commit')),[]);
   assert.equal(h.strikeCount,n%5);
 }
 assert.equal(hints,5);commit();commit();assert.equal(commit('correct').wrongStreakAfter,0);
 for(let n=1;n<=5;n++)assert.equal(commit().hintTriggered,n===5);
 // No timer is run anywhere above: 900ms feedback cannot skip a threshold.
 assert.equal(hints,6);
 h.groups[0].querySelectorAll().forEach(b=>b.dataset.revealed='true');
 for(let n=1;n<=5;n++){const d=commit();if(n===5){assert(d.hintTriggered);assert(!d.hintCompleted);assert.equal(d.hintReason,'no-unrevealed-letters');}}
 const s=fs.readFileSync(path.join(root,'game.js'),'utf8');
 assert(!s.slice(s.indexOf('  function processWrongGuess'),s.indexOf('  function applyCommittedHintResult')).includes('strikeCount'));
 assert(s.includes('if (attempt.committedResult || HINT_DISPLAY.pending) return;'));
 // Real commit entry point, mixed AI/human ownership, with display cleanup
 // withheld/cancelled. This tests shared gameplay, not inference accuracy.
 const live=await harness();vm.runInContext(fs.readFileSync(path.join(root,'hints.js'),'utf8'),live);
 Object.assign(live,{AI_GUESS_DISPLAY_MS:1500,MAX_STRIKES:5,strikeCount:0,hintRevealCount:0,gameStarted:true,isGameOver:false,gameEnded:false,
  HAND_RAISE_STATES:{ANSWER_LOCKED:'locked'},handRaiseState:'locked',currentAiTargetSlot:null});
 live.groups=[group('abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz')];
 live.groups[0].querySelectorAll().forEach(b=>b.classList.remove=()=>{});
 live.getCapitalizationErrorBlocks=()=>[];live.emitStudentEvent=()=>{};live.updateAllPartialUnderlines=()=>{};live.setMessage=()=>{};
 const events=[];live.emitDiagnosticEvent=(type,detail)=>{if(type==='guess')events.push(detail);};
 live.showWrongGuessFeedback=()=>{}; // no display callback is permitted to run
 for(let n=1;n<=25;n++){
  live.recognizedResponder=n%2?'character1':'human';
  const attempt=live.createAttempt(live.groups[0],'ai');live.currentAttempt=attempt;
  const wrong=live.groups[0].querySelectorAll().map(b=>b.dataset.revealed==='true'?b.textContent:'x').join('');
  live.submitGuess(attempt,wrong,{character:live.recognizedResponder});
  live.submitGuess(attempt,wrong,{character:live.recognizedResponder}); // same commit cannot count twice
  assert.equal(events.length,n);assert.equal(events.at(-1).hintTriggered,n%5===0);
  assert.equal(events.at(-1).hintCompleted,n%5===0);assert.equal(live.strikeCount,n%5);
  const stale=live.createAttempt(live.groups[0]);
  live.submitGuess(stale,wrong,{character:live.recognizedResponder});
  assert.equal(events.length,n);assert.equal(live.strikeCount,n%5);
 }
 assert.equal(events.filter(e=>e.hintCompleted).length,5);
 console.log('PASS real submission stress: 25 mixed human/AI wrong commits, 5 completed hints, duplicate/stale attempts neutral, display callbacks withheld');
 console.log('PASS 25 committed-wrong stress: hints at 5/10/15/20/25, no duplicates, correct reset, rejected events neutral, preview independence, no-letter exit, no display-timer ownership');
})().catch(e=>{console.error(e);process.exitCode=1;});
