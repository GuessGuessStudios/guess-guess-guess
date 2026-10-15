const assert=require('node:assert/strict');
const {fixture}=require('./human-playtest-fixture.cjs');
(async()=>{
 const {h,e,rank,board,turns}=await fixture();let checks=0;
 const check=async(n,f)=>{await f();checks++;console.log('PASS',n);};
 const get=(r,w)=>r.ranked.find(c=>c.word===w),band=r=>Array.from(r.band,c=>c.word);
 const compatible=(r,w)=>assert(get(r,w)&&!get(r,w).hardConflict&&!get(r,w).contextMismatch,JSON.stringify({w,entry:get(r,w),context:r.context}));
 await check('direct transitive and optional-transitive verbs remain grammatical',async()=>{
  for(const [pattern,words]of [['_____',['loves','knows']],['______',['bathes','visits']]]){const r=await rank(['Who',pattern,'him?'],1);for(const w of words)compatible(r,w);}
 });
 await check('LOOK LIVE CARE require their visible complements before randomness',async()=>{
  const r=await rank(['Nobody','_____','him.'],1);for(const w of ['looks','lives','cares']){assert(get(r,w).hardConflict);assert(!band(r).includes(w));}
 });
 await check('prepositional and particle counterexamples preserve legitimate verb readings',async()=>{
  for(const [prep,w]of [['at','looks'],['for','looks'],['with','lives'],['near','lives'],['about','cares'],['for','cares']])compatible(await rank(['Nobody','_____',prep,'him.'],1),w);
  compatible(await rank(['Nobody','_____','him','over.'],1),'looks');
 });
 await check('visible nominal object invokes valency without an object pronoun',async()=>{
  const r=await rank(['Not','all','Canadians','____','maple','syrup.'],3);compatible(r,'like');for(const w of ['came','care']){assert(get(r,w).hardConflict);assert(!band(r).includes(w));}
 });
 await check('closed list slot excludes finite verbs even with a hidden first item',async()=>{
  for(const first of ['bread,','_____,']){const r=await rank([first,'cheese,','___','milk.'],2);assert.equal(band(r)[0],'and');assert(r.band.every(c=>['and','or','nor','but'].includes(c.word)));for(const w of ['met','got','saw','was','ran','are'])assert(!band(r).includes(w));}
 });
 await check('name adjective and verb list variants use the same coordinator resolver',async()=>{
  for(const t of [['Tom,','Mary,','___','Susan.'],['red,','green,','___','blue.'],['run,','jump,','___','swim.']]){const r=await rank(t,2);assert.equal(band(r)[0],'and');}
 });
 await check('comma outside a list does not force a coordinator',async()=>{
  const r=await rank(['Yesterday,','she','___','him.'],2);assert(!r.context.listCoordination);assert(!r.context.closedFamily);compatible(r,'met');
 });
 await check('parallel possessives concentrate support without ungrammatical alternatives',async()=>{
  for(const [poss,noun,other]of [['his','mother','cat'],['her','father','dog'],['my','brother','friend']]){
   const r=await rank([poss,noun,'and','_'.repeat(poss.length),other,'sleep.'],3);assert(r.context.parallelWords.includes(poss));assert.equal(band(r)[0],poss);
   const q=await rank([poss,noun,'and','___',other,'sleeps.'],3);assert(get(q,'the')&&!get(q,'the').hardConflict);
  }
 });
 await check('quantifier and numeral number agreement excludes singular-only nouns',async()=>{
  for(const [quant,good,bad]of [['few','people','mother'],['two','cats','book'],['ten','books','woman']]){const r=await rank([quant,'_'.repeat(good.length)+'.'],1);compatible(r,good);const q=await rank([quant,'_'.repeat(bad.length)+'.'],1);assert(get(q,bad).hardConflict);assert(!band(q).includes(bad));}
  compatible(await rank(['two','________.'],1),'children');
 });
 await check('singular ANY is allowed; singular determiners and plural numerals stay distinct',async()=>{
  for(const w of ['book','idea'])compatible(await rank(['any','____.'],1),w);
  const r=await rank(['___','mother','sleeps.'],0);for(const w of ['few','ten','two'])assert(get(r,w).hardConflict);
 });
 await check('DO plus lexical HAVE does not admit HAVE-GOT phrase as perfect',async()=>{
  for(const tail of ['_____.','brains.']){const r=await rank(['You',"don't",'have','___',tail],3);assert(get(r,'got').hardConflict);assert(!band(r).includes('got'));}
 });
 await check('question and declarative WH cues retain a free-relative counterexample',async()=>{
  const q=await rank(['____','did','she','see?'],0);compatible(q,'what');
  const d=await rank(['____','Monday,','she','left.'],0);assert(get(d,'what').contextMismatch);assert(!band(d).includes('what'));
  compatible(await rank(['____','happened','next','surprised','me.'],0),'what');
 });
 await check('AND is a conjunction and may open a sentence without a comma',async()=>{
  const a=h.getHumanPlaytestAnalysis('and');assert(a.roles.includes('conjunction'));assert(!a.roles.includes('preposition'));
  const r=await rank(['___','I','told','him','the','truth.'],0);assert(get(r,'and').evidence.some(x=>x.clue==='isolated opening has no preceding coordination'));
  const q=await rank(['He','asked.','___','I','told','him','the','truth.'],2);assert(!get(q,'and').hardConflict);assert(!get(q,'and').evidence.some(x=>x.clue==='isolated opening has no preceding coordination'));
 });
 await check('SBT XRIVE and prose abbreviations cannot enter through dictionary or morphology',async()=>{
  const dict=h.vault4Dictionary.dictionary;for(const w of ['sbt','xrive','com'])assert.equal(e.lexicalClass(w,dict,7),null);
  for(const [p,ws]of [['___',['sbt','com']],['_____',['xrive']]]){const r=await rank([p+'.'],0);for(const w of ws)assert(!get(r,w));}
  assert(!e.extraWords().includes('xrive'));assert(h.getHumanPlaytestAnalysis('xrive').roles.length===0);
 });
 await check('combining forms lose standalone weight while LITE remains a legitimate adjective',async()=>{
  const r=await rank(['____.'],0);assert(get(r,'cine').evidence.some(x=>x.clue==='bound or marginal standalone form'));assert(!band(r).includes('cine'));
  const q=await rank(['____','beer.'],0);assert(get(q,'lite'));assert(!get(q,'lite').hardConflict);
  const p=await rank(['well-_____.'],0);assert(p.band.every(c=>c.word.includes('-')));
 });
 await check('purchase movement and LOOK preposition families promote appropriate small words',async()=>{
  for(const [tokens,word]of [[['She','bought','milk','__','London.'],'at'],[['They','went','__','Tokyo.'],'to'],[['They','looked','__','Tom.'],'at']]){const r=await rank(tokens,3-(tokens[1]==='bought'?0:1));assert(band(r).includes(word));assert(!band(r).includes('go'));}
 });
 await check('purchase-location names get a contextual penalty, person-directed AT does not',async()=>{
  const r=await rank(['She','bought','milk','at',{pattern:'___',capital:true}],4);
  assert(get(r,'tom')?.evidence.some(x=>x.clue==='purchase location favors place/entity over personal name'));
  const q=await rank(['She','looked','at',{pattern:'___',capital:true}],3);assert(get(q,'tom'));assert(!get(q,'tom').evidence.some(x=>x.clue==='purchase location favors place/entity over personal name'));
 });
 await check('semantic list evidence boosts FOOD but mixed lists are not grammar errors',async()=>{
  const r=await rank(['She','bought','bread,','____,','and','milk.'],3);assert(get(r,'rice').evidence.some(x=>x.clue==='soft semantic parallelism within sentence'));
  assert(get(r,'soap')&&!get(r,'soap').hardConflict);
 });
 await check('parallel clauses support quantifiers and soft object-class evidence',async()=>{
  const r=await rank(['Not','all','Canadians','like','bread,','and','not','___','Japanese','like','rice.'],7);assert(band(r).includes('all'));assert(!band(r).includes('see'));
  const q=await rank(['They','like','bread,','and','we','like','____.'],6);assert(get(q,'rice').evidence.some(x=>x.clue==='soft semantic parallelism within sentence'));assert(!get(q,'soap').hardConflict);
 });
 await check('closed-class opportunity outranks a long unconstrained name',async()=>{
  const slots=board(['bread,','cheese,','___','milk','at',{pattern:'__________',capital:true}]);const rs=await Promise.all(slots.map(async s=>h.rankHumanPlaytestPool(await h.buildAiCandidatePool(s))));assert(e.opportunity(rs[0]).score>e.opportunity(rs[1]).score);
 });
 await check('all required function words are retrievable with correct basic roles',async()=>{
  const families={conjunction:'and or but',preposition:'at in on to of for from with',possessiveDeterminer:'his her my your our their',article:'the a an',determiner:'any all some',adverb:'not'};
  for(const [role,words]of Object.entries(families))for(const w of words.split(' ')){const r=await rank(['_'.repeat(w.length)+'.'],0);assert(get(r,w),w);assert(h.getHumanPlaytestAnalysis(w).roles.includes(role),w+' '+role);}
 });
 await check('prepared-hand lifecycle, punctuation, names, secrecy and timing remain intact',async()=>{
  board([{pattern:'Qzxqzxqzx___',capital:true}]);const t=turns();assert.equal(await h.prepareHumanPlaytestOpportunity('character1'),false);assert(!t.events.some(x=>x.transition==='hand-raised'));
  const p=await rank(["_on't",'worry.'],0);assert(!get(p,'font'));const q=await rank(['Poor',{pattern:'_______',capital:true}],1);assert(!get(q,'primary'));
  board(['s_t.']);const live=turns();for(const k of ['vault2ByPuzzle','vault3ByPuzzle','vault5ByPuzzle','currentPuzzleText','puzzleList'])Object.defineProperty(h,k,{configurable:true,get(){throw Error('Forbidden '+k);}});h.getCorrectGuessChance=()=>{throw Error('CGA');};await h.prepareHumanPlaytestOpportunity('character2');await h.recognizeAiResponder('character2');assert.equal(live.submitted.length,1);
  assert.equal(h.humanPlaytestGuessDisplayDelay(),900);assert.equal(h.humanPlaytestDelay(750),150);h.location.search='';assert.equal(h.humanPlaytestGuessDisplayDelay(),1500);assert.equal(h.humanPlaytestDelay(750),750);
 });
 console.log(checks+' Repair 4 language and lifecycle checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
