const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {harness}=require('./ai-harness.cjs');
const {installObservations}=require('./prediction-eval.cjs');
(async()=>{
 const h=await harness();h.location={search:'?humanPlaytestMode=1'};
 for(const f of ['human-playtest-eligibility.js','human-playtest.js'])vm.runInContext(fs.readFileSync(f,'utf8'),h);
 const e=h.GGGHumanPlaytest;await e.loadResources();let checks=0;
 const check=async(name,f)=>{await f();checks++;console.log('PASS',name);};
 function board(tokens){
  h.clearAiWrongGuessMemory();
  const parsed=tokens.map(t=>{
   const raw=typeof t==='string'?t:t.pattern,gaps=[''],letters=[];
   for(const c of raw)if(/[a-z_]/i.test(c)){letters.push({capital:/[A-Z]/.test(c)||(letters.length===0&&Boolean(t.capital)),visible:c==='_'?'':c});gaps.push('');}else gaps[gaps.length-1]+=c;
   return {letters,gaps,solved:!raw.includes('_'),trailing:gaps.at(-1)};
  });
  installObservations(h,parsed);
  h.groups.forEach((g,i)=>{const bs=g.querySelectorAll(),s=parsed[i];g.children=[];
   bs.forEach((b,j)=>{g.children.push(b);if(j<bs.length-1&&s.gaps[j+1])g.children.push({textContent:s.gaps[j+1],classList:{contains:c=>c==='punct'}});});
  });
  return h.getEligibleAiSlots();
 }
 async function rank(tokens,index){const slots=board(tokens);return h.rankHumanPlaytestPool(await h.buildAiCandidatePool(slots.find(s=>s.slotIndex===index)));}
 const get=(r,w)=>r.ranked.find(c=>c.normalized===w),band=r=>Array.from(r.band,c=>c.normalized);
 const beats=(r,good,bad,ratio=5)=>assert(get(r,good)&&(!get(r,bad)||get(r,good).weight>get(r,bad).weight*ratio),JSON.stringify({good,bad,ranked:r.ranked.slice(0,6),context:r.context}));
 await check('short-word validity: _f admits if/of, excludes BF and alphabetic artifacts',async()=>{
  const r=await rank(['_f.'],0);assert.deepEqual(band(r).sort(),['if','of']);assert(!get(r,'bf'));assert.equal(r.counts.allLegitimateMatches,2);
 });
 await check('apostrophe and hyphen are hard token constraints, including stale pools',async()=>{
  const slots=board(["_on't."]),pool=await h.buildAiCandidatePool(slots[0]);let r=h.rankHumanPlaytestPool(pool);
  assert(get(r,"don't")&&get(r,"won't"));assert(!get(r,'font'));assert(r.band.every(c=>e.matchesToken(c.word,r.state.slots[0])));
  assert(!h.matchesAiRevealedLetters('font',slots[0]));assert.equal(r.pattern,"_on't");
  const punc=slots[0].group.children.find(x=>x.textContent==="'");punc.textContent='-';r=h.rankHumanPlaytestPool(pool);assert(!get(r,"don't"));
  const q=await rank(['well-_____'],0);assert(get(q,'well-known'));assert(!e.matchesToken('wellknown',q.state.slots[0]));
 });
 await check('negative imperative is productive, not a worry-specific rule',async()=>{
  for(const v of ['worry','panic','forget']){const r=await rank(["_on't",v+'.'],0);beats(r,"don't","won't");assert.equal(band(r)[0],"don't");}
  const r=await rank(['She',"_on't",'worry.'],1);assert(get(r,"won't"));assert(!get(r,"won't").contextMismatch);
 });
 await check('S_T and longer completions gain strong attention over uninformative slots',async()=>{
  const slots=board(['s_t','________.']),r=await Promise.all(slots.map(async s=>h.rankHumanPlaytestPool(await h.buildAiCandidatePool(s))));
  for(const w of ['sat','set','sit'])assert(band(r[0]).includes(w));
  assert(e.opportunity(r[0]).score>e.opportunity(r[1]).score*2);
  const q=await rank(['c_mp_ter.'],0);assert.equal(band(q)[0],'computer');
 });
 await check('person-name route contains vetted given names; TDM, PYM, surnames excluded',async()=>{
  for(const subject of ['She','He','Someone']){
   const r=await rank([subject,'loves',{pattern:'___',capital:true}],2);
   assert(r.context.objectPosition&&r.context.personLike);assert(band(r).some(w=>['tom','sam','bob','ann','joe','dan'].includes(w)));
   for(const w of ['tdm','pym','com'])assert(!get(r,w));assert(r.band.every(c=>e.nameFamiliarity(c.word)>0));
  }
  const r=await rank(['Who','does',{pattern:'_us__',capital:true},'know?'],2);assert(band(r).some(w=>['susan','susie'].includes(w)));
 });
 await check('active perfect vs passive uses following object and subject number',async()=>{
  for(const noun of ['game','song','story']){const r=await rank(['The',noun,'___','driven','me','away.'],2);beats(r,'has','was',20);assert(!band(r).includes('was'));}
  const r=await rank(['The','games','____','driven','us','away.'],2);assert(band(r).includes('have'));
  const q=await rank(['The','door','___','opened','by','her.'],2);assert(band(q).includes('was'));beats(q,'was','has',2);
 });
 await check('compound subject survives an appositive and rules out noun competitors',async()=>{
  for(const tokens of [['His','mother','and','his','cat,','Percy,','____','him.'],['The','teacher','and','her','student','____','her.']]){
   const i=tokens.findIndex(t=>t==='____'),r=await rank(tokens,i);assert.equal(r.context.number,'plural');beats(r,'love','wife',30);assert(!band(r).includes('wife'));
  }
  const r=await rank(['The','boy','and','girl','_____','him.'],4);
  assert(get(r,'loves').contextMismatch);
 });
 await check('WHO subject supports finite agreement without a blanket ends-with-s rule',async()=>{
  const r=await rank(['Who','_____','him?'],1);beats(r,'loves','label',20);assert(!band(r).includes('label'));
  for(const w of ['likes','knows','wants'])assert(!get(r,w).contextMismatch);
  const q=await rank(['Who','___','help?'],1);assert(get(q,'can')&&!get(q,'can').contextMismatch);
  const a=await rank(['Who','___','here?'],1);assert(get(a,'was')&&!get(a,'was').contextMismatch);
  const b=await rank(['They','_____','him.'],1);assert(get(b,'loves').contextMismatch);
 });
 await check('person evidence boosts grammatical object pronouns within this sentence only',async()=>{
  for(const subject of ['Nobody','Someone','The mother']){
   const tokens=[...subject.split(' '),'loves','___.'],r=await rank(tokens,tokens.length-1);
   assert(r.context.animate&&r.context.objectPosition);assert(band(r).some(w=>['him','her'].includes(w)));beats(r,'him','the');
  }
  const r=await rank(['The','door','is','___.'],3);assert(!r.context.objectPosition);
 });
 await check('general phrase inventory works bidirectionally, with unrelated pairs and boundaries',async()=>{
  for(const [tokens,index,good,bad] of [[['_____','syrup.'],0,'maple','label'],[['___','cream.'],0,'ice','bad'],[['peanut','______.'],1,'butter','mother']]){
   const r=await rank(tokens,index);assert(get(r,good).phraseWeight>1);beats(r,good,bad,2);assert(band(r).includes(good));
  }
  const r=await rank(['_____','syrup.'],0),q=await rank(['_____.','Syrup.'],0);assert(get(q,'maple').phraseWeight===1);assert(get(r,'maple').phraseWeight>1);
 });
 await check('public information alone contracts the band and increases opportunity and concentration',async()=>{
  const early=await rank(['____','________.'],1),late=await rank(['this','c_mp_ter.'],1);
  assert(late.convergence>early.convergence);assert(late.band.length<early.band.length);assert(late.selectionPower>early.selectionPower);
  assert(e.opportunity(late).score>e.opportunity(early).score);
  assert(late.counts.allLegitimateMatches>=late.counts.recommended);
 });
 await check('revealed context and rejections immediately replace cached candidate assessments',async()=>{
  const slots=board(["_on't",'_____.' ]),pool=await h.buildAiCandidatePool(slots[0]),before=h.rankHumanPlaytestPool(pool);
  const g=h.groups[1];g.classList.add('revealed');g.querySelectorAll().forEach((b,i)=>{b.dataset.revealed='true';b.textContent='worry'[i];});
  const after=h.rankHumanPlaytestPool(pool);assert.notEqual(e.boardId(after.state),e.boardId(before.state));beats(after,"don't","won't");
  h.recordWrongAiGuessForSlot(0,"don't");assert(!get(h.rankHumanPlaytestPool(pool),"don't"));
 });
 await check('strong context outranks an artificially high frequency mismatch; unknown roles stay neutral',async()=>{
  const slots=board(['Who','_____','him?']),pool=await h.buildAiCandidatePool(slots[0]);
  const candidates=pool.candidates.filter(c=>['loves','label'].includes(c.word)).map(c=>({...c,zipf:c.word==='label'?7:3}));
  const r=h.rankHumanPlaytestPool({...pool,resourceKey:null,vocabulary:null,candidates});beats(r,'loves','label',5);assert(!band(r).includes('label'));
  assert.equal(e.contextual({word:'opaque',analysis:{roles:[],known:false}},r.context).weight,1);
 });
 await check('hidden answers, CGA and answer vaults remain inaccessible; stale decision cannot commit',async()=>{
  const slots=board(['She',"_on't",'worry.']);
  for(const key of ['vault2ByPuzzle','vault3ByPuzzle','vault5ByPuzzle','puzzleList','currentPuzzleText'])Object.defineProperty(h,key,{configurable:true,get(){throw Error('Forbidden '+key);}});
  h.getCorrectGuessChance=()=>{throw Error('CGA');};
  const pool=await h.buildHumanPlaytestTurnPool(slots[0]),chosen=h.chooseFinalAiCandidate(pool,1);assert(chosen);
  assert(!('isCorrect'in chosen));assert(chosen.diagnostic.convergence>=0);assert(!JSON.stringify(chosen.diagnostic).includes('actualAnswer'));
  const b=slots[0].group.querySelectorAll()[0];b.dataset.revealed='true';b.textContent='z';assert.equal(h.chooseFinalAiCandidate(pool,2),null);
 });
 await check('full-token commitment maps only alphabetic characters into preview blocks',async()=>{
  const slots=board(["_on't",'worry.']),pool=await h.buildHumanPlaytestTurnPool(slots[0]),choice=h.chooseFinalAiCandidate(pool,1);
  h.HAND_RAISE_STATES={ANSWER_LOCKED:'locked'};h.handRaiseState='locked';h.AI_CHARACTERS=['character1'];h.recognizedResponder='character1';
  h.currentAiTargetSlot=pool.targetSlot;h.currentAiCandidatePool=pool;h.currentAiSelectedCandidate=choice;h.currentAttempt=h.createAttempt();
  h.renderAttemptPreview=()=>{};h.emitDiagnosticEvent=()=>{};let called=false;
  h.submitGuess=(attempt,word)=>{called=true;assert.equal(word,"don't");assert.equal(attempt.typedCharacters,'d');};
  assert(h.submitSelectedAiGuess());assert(called);
 });
 console.log(checks+' repair behavioral checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
