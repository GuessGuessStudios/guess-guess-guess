const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {harness,group,root}=require('./ai-harness.cjs');
(async()=>{
 const h=await harness();vm.runInContext(fs.readFileSync(path.join(root,'hints.js'),'utf8'),h);
 h.location={search:'?humanPlaytestMode=1'};
 Object.assign(h,{AI_GUESS_DISPLAY_MS:1500,WRONG_GUESS_DISPLAY_MS:1500,MAX_STRIKES:5,strikeCount:0,hintRevealCount:0,wrongFeedback:null,
  performance:{now:()=>100},clearTimeout:()=>{},setMessage:()=>{},updateAllPartialUnderlines:()=>{},renderAttemptPreview:()=>{},finishAiGuessOpportunity:()=>{},finishHumanGuessOpportunity:()=>{}});
 h.groups=[group('abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz')];
 const blocks=h.groups[0].querySelectorAll();blocks.forEach(b=>b.classList.remove=()=>{});
 Object.assign(h.document,{addEventListener(){},removeEventListener(){},querySelectorAll:s=>s==='.letter-block'?blocks:h.groups});
 let timer,visible=0;h.setTimeout=(fn,ms)=>{assert.equal(ms,900);timer=fn;return 1;};
 h.emitDiagnosticEvent=(type,d)=>{if(type==='hint-display'&&d.hintVisible){visible++;assert(d.wrongPreviewCleared);assert(!h.groups[0].classList.contains('wrong-guess'));assert(blocks.every(b=>!b.dataset.wrongSnapshotLetter));}};
 for(let n=1;n<=25;n++){
  const before=blocks.filter(b=>b.dataset.revealed==='true').length;
  blocks.filter(b=>b.dataset.revealed!=='true').forEach(b=>b.textContent='x');
  const a=h.createAttempt(h.groups[0],'ai');a.aiGuessContext={slotIndex:0,word:'x'};a.typedCharacters='x'.repeat(52-before);h.currentAttempt=a;
  h.showWrongGuessFeedback(a,'character1');const d=h.applyCommittedHintResult(a,'incorrect');
  assert.equal(d.hintTriggered,n%5===0);assert.equal(h.strikeCount,n%5);
  assert.equal(blocks.filter(b=>b.dataset.revealed==='true').length,before,'no permanent reveal through preview');
  if(d.hintTriggered){assert(d.hintPendingDisplay);assert(!d.hintCompleted);assert(!h.finishPendingHintDisplay());assert(!h.finishPendingHintDisplay());}
  timer(); // delayed callback still applies exactly once, after preview cleanup
  assert.equal(visible,Math.floor(n/5));assert.equal(blocks.filter(b=>b.dataset.revealed==='true').length,visible);
  assert(!h.finishPendingHintDisplay());timer();assert.equal(visible,Math.floor(n/5));
 }
 h.strikeCount=4;const a=h.createAttempt(h.groups[0],'ai');a.aiGuessContext={};h.currentAttempt=a;
 h.showWrongGuessFeedback(a,'character1');h.applyCommittedHintResult(a,'incorrect');h.cancelWrongFeedback();timer();assert.equal(visible,5);
 assert.equal(h.strikeCount,0);assert(!h.finishPendingHintDisplay());
 console.log('PASS hint visual sequence: 25 wrong commits, five pending-to-visible cycles, 900ms previews, no overlap, delayed/repeated callback safe, teardown cancels cleanly');
})().catch(e=>{console.error(e);process.exitCode=1;});
