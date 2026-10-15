const assert=require('node:assert/strict');
const {fixture}=require('./human-playtest-fixture.cjs');
(async()=>{
 const {h,e,board,rank,turns}=await fixture();let n=0;
 const check=async(name,f)=>{await f();n++;console.log('PASS',name);};
 const get=(r,w)=>r.ranked.find(c=>c.word===w),band=r=>Array.from(r.band,c=>c.word);
 const beats=(r,good,bad,m=3)=>assert(get(r,good)&&(!get(r,bad)||get(r,good).weight>get(r,bad).weight*m),JSON.stringify({good,bad,band:band(r),context:r.context,evidence:get(r,good)?.evidence}));
 await check('hand cannot rise until a valid current candidate is prepared',async()=>{
  board(['s_t.']);const t=turns();assert.equal(h.raiseAiHand('character1'),false);assert(h.aiHandIndicators.character1.hidden);
  assert(await h.prepareHumanPlaytestOpportunity('character1'));assert(!h.aiHandIndicators.character1.hidden);
  const states=t.events.filter(x=>x.type==='ai-opportunity').map(x=>x.transition);
  assert(states.indexOf('candidate-ready')<states.indexOf('hand-raised'));
  await h.recognizeAiResponder('character1');assert.equal(t.submitted.length,1);
 });
 await check('stale candidate cancels hand, unlocks state and reschedules',async()=>{
  const slots=board(['s_t.']);const t=turns();await h.prepareHumanPlaytestOpportunity('character1');
  const b=slots[0].group.querySelectorAll()[1];b.dataset.revealed='true';b.textContent='a';
  assert.equal(await h.recognizeAiResponder('character1'),false);assert.equal(h.handRaiseState,'open');assert(h.aiHandIndicators.character1.hidden);
  assert(t.scheduled()>0);assert(t.events.some(x=>x.reason==='stale-board'));assert.equal(t.submitted.length,0);
  assert(await h.prepareHumanPlaytestOpportunity('character2'));await h.recognizeAiResponder('character2');assert.equal(t.submitted.length,1);
 });
 await check('empty slot does not block a different viable slot',async()=>{
  board([{pattern:'Qzxqzxqzx___',capital:true},'c_mp_ter.']);const t=turns();
  assert(await h.prepareHumanPlaytestOpportunity('character3'));await h.recognizeAiResponder('character3');assert.equal(t.submitted[0].word,'computer');
 });
 await check('all unsupported stays silent, scheduler and human remain available',async()=>{
  board([{pattern:'Qzxqzxqzx___',capital:true}]);const t=turns();
  assert.equal(await h.prepareHumanPlaytestOpportunity('character4'),false);
  assert.equal(await h.prepareHumanPlaytestOpportunity('character4'),false);
  assert(!t.events.some(x=>x.transition==='hand-raised'));assert.equal(h.handRaiseState,'open');assert(t.scheduled()>=2);
  assert(h.raiseHumanHand());assert.equal(h.recognizedResponder,'human');
 });
 await check('coordinated animate noun phrase beats verbs and unrelated things',async()=>{
  for(const first of ['mother','father','teacher']){
   const r=await rank(['His',first,'and','his','___','love','him.'],5-1);
   for(const good of ['cat','dog','son']){beats(r,good,'art',10);beats(r,good,'put',10);}assert(band(r).some(w=>['cat','dog','son','man'].includes(w)));
  }
 });
 await check('coordinated subject prefers plural/base agreement',async()=>{
  const r=await rank(['Mother','and','cat','_____','him.'],3);assert(get(r,'loves').contextMismatch);
  const q=await rank(['Mother','and','cat','____','him.'],3);beats(q,'love','wife',10);
 });
 await check('parallel coordinated clause supports visible quantifier in either direction',async()=>{
  for(const tokens of [['Not','all','Canadians','like','bread,','and','not','___','Japanese','like','rice.'],['Not','___','Canadians','like','bread,','and','not','all','Japanese','like','rice.']]){
   const r=await rank(tokens,tokens.indexOf('___'));assert(r.context.parallelWords.includes('all'));assert(band(r).includes('all'));assert(get(r,'all').rank<=2);beats(r,'all','the',5);
  }
 });
 await check('nonparallel visible words receive no repetition boost',async()=>{
  const r=await rank(['All','students','know','the','___','song.'],4);assert(!r.context.parallelWords.includes('all'));
  const q=await rank(['Not','all','boys','sing.','She','sees','___','girls.'],6);assert.equal(q.context.parallelWords.length,0);
 });
 await check('noun/name/verb lists strongly elevate coordinating conjunctions',async()=>{
  for(const tokens of [['Maria','bought','bread,','milk,','___','cheese.'],['apples,','oranges,','___','bananas.'],['Tom,','Mary,','___','Susan.'],['read,','write,','___','speak.']]){
   const r=await rank(tokens,tokens.indexOf('___'));assert(r.context.listCoordination);assert.equal(band(r)[0],'and');beats(r,'and','the',10);
  }
 });
 await check('infinitive copula before adjective is strongly supported',async()=>{
  for(const adjective of ['happy','ready','adorable','careful']){const r=await rank(['It','pays','to','__',adjective+'.'],3);assert.equal(band(r)[0],'be');beats(r,'be','of',20);}
 });
 await check('negative possession predicts plural quantifiers instead of participles',async()=>{
  for(const noun of ['brains','ideas','books']){const r=await rank(['You',"don't",'have','___',noun+'.'],3);beats(r,'any','got',10);assert(band(r).some(w=>['any','all','few'].includes(w)));}
 });
 await check('conditional clause opening uses comma and visible main-clause structure',async()=>{
  const r=await rank(['__','you',"don't",'have','money,','it','pays','to','wait.'],0);assert(r.context.conditionalOpening);assert(band(r).includes('if'));beats(r,'if','of',5);
  const q=await rank(['__','you','ready?'],0);assert(!q.context.conditionalOpening);
 });
 await check('live object compound no longer misreads maple as a fresh subject',async()=>{
  const r=await rank(['Not','all','Canadians','like','maple','_____.'],5);assert(get(r,'syrup').phraseWeight>1);assert(!get(r,'syrup').contextMismatch);beats(r,'syrup','saves',10);assert(band(r).includes('syrup'));
 });
 await check('other attested compound objects receive the same support',async()=>{
  for(const [prefix,pattern,word]of [['peanut','______','butter'],['ice','_____','cream']]){const r=await rank(['They','like',prefix,pattern+'.'],3);assert(get(r,word).phraseWeight>1);assert(band(r).includes(word));}
 });
 await check('strong phrase opportunity outranks unconstrained long proper name',async()=>{
  const slots=board(['They','like','maple','_____','at',{pattern:'__________',capital:true}]);
  const rs=await Promise.all(slots.map(async s=>h.rankHumanPlaytestPool(await h.buildAiCandidatePool(s))));
  assert(e.opportunity(rs[0]).score>e.opportunity(rs[1]).score);
 });
 await check('long capitalized blanks rise only after useful visible constraints',async()=>{
  const early=await rank(['Meet',{pattern:'_________',capital:true}],1),late=await rank(['Meet',{pattern:'Al_x_nd_r',capital:true}],1);
  assert(e.opportunity(early).reasons.longUnconstrainedName);assert(e.opportunity(late).score>e.opportunity(early).score);
 });
 await check('public endgame evidence contracts candidate bands',async()=>{
  const early=await rank(['____','___','____','_____','_____.'],4),late=await rank(['They','all','like','maple','s_r_p.'],4);
  assert(late.band.length<early.band.length);assert(late.convergence>early.convergence);assert(e.opportunity(late).score>e.opportunity(early).score);
 });
 await check('existing capitalized dictionary and loanword coverage; unsupported names are not invented',async()=>{
  for(const [tokens,i,w]of [[['Last',{pattern:'Sat_r__y',capital:true},'we','left.'],1,'saturday'],[['They','shop','at',{pattern:'C_s___',capital:true}],3,'costco'],[['Not','all',{pattern:'_an_d_a__',capital:true},'sing.'],2,'canadians'],[['The',{pattern:'Suk____i',capital:true},'Song'],1,'sukiyaki'],[['The','Sukiyaki',{pattern:'__n_',capital:true}],2,'song']]){
   const r=await rank(tokens,i);assert(get(r,w),w+' '+band(r));
  }
  const dict=h.vault4Dictionary.dictionary;assert(!e.lexicalClass('sakamoto',dict,2.5));assert(!e.lexicalClass('kyu',dict,2.5));
 });
 await check('punctuation remains exact and rejected contractions stay blocked',async()=>{
  const slots=board(["_on't",'worry.']),p=await h.buildAiCandidatePool(slots[0]);assert(!get(h.rankHumanPlaytestPool(p),'font'));
  h.recordWrongAiGuessForSlot(0,"don't");assert(!get(h.rankHumanPlaytestPool(p),"don't"));
  const r=await rank(['well-_____'],0);assert(!e.matchesToken('wellknown',r.state.slots[0]));
 });
 await check('short word and name garbage remains excluded',async()=>{
  const r=await rank(['_f.'],0);assert.deepEqual(band(r).sort(),['if','of']);
  const q=await rank(['She','loves',{pattern:'___',capital:true}],2);for(const w of ['tdm','pym','bf'])assert(!get(q,w));
 });
 await check('preparation, hand and submission guard never consult hidden answers or assistance',async()=>{
  board(['s_t.']);const t=turns();for(const k of ['vault2ByPuzzle','vault3ByPuzzle','vault5ByPuzzle','puzzleList','currentPuzzleText'])Object.defineProperty(h,k,{configurable:true,get(){throw Error('Forbidden '+k);}});
  h.getCorrectGuessChance=()=>{throw Error('CGA');};await h.prepareHumanPlaytestOpportunity('character1');await h.recognizeAiResponder('character1');assert.equal(t.submitted.length,1);
  assert(!JSON.stringify(t.events).includes('actualAnswer'));assert(!JSON.stringify(t.events).includes('isCorrect'));
 });
 await check('only AI observation display triples; thinking/recognition and normal delays unchanged',()=>{
  assert.equal(h.humanPlaytestGuessDisplayDelay(),900);assert.equal(h.humanPlaytestDelay(750),150);assert.equal(h.humanPlaytestDelay(5000),1000);
  h.location.search='';assert.equal(h.humanPlaytestGuessDisplayDelay(),1500);assert.equal(h.humanPlaytestDelay(750),750);assert.equal(h.humanPlaytestDelay(5000),5000);
 });
 console.log(n+' Repair 2 checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
