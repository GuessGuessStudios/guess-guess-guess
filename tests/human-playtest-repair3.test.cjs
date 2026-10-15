const assert=require('node:assert/strict');
const {fixture}=require('./human-playtest-fixture.cjs');
(async()=>{
 const {h,e,rank,board,turns}=await fixture();let checks=0;
 const check=async(n,f)=>{await f();checks++;console.log('PASS',n);};
 const get=(r,w)=>r.ranked.find(c=>c.word===w),band=r=>Array.from(r.band,c=>c.word);
 const beats=(r,a,b,factor=10)=>assert(get(r,a)&&(!get(r,b)||get(r,a).weight>get(r,b).weight*factor),JSON.stringify({a,b,band:band(r),context:r.context,good:get(r,a),bad:get(r,b)}));
 await check('DO morphology favors ordinary bases over past/secondary readings',async()=>{
  for(const aux of ["Don't","Didn't","Doesn't"]){
   const r=await rank([aux,'_____.'],1);beats(r,'worry','found');assert(!band(r).includes('found'));
   const q=await rank([aux,'____.'],1);for(const w of ['find','know'])assert(!get(q,w).contextMismatch);
  }
 });
 await check('modal needs lexical continuation before object pronoun',async()=>{
  const r=await rank(['Nobody','_____','him.'],1);beats(r,'loves','would',100);assert(!band(r).includes('would'));
  const q=await rank(['Nobody','_____','help','him.'],1);assert(get(q,'would')&&!get(q,'would').contextMismatch);
 });
 await check('ordinary transitive verbs beat marginal noun-derived verbs',async()=>{
  for(const subject of ['Nobody','Someone','She']){const r=await rank([subject,'_____','him.'],1);for(const w of ['loves','knows','wants'])beats(r,w,'words',30);assert(!band(r).includes('words'));}
 });
 await check('quantifier plural object rejects finite verbs and names',async()=>{
  for(const [v,n]of [['have','books'],['have','ideas'],['have','problems'],['need','chairs']]){
   const r=await rank(['You',v,'___',n+'.'],2);for(const bad of ['god','run','had','sat'])beats(r,'any',bad);assert(band(r).some(w=>['any','few','all'].includes(w)));
   const q=await rank(['You',v,'____',n+'.'],2);assert(band(q).some(w=>['many','some'].includes(w)));
  }
 });
 await check('ordinary capitals cannot cross sentence boundary into a name slot',async()=>{
  const r=await rank(['____',{pattern:'___m___',capital:true},'Who','loves','him?'],1);
  // Actual sentence punctuation is the boundary, not capital letters alone.
  const q=await rank(['____',{pattern:'___m___.',capital:true},'Who','loves','him?'],1);assert(!get(q,'primary'));
  for(const length of [6,7]){const t=await rank(['Poor',{pattern:'_'.repeat(length)+'.',capital:true}],1);for(const w of ['primary','simple','normal'])assert(!get(t,w));assert(t.band.every(c=>e.nameFamiliarity(c.word)));}
 });
 await check('ordinary sentence-start adjectives remain available',async()=>{
  const r=await rank([{pattern:'______',capital:true},'ideas','help.'],0);assert(get(r,'simple'));assert(get(r,'normal'));
 });
 await check('singular personal-name fragments favor adjectives over quantifiers',async()=>{
  for(const name of ['Tom','John','Susan']){const r=await rank(['____',name+'.'],0);for(const bad of ['many','most','this'])beats(r,'poor',bad);assert(band(r).some(w=>['poor','dear'].includes(w)));}
 });
 await check('transitive predicate between subject and personal object',async()=>{
  for(const [subject,name]of [['She','Bob'],['He','Ann'],['Mary','Tom'],['They','Sam']]){
   const r=await rank([subject,'_____',name+'.'],1);assert(r.context.directObject);assert(!band(r).includes('seven'));if(subject!=='They')beats(r,'likes','seven',100);
  }
 });
 await check('parallel NOT quantifier has grammar support',async()=>{
  const r=await rank(['Not','all','Canadians','sing,','and','not','___','Japanese','dance.'],6);beats(r,'all','eat',100);assert(band(r).includes('all'));
  const q=await rank(['Not','___','Japanese','sing.'],1);assert(q.context.pluralObject);beats(q,'all','see',30);assert.equal(q.context.parallelWords.length,0);
 });
 await check('NOT plus verb continuation is not a forced quantifier',async()=>{
  const r=await rank(['Do','not','___','the','door.'],2);assert(!r.context.pluralObject);assert(get(r,'see')&&!get(r,'see').contextMismatch);
 });
 await check('bound forms lose standalone mass without rejecting compounds',async()=>{
  const r=await rank(['They','saw','m____.'],2);assert(get(r,'multi')?.evidence.some(x=>x.clue==='bound or marginal standalone form'));assert(!band(r).includes('multi'));
  const q=await rank(['well-_____.'],0);assert(q.ranked.every(c=>c.word.includes('-')));
 });
 await check('day and period modifiers dominate unrelated nouns',async()=>{
  for(const day of ['Monday','Friday','Saturday','summer','year']){const r=await rank(['____',day+',','we','left.'],0);for(const good of ['last','next','this'])beats(r,good,'west');assert(band(r).some(w=>['last','next','this'].includes(w)));}
 });
 await check('purchase object and entity strongly prefer location/source prepositions',async()=>{
  for(const place of ['Costco','London','Tokyo']){const r=await rank(['Maria','bought','milk','__',place+'.'],3);beats(r,'at','go',100);assert(band(r).includes('at'));}
  const q=await rank(['She','bought','bread,','cheese,','and','milk','____','London.'],6);assert(band(q).includes('from'));
 });
 await check('movement uses TO rather than purchase/location rule',async()=>{
  for(const verb of ['went','walked','drove']){const r=await rank(['They',verb,'__','Tokyo.'],2);beats(r,'to','at',100);assert.equal(band(r)[0],'to');}
 });
 await check('static location verbs prefer ordinary preposition family',async()=>{
  for(const verb of ['live','stay','sit']){const r=await rank(['They',verb,'__','the','house.'],2);beats(r,'at','go');assert(band(r).some(w=>['in','at','on','by'].includes(w)));}
 });
 await check('unsupported and stale opportunities still exit without a stranded hand',async()=>{
  board([{pattern:'Qzxqzxqzx___',capital:true}]);const t=turns();assert.equal(await h.prepareHumanPlaytestOpportunity('character1'),false);assert(!t.events.some(x=>x.transition==='hand-raised'));assert(h.raiseHumanHand());
 });
 await check('punctuation and short-name garbage remain hard constraints',async()=>{
  const r=await rank(["_on't",'worry.'],0);assert(!get(r,'font'));const q=await rank(['_f.'],0);assert.deepEqual(band(q).sort(),['if','of']);
  const p=await rank(['She','loves',{pattern:'___',capital:true}],2);for(const w of ['tdm','pym'])assert(!get(p,w));
 });
 await check('hidden-answer traps and timing survive Repair 3',async()=>{
  board(['s_t.']);const t=turns();for(const k of ['vault2ByPuzzle','vault3ByPuzzle','vault5ByPuzzle','currentPuzzleText','puzzleList'])Object.defineProperty(h,k,{configurable:true,get(){throw Error('Forbidden '+k);}});
  h.getCorrectGuessChance=()=>{throw Error('CGA');};await h.prepareHumanPlaytestOpportunity('character2');await h.recognizeAiResponder('character2');assert.equal(t.submitted.length,1);
  assert.equal(h.humanPlaytestGuessDisplayDelay(),900);assert.equal(h.humanPlaytestDelay(750),150);h.location.search='';assert.equal(h.humanPlaytestGuessDisplayDelay(),1500);assert.equal(h.humanPlaytestDelay(750),750);
 });
 console.log(checks+' Repair 3 language and lifecycle checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
