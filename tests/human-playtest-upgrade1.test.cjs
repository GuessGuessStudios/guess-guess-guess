const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {harness,root}=require('./ai-harness.cjs');
const {installObservations}=require('./prediction-eval.cjs');
const plain=x=>JSON.parse(JSON.stringify(x));
(async()=>{
 const h=await harness();h.location={search:'?humanPlaytestMode=1'};
 vm.runInContext(fs.readFileSync(path.join(root,'human-playtest-eligibility.js'),'utf8')+fs.readFileSync(path.join(root,'human-playtest.js'),'utf8'),h);
 let tests=0;const check=async(name,f)=>{await f();tests++;console.log('PASS',name);};
 function board(tokens,reset=true){
  if(reset)h.clearAiWrongGuessMemory();
  const obs=tokens.map(token=>{
   const raw=typeof token==='string'?token:token.pattern;
   const text=raw.replace(/[.!?,;:]+$/,'');
   return {solved:!text.includes('_'),trailing:raw.slice(text.length),letters:[...text].map((c,i)=>({
    capital:c!=='_'&&/[A-Z]/.test(c)||Boolean(i===0&&token.capital),visible:c==='_'?'':c}))};
  });
  installObservations(h,obs);return h.getEligibleAiSlots();
 }
 async function ranking(tokens,index){const slots=board(tokens),slot=slots.find(s=>s.slotIndex===index);return h.rankHumanPlaytestPool(await h.buildAiCandidatePool(slot));}
 const entry=(r,w)=>r.ranked.find(c=>c.normalized===w);
 const top=r=>r.band.map(c=>c.normalized);
 await check('S_T and C_T retrieve common matches; raw matches counted before recommendation',async()=>{
  const r=await ranking(['s_t.'],0);for(const w of ['sat','set','sit'])assert(top(r).includes(w),top(r));
  assert(r.counts.allLegitimateMatches>=r.band.length);assert(r.narrowing>2);
  const q=await ranking(['c_t.'],0);for(const w of ['cat','cut'])assert(entry(q,w));
 });
 await check('long patterns are attractive; lower-frequency legal words survive retrieval',async()=>{
  const r=await ranking(['c_mp_ter.'],0);assert(entry(r,'computer'));assert(r.strongPattern);
  const state=r.state,unknown={word:'computer',zipf:2.5,analysis:{word:'computer',roles:[],known:false}};
  const q=h.GGGHumanPlaytest.rank({state,candidates:[unknown],visibleAnalyses:[null],vocabularyCount:2000});
  assert.equal(q.counts.allLegitimateMatches,1);assert.equal(q.band[0].word,'computer');assert.equal(q.ranked[0].contextWeight,1);
 });
 await check('two-sided verb + blank + noun prefers determiner/modifier families across variants',async()=>{
  for(const tokens of [['Making','____','game','has','ended.'],['Playing','____','song','helps.'],['They','enjoy','____','book.']]){
   const i=tokens.findIndex(x=>x==='____'),r=await ranking(tokens,i);
   for(const good of ['this','that','your','some'])for(const bad of ['have','they','will'])
    assert(entry(r,good).weight>entry(r,bad).weight*5,tokens.join(' ')+' '+good+'/'+bad);
   assert(!top(r).includes('have'));assert(r.band.every(c=>c.evidence.some(e=>e.outcome==='STRONG_FIT')));
  }
 });
 await check('ordinary sentence-start function words remain available; capital does not require a name',async()=>{
  const r=await ranking([{pattern:'___',capital:true},'cat','sleeps.'],0);
  assert(!r.proper.strong);assert(entry(r,'the'));assert(top(r).includes('the'));
  const q=await ranking([{pattern:'___',capital:true},'likes','music.'],0);
  assert(entry(q,'she'));assert(entry(q,'she').weight>entry(q,'and').weight);
 });
 await check('question punctuation, position and continuation distinguish WH, auxiliary and copula',async()=>{
  for(const [tokens,good,bad] of [
   [['___','you','ready?'],'are','the'],[['___','did','she','go?'],'why','the'],
   [['___','loves','Sarah?'],'who','why'],[['___','does','Sarah','love?'],'who','the'],
   [['___','they','work?'],'can','the']]){
    const r=await ranking(tokens,0);assert(r.context.questionOpening);
    assert(entry(r,good).weight>entry(r,bad).weight*3,tokens.join(' '));assert(top(r).includes(good),top(r));
  }
  const q=await ranking(['We','sing.','___','did','they','go?'],2);assert(q.context.questionOpening);
  const r=await ranking(['___','cat','sleeps.'],0);assert(!r.context.questionOpening);
 });
 await check('proper-name patterns retrieve independent dictionary names in subject syntax',async()=>{
  for(const [pattern,names]of [['_us__',['susan','susie']],['_ar__',['sarah','harry']]]){
   const r=await ranking(['Who','does',{pattern,capital:true},'love?'],2);
   assert(r.proper.strong&&r.context.personLike);
   assert(r.band.every(c=>c.properNoun));assert(names.some(w=>top(r).includes(w)),top(r));
   assert(r.counts.allLegitimateMatches>=r.band.length);
  }
  const r=await ranking(['Who','does',{pattern:'_____',capital:true},'love?'],2);
  assert(entry(r,'sarah'));assert(!entry(r,'house'),'ordinary surname-only entry must not enter given-name route');
 });
 await check('new internal letters and rejection invalidate even a held pool',async()=>{
  const slots=board(['___','________.']),pool=await h.buildAiCandidatePool(slots[1]);
  const before=h.rankHumanPlaytestPool(pool),oldId=h.GGGHumanPlaytest.boardId(before.state);
  const blocks=slots[1].group.querySelectorAll();
  for(const [i,c]of [[0,'c'],[2,'m'],[3,'p'],[5,'t'],[6,'e'],[7,'r']]){blocks[i].dataset.revealed='true';blocks[i].textContent=c;}
  const after=h.rankHumanPlaytestPool(pool);
  assert.notEqual(h.GGGHumanPlaytest.boardId(after.state),oldId);assert(after.counts.allLegitimateMatches<before.counts.allLegitimateMatches);
  assert(top(after).includes('computer'));h.recordWrongAiGuessForSlot(1,'computer');
  assert(!entry(h.rankHumanPlaytestPool(pool),'computer'));
 });
 await check('slot attention favors restrictive patterns, including long over short',async()=>{
  let slots=board(['s_t','________.']);let rs=await Promise.all(slots.map(async s=>h.rankHumanPlaytestPool(await h.buildAiCandidatePool(s))));
  assert(h.GGGHumanPlaytest.opportunity(rs[0]).score>h.GGGHumanPlaytest.opportunity(rs[1]).score);
  slots=board(['__','c_mp_ter.']);rs=await Promise.all(slots.map(async s=>h.rankHumanPlaytestPool(await h.buildAiCandidatePool(s))));
  assert(h.GGGHumanPlaytest.opportunity(rs[1]).score>h.GGGHumanPlaytest.opportunity(rs[0]).score);
  const selected=await h.buildHumanPlaytestTurnPool(slots[0]);assert.equal(selected.targetSlot.slotIndex,1);
 });
 await check('repeated unproductive attempts lose priority; new public evidence restores attention',async()=>{
  const slots=board(['___','_______.']);const pool=await h.buildAiCandidatePool(slots[0]);let r=h.rankHumanPlaytestPool(pool);
  const old=h.GGGHumanPlaytest.opportunity(r).score;
  h.GGGHumanPlaytest.noteAttempt(r);h.GGGHumanPlaytest.noteAttempt(r);
  assert(h.GGGHumanPlaytest.opportunity(r).score<old*0.5);
  const b=slots[0].group.querySelectorAll()[1];b.dataset.revealed='true';b.textContent='a';r=h.rankHumanPlaytestPool(pool);
  assert.equal(h.GGGHumanPlaytest.opportunity(r).reasons.unproductiveAttemptsWithoutNewEvidence,0);
  assert.equal(h.GGGHumanPlaytest.opportunity(r).reasons.newLettersSinceAttempt,1);
 });
 await check('common grammar mismatch is downranked; missing metadata alone remains neutral',async()=>{
  const r=await ranking(['She','____','happy.'],1);
  const direct=h.GGGHumanPlaytest.contextual({word:'qwer',analysis:{roles:[],known:false}},r.context);
  assert.equal(direct.weight,1);assert(direct.evidence.every(e=>e.outcome==='INSUFFICIENT_EVIDENCE'));
  const q=await ranking(['The','___','slept.'],1);
  assert(entry(q,'cat').weight>entry(q,'and').weight*5);
  for(const [tokens,good,bad]of [[['They','can','____.'],'work','went'],[['They','did','____.'],'walk','went'],[['They','have','____.'],'seen','goes']]){
   const a=await ranking(tokens,2);assert(!entry(a,bad)||entry(a,good).weight>entry(a,bad).weight*5);
  }
 });
 await check('unknown metadata can win a strong pattern without a frequency-floor exclusion',async()=>{
  const r=await ranking(['c_mp_ter.'],0);assert(entry(r,'computer'));assert(!entry(r,'computer').contextMismatch);
  assert(top(r).includes('computer'));
 });
 await check('bounded randomness stays in credible families and varies reasonable choices',async()=>{
  const r=await ranking(['Playing','____','song.'],1),chosen=new Set();
  for(let i=0;i<200;i++){const seed=Math.imul(i,2654435761)>>>0,c=h.GGGHumanPlaytest.choose(r,seed,'character1',i);
   assert(top(r).includes(c.word));assert(!c.contextMismatch);chosen.add(c.word);
   assert.deepEqual(plain(c),plain(h.GGGHumanPlaytest.choose(r,seed,'character1',i)));
  }assert(chosen.size>1);
 });
 await check('all-slot assessment obeys hidden-answer, old-grammar, CGA and target-vault traps',async()=>{
  const slots=board(['They','can','____','c_mp_ter.']);
  const fail=n=>{throw Error('Forbidden '+n);};
  for(const n of ['vault2ByPuzzle','vault3ByPuzzle','vault5ByPuzzle','puzzleList','currentPuzzleText'])Object.defineProperty(h,n,{configurable:true,get:()=>fail(n)});
  h.getCorrectGuessChance=()=>fail('CGA');h.scoreAiCandidateForGrammar=()=>fail('old grammar');h.inferAiTargetRoles=()=>fail('old roles');
  const pool=await h.buildHumanPlaytestTurnPool(slots[0]),choice=h.chooseFinalAiCandidate(pool,1);
  assert(choice);assert(!('isCorrect'in choice));assert(!('actualAnswer'in pool));
  assert(choice.diagnostic.topSlotOpportunities.length);assert(choice.diagnostic.engineVersion.includes('upgrade-1'));
  const before=plain(h.getAiCandidateDistribution(pool,1));h.aiLogicSettings.correctGuess.entries[0].chance=100;
  assert.deepEqual(plain(h.getAiCandidateDistribution(pool,1)),before);
  const b=pool.targetSlot.group.querySelectorAll().find(b=>b.dataset.revealed!=='true');b.dataset.revealed='true';b.textContent='z';
  assert.equal(h.chooseFinalAiCandidate(pool,2),null,'changed board discards old opportunity selection');
 });
 await check('final submission rejects a changed-context plausible set, even with unchanged target letters',async()=>{
  const slots=board(['___','____.']),pool=await h.buildHumanPlaytestTurnPool(slots[0]);
  const choice=h.chooseFinalAiCandidate(pool,1);assert(choice);
  h.currentAiTargetSlot=pool.targetSlot;h.currentAiCandidatePool=pool;h.currentAiSelectedCandidate=choice;
  h.HAND_RAISE_STATES={ANSWER_LOCKED:'locked'};h.handRaiseState='locked';h.AI_CHARACTERS=['character1'];h.recognizedResponder='character1';
  h.currentAttempt={group:null};let finished=false;h.cancelHumanPlaytestOpportunity=reason=>{assert.equal(reason,'stale-board');finished=true;return false;};h.submitGuess=()=>{throw Error('stale submitted');};
  const other=h.groups.find(g=>g!==pool.targetSlot.group);other.classList.add('revealed');
  other.querySelectorAll().forEach((b,i)=>{b.dataset.revealed='true';b.textContent='they'[i]||'e';});
  assert.equal(h.submitSelectedAiGuess(),false);assert(finished);
 });
 await check('5x timer scale retained and normal timing unchanged',()=>{
  assert.equal(h.humanPlaytestDelay(1500),300);assert.equal(h.humanPlaytestDelay(750),150);
  h.location.search='';assert.equal(h.humanPlaytestDelay(1500),1500);assert.equal(h.humanPlaytestDelay(750),750);
 });
 console.log(tests+' Upgrade 1 behavioral checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
