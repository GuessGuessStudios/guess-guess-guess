const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 const {h,e,p,rank,board,turns}=await require('./fixture.cjs')();let checks=0;
 const check=async(n,f)=>{await f();checks++;console.log('PASS '+n);};
 const get=(r,w)=>r.ranked.find(c=>c.word===w),band=r=>Array.from(r.band,c=>c.word);
 const good=(r,w)=>assert(get(r,w)&&!get(r,w).hardConflict&&!get(r,w).contextMismatch,w+' incompatible');
 const match=(r,id)=>r.situations.find(m=>m.situationId===id);
 await check('1 public snapshot excludes temporary previews and is frozen',()=>{
  const [slot]=board(['his','_____','and','___','cat.']);const raw=h.getHumanPlaytestPublicState(slot),before=h.GGGPublicBoard.snapshot(raw);
  h.groups[1].querySelectorAll().forEach(b=>{b.textContent='x';b.dataset.wrongSnapshotLetter='x';});
  assert.equal(h.GGGPublicBoard.snapshot(h.getHumanPlaytestPublicState(slot)).key,before.key);assert(Object.isFrozen(before.slots[1].letters));
  assert.equal(before.slots[1].length,5);assert.equal(before.slots[1].letters[0].visible,null);
 });
 await check('2 unknown positions never become adjacent anchors',async()=>{
  const r=await rank(['his','_____','and','___','cat.'],3);assert.equal(r.board.slots.length,5);assert.equal(match(r,'noun-phrase/parallel-determiner').matchState,'UNKNOWN');assert.equal(r.board.slots[1].solved,false);
 });
 await check('3 stale board cannot submit after asynchronous preparation',async()=>{
  const [slot]=board(['s_t.']);const t=turns();const pool=await h.buildAiCandidatePool(slot),c=h.chooseFinalAiCandidate(pool,1);
  slot.group.querySelectorAll()[1].dataset.revealed='true';slot.group.querySelectorAll()[1].textContent='a';
  assert.equal(h.humanPlaytestCandidateProblem(pool,c),'stale-board');assert.equal(t.submitted.length,0);
 });
 for(const [n,tokens]of [[4,['bread,','cheese,','___','milk.']],[5,['_____,','cheese,','___','milk.']],[6,['Tom,','Mary,','___','Susan.']],[6,['red,','green,','___','blue.']],[6,['run,','jump,','___','swim.']]])await check(n+' supported list '+tokens.join(' '),async()=>{
  const r=await rank(tokens,2);assert.equal(match(r,'list/final-coordinator').matchState,'SUPPORTED');assert(band(r).includes('and'));assert(r.band.every(c=>['and','or','nor','but'].includes(c.word)));
  if(n===5){assert(match(r,'list/final-coordinator').unknownRequirements.length);assert(!r.board.slots[0].solved);}
 });
 await check('6b migrated list without final comma',async()=>{const r=await rank(['bread,','cheese','___','milk.'],2);assert.equal(match(r,'list/final-coordinator').matchState,'SUPPORTED');assert(band(r).includes('and'));assert(r.band.every(c=>['and','but','nor'].includes(c.word)));});
 await check('7 commas outside adjacent list structure are negative controls',async()=>{
  for(const [t,i]of [[['Yesterday,','she','___','him.'],2],[['After','dinner,','we','___','home.'],3]])assert.notEqual(match(await rank(t,i),'list/final-coordinator').matchState,'SUPPORTED');
 });
 await check('8 list structural conflict beats frequency',async()=>{
  const r=await rank(['bread,','cheese,','___','milk.'],2);for(const w of ['met','got','saw','was','ran','are']){assert(get(r,w).structuralConflict);assert(!band(r).includes(w));}
 });
 await check('9 list opportunity precedes unconstrained long name',async()=>{
  const slots=board(['bread,','cheese,','___','milk','at',{pattern:'__________',capital:true}]);const rs=[];for(const s of slots)rs.push(h.rankHumanPlaytestPool(await h.buildAiCandidatePool(s)));
  assert(p.opportunity(rs[0]).relativePriority>p.opportunity(rs[1]).relativePriority);
 });
 await check('10-12 repeated possessive support and article alternatives',async()=>{
  for(const [poss,noun,tail]of [['his','mother','cat'],['her','father','dog'],['my','brother','friend'],['our','teacher','coach']]){
   const r=await rank([poss,noun,'and','_'.repeat(poss.length),tail+'.'],3);assert.equal(band(r)[0],poss);good(await rank([poss,noun,'and','___',tail+'.'],3),'the');assert(band(await rank([poss,noun,'and','_',tail+'.'],3)).includes('a'));
  }
 });
 await check('13-15 number readings, ANY counterexamples, no tense-to-noun contamination',async()=>{
  for(const [quant,w]of [['few','mothers'],['two','cats'],['ten','books'],['two','children']])good(await rank([quant,'_'.repeat(w.length)+'.'],1),w);
  for(const [quant,w]of [['few','mother'],['two','cat'],['ten','book'],['two','said']])assert(get(await rank([quant,'_'.repeat(w.length)+'.'],1),w).hardConflict);
  for(const w of ['book','idea'])good(await rank(['any','____.'],1),w);
 });
 await check('16-17 direct and optional transitive readings',async()=>{
  good(await rank(['Nobody','_____','him.'],1),'loves');good(await rank(['She','_____','Tom.'],1),'knows');good(await rank(['Who','______','him?'],1),'bathes');good(await rank(['She','____','Tom.'],1),'sees');good(await rank(['She','______','Susan.'],1),'visits');
  const r=await rank(['Not','all','Canadians','____','maple','syrup.'],3);good(r,'like');for(const w of ['come','care'])assert(get(r,w).hardConflict);
 });
 await check('18-20 complement requirements and visible particles',async()=>{
  const r=await rank(['Nobody','_____','him.'],1);for(const w of ['looks','lives','cares'])assert(get(r,w).hardConflict);
  for(const [w,prep]of [['looks','at'],['looks','for'],['lives','with'],['lives','near'],['cares','for'],['cares','about']])good(await rank(['Nobody','_____',prep,'him.'],1),w);
  good(await rank(['Nobody','_____','him','over.'],1),'looks');
 });
 await check('21 unknown continuation cannot become a direct-object hard conflict',async()=>{
  const r=await rank(['Nobody','_____','him','____.'],1);assert.equal(match(r,'verb/complement').matchState,'UNKNOWN');assert(!get(r,'looks').hardConflict);
 });
 await check('22 overlapping number and coordination coexist, order independent',async()=>{
  const r=await rank(['his','mother','and','___','cat.'],3);assert.equal(r.situations.filter(m=>m.matchState==='SUPPORTED').length,2);
  good(r,'his');assert(get(r,'two').hardConflict);const c={word:'his',analysis:h.getHumanPlaytestAnalysis('his')};
  const outcomes=r.situations.map(m=>p.assess(c,m).outcome).sort();assert.deepEqual(outcomes,r.situations.slice().reverse().map(m=>p.assess(c,m).outcome).sort());
 });
 await check('22b insufficient coordinator evidence remains absent',async()=>{const r=await rank(['Yesterday,','she','___','him.'],2);assert(!r.situations.some(m=>m.situationId==='list/coordinated-noun-phrases'&&m.matchState==='SUPPORTED'));});
 await check('23 candidate evidence identifies situation and public anchors',async()=>{
  const r=await rank(['bread,','cheese,','___','milk.'],2),c=get(r,'and');assert(c.evidence.some(t=>t.situationId==='list/final-coordinator'&&t.publicAnchors.some(a=>a.slot===1&&a.pattern==='cheese')));
 });
 await check('24 singleton vocabulary does not create confidence',async()=>{
  const [slot]=board(['____.']),state=h.getHumanPlaytestPublicState(slot);
  const r=p.rank({state,candidates:[{word:'book',zipf:5,lexicalClass:'ordinary',analysis:h.getHumanPlaytestAnalysis('book')}],visibleAnalyses:[null],vocabularyCount:1});
  assert.equal(r.evidenceStrength,0);assert.equal(r.coverage.status,'PARTIAL_LEXICON');assert(!r.coverage.exhaustive);assert(p.opportunity(r).score<0.2);
 });
 await check('24b absent valency inventory does not exclude a legitimate verb reading',async()=>{const r=await rank(['Nobody','_____','at','him.'],1);assert(band(r).includes('aimed'));assert(get(r,'aimed').evidence.some(t=>t.situationId==='verb/complement'&&t.outcome==='UNKNOWN'));});
 await check('25 situation proposes missing closed-class candidates with exact filtering',async()=>{
  const r=await rank(['bread,','cheese,','___','milk.'],2);
  const visible=r.state.slots.map(s=>s.solved?h.getHumanPlaytestAnalysis(e.tokenAt(s)):null);
  const q=p.rank({state:r.state,candidates:[],visibleAnalyses:visible,lexical:w=>({word:w,zipf:5,lexicalClass:'ordinary',analysis:h.getHumanPlaytestAnalysis(w)})});assert(band(q).includes('and'));assert(!band(q).includes('or'));
 });
 await check('26 128 seeded choices stay in credible grammatical band',async()=>{
  const r=await rank(['bread,','cheese,','___','milk.'],2),seen=new Set();for(let n=1;n<=128;n++){const c=p.choose(r,Math.imul(n,2654435761),'character1',n);assert(['and','but','nor'].includes(c.word));seen.add(c.word);}assert(seen.size>1);
 });
 await check('27 rejections are slot specific and cannot repeat',async()=>{
  const slots=board(['bread,','cheese,','___','milk','and','___.']);h.recordWrongAiGuessForSlot(2,'and');const r=h.rankHumanPlaytestPool(await h.buildAiCandidatePool(slots[0]));assert(!get(r,'and'));assert(!h.getHumanPlaytestPublicState(slots[1]).rejectedWordsBySlot[5].includes('and'));
 });
 await check('28 punctuation exactness survives proposals and ranking',async()=>{
  const r=await rank(["_on't",'worry.'],0);assert(!get(r,'font'));assert(r.ranked.every(c=>c.word.includes("'")));
  const q=await rank(['well-_____.'],0);assert(q.ranked.every(c=>c.word.includes('-')));
 });
 await check('29 capital/name filtering is retained',async()=>{
  const r=await rank(['Poor',{pattern:'_______',capital:true}],1);assert(!get(r,'primary'));assert(r.band.every(c=>e.nameFamiliarity(c.word)));
 });
 await check('31 candidate exists and revalidates before every student raises a hand',async()=>{
  for(const actor of ['character1','character2','character3','character4']){board(['s_t.']);const t=turns();await h.prepareHumanPlaytestOpportunity(actor);assert(t.events.some(e=>e.type==='candidate-revalidated'&&e.phase==='before-hand'));await h.recognizeAiResponder(actor);assert.equal(t.submitted.length,1);assert(t.events.findIndex(e=>e.type==='candidate-selected')<t.events.findIndex(e=>e.transition==='hand-raised'));}
 });
 await check('32 unsupported board abstains and human turn remains available',async()=>{
  board([{pattern:'Qzxqzxqzx___',capital:true}]);const t=turns();assert.equal(await h.prepareHumanPlaytestOpportunity('character1'),false);assert(!t.events.some(e=>e.transition==='hand-raised'));assert(h.raiseHumanHand());
 });
 await check('33 poisoned hidden answers and puzzle identity cannot affect provider',async()=>{
  const slots=board(['bread,','cheese,','___','milk.']);const t=turns();// installObservations already installs nonconfigurable throwing hidden-letter getters.
  for(const group of h.groups)for(const b of group.querySelectorAll())assert.throws(()=>b.dataset.letter);
  for(const k of ['vault2ByPuzzle','vault3ByPuzzle','vault5ByPuzzle','currentPuzzleText','currentPuzzleIndex','puzzleList'])Object.defineProperty(h,k,{configurable:true,get(){throw Error('Forbidden '+k);}});
  h.getCorrectGuessChance=()=>{throw Error('CGA');};const a=h.rankHumanPlaytestPool(await h.buildAiCandidatePool(slots[0]));assert(band(a).includes('and'));await h.prepareHumanPlaytestOpportunity('character2');await h.recognizeAiResponder('character2');assert.equal(t.submitted.length,1);
 });
 await check('34-35 provider switch requires Human Playtest, baseline remains selected otherwise',()=>{
  assert.equal(h.GGGCandidateProviders.get('?humanPlaytestMode=1').version,e.POLICY.version);assert.equal(h.GGGCandidateProviders.get('?situationPilot=1').version,e.POLICY.version);assert.equal(h.GGGCandidateProviders.get('').version,e.POLICY.version);
 });
 await check('36 900ms guess display and 5x thinking remain unchanged',()=>{
  assert.equal(h.humanPlaytestGuessDisplayDelay(),900);assert.equal(h.humanPlaytestDelay(750),150);h.location.search='';assert.equal(h.humanPlaytestGuessDisplayDelay(),1500);assert.equal(h.humanPlaytestDelay(750),750);
 });
 await check('candidate readings preserve FIND past and FOUND base separately',()=>{const r=p.readings({word:'found',analysis:h.getHumanPlaytestAnalysis('found')});assert(r.some(r=>r.lemma==='find'&&r.form==='inflected'));assert(r.some(r=>r.lemma==='found'&&r.form==='base'));});
 console.log(checks+' focused pilot checks passed (hint stress and baseline equality run separately).');
})().catch(e=>{console.error(e);process.exitCode=1;});
