const assert=require('node:assert/strict');
const fixture=require('./fixture.cjs');

(async()=>{
 const {h,p,rank,board}=await fixture();
 const get=(r,w)=>r.ranked.find(c=>c.normalized===w);
 const supported=(r,frame)=>r.situations.find(s=>s.frame===frame&&s.matchState==='SUPPORTED');
 const goFrame=r=>supported(r,'GO_ADVERBIAL_COMPLEMENT');

 let r=await rank(['she','went','_______'],2);
 assert(goFrame(r),'GO/WENT movement-complement frame is public and supported');
 for(const w of ['outside','inside','away','back','upstairs','downstairs'])
  if(get(r,w))assert(!get(r,w).structuralConflict,w+' remains a legal movement completion');
 for(const w of ['players','problem','college','thought','million'])
  if(get(r,w))assert(get(r,w).structuralConflict,w+' is suppressed as a direct object after GO/WENT');

 r=await rank(['she','went','____'],2);
 assert(goFrame(r));assert(get(r,'home')&&!get(r,'home').structuralConflict,'bare HOME destination remains valid');
 for(const tokens of [['she','went','_______'],['they','went','_______']]) {
  r=await rank([...tokens.slice(0,2),tokens[2]],2);
  for(const w of ['fishing','running']) if(get(r,w))assert(!get(r,w).structuralConflict,w+' gerund complement remains valid');
 }
 for(const tokens of [['she','went','to','______'],['she','went','with','____']]) {
  r=await rank(tokens,3);assert(!get(r,'school')||!get(r,'school').structuralConflict);assert(!get(r,'John')||!get(r,'John').structuralConflict);
 }

 for(const prep of ['by','on','under']) {
  r=await rank([prep,'the','____'],2);
  assert(supported(r,'PREPOSITION_DETERMINER_HEAD'),'preposition + determiner + head frame for '+prep);
  assert(get(r,'door')&&!get(r,'door').structuralConflict,'noun head survives after '+prep+' the');
  if(get(r,'old'))assert(get(r,'old').structuralConflict,'adjective-only reading is suppressed as head');
 }
 r=await rank(['by','the','old','____'],3);
 assert(supported(r,'PREPOSITION_DETERMINER_HEAD'),'adjective modifier preserves nominal head inference');
 r=await rank(['by','the','___','door'],2);
 assert(!supported(r,'PREPOSITION_DETERMINER_HEAD'),'visible right noun prevents target from being forced to noun head');
 assert(!get(r,'old')||!get(r,'old').structuralConflict,'adjective before visible noun remains valid');

 r=await rank(['her','umbrella','__','the','door.'],2);
 assert(!r.situations.some(s=>s.situationId==='list/coordinated-noun-phrases'&&s.matchState==='SUPPORTED'),'ambiguous coordinator does not close the slot');
 assert(r.band.length>0,'ambiguous closed-family interpretation leaves an open fallback');
 r=await rank(['the','cat','__','the','dog.'],2);
 assert(supported(r,'undefined')||r.situations.some(s=>s.situationId==='list/coordinated-noun-phrases'&&s.matchState==='SUPPORTED'),'genuine coordination remains strongly recognized');
 assert(r.band.every(c=>['and','or','nor','but'].includes(c.normalized)),'genuine coordinator remains a closed band');

 const [slot]=board(['____.']);
 const state=h.getHumanPlaytestPublicState(slot);
 const empty=p.rank({state,candidates:[],visibleAnalyses:[null],vocabularyCount:0});
 assert.equal(p.opportunity(empty).score,0,'true absence still permits no-valid-slot');
 console.log('PASS bounded completion-slot Situation Pilot checks');
})().catch(e=>{console.error(e);process.exitCode=1;});
