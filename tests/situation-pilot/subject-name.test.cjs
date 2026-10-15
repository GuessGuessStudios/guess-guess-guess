const assert=require('node:assert/strict');
const fixture=require('./fixture.cjs');

(async()=>{
 const {h,p,rank,board}=await fixture();
 const get=(r,w)=>r.ranked.find(c=>c.normalized===w);
 const inBand=(r,w)=>r.band.some(c=>c.normalized===w);
 const frame=(r)=>r.situations.find(s=>s.frame==='SUBJECT_BEFORE_FINITE');
 const custom=(tokens,candidates)=>{
  const slots=board(tokens);
  const target=slots.find(s=>s.slotIndex===tokens.findIndex(t=>String(t).includes('_')));
  const state=h.getHumanPlaytestPublicState(target);
  const visible=tokens.map(t=>{const raw=typeof t==='string'?t:t.pattern;return raw.includes('_')?null:h.getHumanPlaytestAnalysis(raw.replace(/[^A-Za-z']/g,''));});
  return p.rank({state,candidates,visibleAnalyses:visible,vocabularyCount:candidates.length});
 };
 const candidate=(word,proper=false,zipf=5)=>({word,normalized:word,zipf,lexicalClass:proper?'given-name':'ordinary',properNoun:proper,nameFamiliarity:proper?0.7:0,analysis:h.getHumanPlaytestAnalysis(word,proper)});
 const assertSubject=(r)=>assert.equal(frame(r)?.matchState,'SUPPORTED');
 const assertSuppressed=(r,w)=>{assert(get(r,w),w+' should be retrieved');assert(get(r,w).structuralConflict,w+' should conflict structurally');assert(!inBand(r,w),w+' should not enter the band');};

 let r=await rank(['____','left','early.'],0);
 assertSubject(r);
 for(const w of ['dogs','rain','mark','who','most','more']) if(get(r,w)) assert(!get(r,w).structuralConflict,w+' legitimate subject reading survives');
 for(const w of ['lite','only','must']) if(get(r,w)) assertSuppressed(r,w);

 r=await rank(['____','left','her','umbrella.'],0);
 assertSubject(r);assert(frame(r).personEvidence);
 const name=get(r,'mark'),noun=get(r,'rain');
 if(name&&noun) assert(name.weight>noun.weight,'person/name evidence is soft ranking support');

 for(const tokens of [['____','bark.'],['____','stopped.'],['the','____','left','the','station.']]) {
  r=await rank(tokens,tokens.findIndex(t=>String(t).includes('_')));
  if(r.situations.some(s=>s.frame==='SUBJECT_BEFORE_FINITE')) assertSubject(r);
 }
 for(const tokens of [['most','left','early.'],['more','arrived','later.']]) {
  r=await rank(['____',...tokens.slice(1)],0);assertSubject(r);
  assert(!get(r,tokens[0])||!get(r,tokens[0]).structuralConflict,tokens[0]+' remains a subject reading');
 }
 for(const tokens of [['who','left?'],['what','happened?']]) {
  r=await rank(['____',tokens[1]],0);assertSubject(r);assert(!get(r,tokens[0])||!get(r,tokens[0]).structuralConflict,tokens[0]+' remains a WH subject');
 }
 for(const tokens of [['was','____','happy?'],['did','____','leave?'],['can','____','swim?']]) {
  r=await rank(tokens,1);assert(!r.situations.some(s=>s.frame==='SUBJECT_BEFORE_FINITE'),'auxiliary inversion not recast as declarative subject-before-finite');
 }
 r=await rank(['his','____','was','happy.'],1);assert(!r.situations.some(s=>s.frame==='SUBJECT_BEFORE_FINITE'));
 r=await rank(['____','running','helps.'],0);assert(!get(r,'good')||get(r,'good').structuralConflict===true||!frame(r),'gerund control remains bounded');

 r=await rank(['____','left','her','umbrella','by','the','door','before','she','went','outside.'],0);
 assertSubject(r);assert.equal(frame(r).personEvidence,'possessive-before-nominal');
 for(const w of ['lite','only','must']) if(get(r,w)) assertSuppressed(r,w);
 assert(r.band.length>1,'plausible subject band remains stochastic');

 r=custom(['____','left','her','umbrella.'],[candidate('mark',true,4),candidate('rain',false,5),candidate('good'),candidate('only'),candidate('must')]);
 assertSubject(r);assert(!get(r,'mark').structuralConflict);assert(get(r,'mark').weight>get(r,'rain').weight,'person/name evidence is soft and bounded');
 r=custom(['____','stopped.'],[candidate('mark',true,4),candidate('rain',false,5)]);
 assertSubject(r);assert(!get(r,'mark').structuralConflict&&!get(r,'rain').structuralConflict,'sentence-initial capitalization does not force a name');

 console.log('PASS bounded subject/person-name Situation Pilot checks');
})().catch(e=>{console.error(e);process.exitCode=1;});
