// Three local construction families only. This factory receives public snapshots
// and general lexical services; it has no controller, DOM, puzzle or answer input.
(function(global){
 'use strict';
 const VERSION='situation-pilot-1';
 const norm=w=>String(w||'').toLowerCase();
 const has=(a,...rs)=>rs.some(r=>a?.roles?.includes(r));
 const coordinators=['and','or','nor','but'];
 const possessives='my your his her its our their'.split(' ');
 const determiners=[...possessives,...'a an the this that these those some any no each every all both few many several one two three four five six seven eight nine ten'.split(' ')];
 const subjectQuantifiers='all both few many more most several some any none enough either neither each everyone everybody someone somebody anyone anybody nobody'.split(' ');
 const bareMovementWords=new Set('home away back inside outside upstairs downstairs here there somewhere nowhere forward backward'.split(' '));
 const plural='all few many several both two three four five six seven eight nine ten these those'.split(' ');
 const singular='a an one each every this that'.split(' ');
 const STRONG=0.85;
 function create(engine){
  const attention=new Map();
  function match(board,analyses){
   const i=board.targetSlot,s=board.slots[i];
   const local=j=>board.slots[j]?.sentence===s.sentence&&board.slots[j]?.clause===s.clause;
   const a=j=>local(j)&&board.slots[j].solved?analyses[j]:null;
   const w=j=>a(j)?engine.tokenAt(board.slots[j]).toLowerCase():'';
   const nominal=j=>has(a(j),'noun','properNoun','objectPronoun','subjectPronoun');
   const anchor=j=>local(j)?{slot:j,pattern:engine.pattern?engine.pattern(board.slots[j]):engine.tokenAt(board.slots[j]),solved:board.slots[j].solved,trailing:board.slots[j].trailing}:null;
   const matches=[];
   const add=(id,state,strength,positions,role,extra={})=>matches.push({situationId:id,family:id.split('/')[0],targetSlot:i,matchState:state,evidenceStrength:strength,
    publicAnchors:[...new Set(positions)].map(anchor).filter(Boolean),unknownRequirements:[],contradictions:[],candidateRole:role,mayPropose:state==='SUPPORTED',...extra});
   const share=(j,k)=>[['noun','properNoun'],['adjective'],['verb','baseVerb']].some(rs=>has(a(j),...rs)&&has(a(k),...rs));
   // Two adjacent item boundaries, never a comma elsewhere in the sentence.
   const commas=local(i-2)&&local(i+1)&&/,/.test(board.slots[i-2].trailing)&&!/[.!?;:]/.test(board.slots[i-1].trailing);
   if(commas&&share(i-1,i+1))add('list/final-coordinator','SUPPORTED',0.95,[i-2,i-1,i+1],'coordinator',{candidateFamily:coordinators,
    unknownRequirements:board.slots[i-2].solved?[]:['earlier item identity unknown; punctuation position is sufficient']});
   else if(commas)add('list/final-coordinator','UNKNOWN',0.4,[i-2,i-1,i+1],'coordinator',{unknownRequirements:['parallel item readings unavailable']});
   else add('list/final-coordinator','CONTRADICTED',0,[i-2,i-1,i+1],'coordinator',{contradictions:['adjacent list boundaries absent']});
   // Bare pairs are ambiguous with predicates; their evidence must stay soft.
   const predicateGap = a(i-2) && has(a(i-2),'subjectPronoun','properNoun') && a(i-1)?.primaryVerb && a(i+1)?.primaryVerb;
   if(!commas&&!predicateGap&&share(i-1,i+1)&&!/[.!?,;:]/.test(board.slots[i-1]?.trailing||''))
    add('list/binary-coordinator','SUPPORTED',0.55,[i-1,i+1],'coordinator',{candidateFamily:coordinators,unknownRequirements:['binary coordination versus predicate attachment']});
   const coordination=['and','or','but'].includes(w(i-1));
   const sentenceStart=i===0||board.slots[i-1]?.sentence!==s.sentence;
   const sentenceQuestion=board.slots.some((slot,j)=>slot.sentence===s.sentence&&/\?/.test(slot.trailing||''));
   const initialSubject=nominal(i+1)||
    (has(a(i+1),'article','determiner','possessiveDeterminer')&&has(a(i+2),'noun','properNoun'));
   const negativeAuxiliary=has(a(i-1),'doAuxiliary','modal')&&/n't$/.test(w(i-1));
   if(negativeAuxiliary&&!has(a(i-1),'auxiliary')) {
    // Defensive guard for lexical resources that expose only the auxiliary
    // subtype. The public word itself remains the decisive evidence.
   }
   if(negativeAuxiliary&&!has(a(i),'subjectPronoun','objectPronoun','noun','properNoun','determiner','article','possessiveDeterminer'))
    add('verb/complement','SUPPORTED',0.96,[i-1,i],'predicate',{frame:'AUXILIARY_MODAL',targetRole:'predicate',requiredForm:'baseVerb',auxiliaryComplement:true});
   const targetPattern=engine.pattern?engine.pattern(s):engine.tokenAt(s);
   if(sentenceStart&&!/['’]/.test(targetPattern)&&initialSubject&&!has(a(i+1),'finiteVerb')&&!has(a(i+1),'auxiliary'))
    add('verb/complement','SUPPORTED',0.9,[i,i+1,i+2],'sentence-initial-auxiliary',{frame:'SENTENCE_INITIAL_INVERSION',targetRole:'sentence-initial-auxiliary',declarativeInversion:!sentenceQuestion,questionAllowed:sentenceQuestion});
   const leftNounPhrase=nominal(i-1) || (has(a(i-2),'article','determiner','possessiveDeterminer') && nominal(i-1));
   const rightNounPhrase=nominal(i+1) || (has(a(i+1),'article','determiner','possessiveDeterminer') && nominal(i+2));
   const leftNounHead=has(a(i-1),'noun','properNoun') || (has(a(i-2),'article','determiner','possessiveDeterminer') && has(a(i-1),'noun','properNoun'));
   const rightNounHead=has(a(i+1),'noun','properNoun') || (has(a(i+1),'article','determiner','possessiveDeterminer') && has(a(i+2),'noun','properNoun'));
   const leftDet=has(a(i-2),'article','determiner','possessiveDeterminer');
   const rightDet=has(a(i+1),'article','determiner','possessiveDeterminer');
   const sameDeterminer = leftDet === rightDet && (!leftDet || w(i-2) === w(i+1));
   const nounCoordination = leftNounPhrase && rightNounPhrase &&
    leftNounHead && rightNounHead &&
    sameDeterminer &&
    !a(i-1)?.primaryVerb && !a(i+1)?.primaryVerb &&
    (i === board.slots.length - 1 || !/[.!?]/.test(s.trailing));
   if(nounCoordination)
    add('list/coordinated-noun-phrases','SUPPORTED',0.98,[i-2,i-1,i+1,i+2],'coordinator',{
     candidateFamily:coordinators,preferred:'and',
     unknownRequirements:(!board.slots[i-2]?.solved && i > 1)?['left noun phrase identity is incomplete']:[]
    });
   const poss=possessives.includes(w(i-3));
   if(coordination&&poss&&has(a(i-2),'noun','properNoun')&&has(a(i+1),'noun')&&!has(a(i+1),'properNoun'))
    add('noun-phrase/parallel-determiner','SUPPORTED',0.9,[i-3,i-2,i-1,i+1],'determiner',{candidateFamily:determiners,parallel:w(i-3),rightNumber:engine.subjectNumber(a(i+1),w(i+1))});
   else add('noun-phrase/parallel-determiner',coordination?'UNKNOWN':'CONTRADICTED',coordination?0.35:0,[i-3,i-2,i-1,i+1],'determiner',coordination?{unknownRequirements:['contiguous possessive and both noun heads required']}:{contradictions:['no adjacent coordinator']});
   // Basic number is independent evidence and can coexist with parallel possession.
   const required=plural.includes(w(i-1))?'plural':singular.includes(w(i-1))?'singular':null;
   const rightNumber=has(a(i+1),'noun')&&!has(a(i+1),'properNoun')?engine.subjectNumber(a(i+1),w(i+1)):null;
   if(required||rightNumber)add('noun-phrase/number','SUPPORTED',0.9,[required?i-1:i+1],required?'noun':'determiner-number',{requiredNumber:required,rightNumber,mayPropose:false,terminal: i===board.slots.length-1||/[.!?,;:]/.test(s.trailing)});
   // Read a bounded, contiguous subject and nominal continuation. Unknown slots
   // never disappear and no inferred interpretation becomes an input anchor.
   const left=a(i-1),right=a(i+1);
   const nextFiniteVerb=has(right,'finiteVerb')&&right?.primaryVerb&&!has(right,'auxiliary');
   const personContinuation=local(i+3)&&has(a(i+2),'possessiveDeterminer')&&has(a(i+3),'noun','properNoun');
   // Reuse the existing verb/complement family for the bounded declarative
   // subject-before-finite-verb frame. Auxiliary inversion is excluded by the
   // lexical auxiliary guard; WH subjects remain valid in ordinary questions.
   if(nextFiniteVerb&&!has(right,'auxiliary'))
    add('verb/complement','SUPPORTED',0.92,[i,i+1,...(personContinuation?[i+2,i+3]:[])],'subject',{
     frame:'SUBJECT_BEFORE_FINITE',targetRole:'subject',questionSubject:sentenceQuestion,
     personEvidence:personContinuation?'possessive-before-nominal':null
    });
   const movementFrame=readings({word:w(i-1),analysis:left}).find(r=>r.family==='INTRANSITIVE'&&r.lemma==='go');
   const rightNominal=nominal(i+1)||has(a(i+1),'article','determiner','possessiveDeterminer');
   const prepDeterminerHead=has(a(i-2),'preposition')&&has(left,'article','determiner','possessiveDeterminer')&&!rightNominal;
   const prepDeterminerModifierHead=has(a(i-3),'preposition')&&has(a(i-2),'article','determiner','possessiveDeterminer')&&has(left,'adjective')&&!rightNominal;
   if(prepDeterminerHead||prepDeterminerModifierHead)
    add('noun-phrase/prepositional-nominal-head','SUPPORTED',0.94,[prepDeterminerModifierHead?i-3:i-2,prepDeterminerModifierHead?i-2:i-1,i],'nounHead',{frame:'PREPOSITION_DETERMINER_HEAD',targetRole:'nominal-head'});
   if(movementFrame&&!has(left,'preposition'))
    add('verb/complement','SUPPORTED',0.94,[i-1,i],'complement',{frame:'GO_ADVERBIAL_COMPLEMENT',targetRole:'complement',lemma:'go'});
   let subject=has(left,'subjectPronoun')||nominal(i-1)&&(!has(left,'verb')||has(left,'properNoun'));
   if(i>0&&/[,;:]/.test(board.slots[i-1]?.trailing||''))subject=false;
   if(coordination)subject=false;
   let objectEnd=i+1,object=has(right,'objectPronoun','properNoun')||has(right,'noun')&&!has(right,'verb');
   if(has(right,'article','determiner','possessiveDeterminer')&&has(a(i+2),'noun','properNoun')){object=true;objectEnd=i+2;}
   else if(has(right,'noun')&&has(a(i+2),'noun')&&!has(a(i+2),'verb'))objectEnd=i+2;
   const prep=has(right,'preposition')?w(i+1):null;
   const continuation=local(objectEnd+1)?w(objectEnd+1):'';
   const closedObject=object&&(objectEnd===board.slots.length-1||/[.!?,;:]/.test(board.slots[objectEnd].trailing)||Boolean(continuation));
   const declarativeBoundary = i === board.slots.length - 1 || /[.!]/.test(s.trailing);
   const visibleTransitiveVerb = has(left,'finiteVerb','baseVerb') && !has(left,'auxiliary') && !movementFrame && declarativeBoundary;
   const subjectForObject=subject||(!nounCoordination&&object&&nominal(i-1)&&nominal(i-2)&&/,/.test(board.slots[i-1]?.trailing||''));
   if(visibleTransitiveVerb)
   add('verb/complement','SUPPORTED',0.92,[i-1,i],'object',{frame:'DIRECT_TRANSITIVE',declarativeObject:true,targetRole:'object'});
   else if(subject&&prep&&nominal(i+2))add('verb/complement','SUPPORTED',0.9,[i-1,i+1,i+2],'predicate',{frame:'PREPOSITIONAL_COMPLEMENT',preposition:prep});
   else if(!nounCoordination&&subjectForObject&&object)add('verb/complement',closedObject?'SUPPORTED':'UNKNOWN',closedObject?0.92:0.5,[i-1,...Array.from({length:objectEnd-i},(_,j)=>i+j+1),...(continuation?[objectEnd+1]:[])],'predicate',{
    frame:['over','up','through'].includes(continuation)?'OBJECT_PARTICLE':'DIRECT_TRANSITIVE',particle:continuation,
    objectPronoun:has(right,'objectPronoun'),unknownRequirements:closedObject?[]:['continuation may license a particle or different complement']});
   else if(subject&&has(right,'adjective')&&!has(right,'noun'))add('verb/complement','SUPPORTED',0.85,[i-1,i+1],'predicate',{frame:'COPULAR'});
   else add('verb/complement','UNKNOWN',0,[i-1,i+1],'predicate',{unknownRequirements:['visible subject and complement not established']});
   const gov=readings({word:w(i-1),analysis:left}).filter(r=>r.family==='PREPOSITIONAL_COMPLEMENT');
   if(gov.length&&(nominal(i+1)||has(right,'article','determiner','possessiveDeterminer')))
    add('verb/licensed-preposition','SUPPORTED',0.9,[i-1,i+1],'preposition',{candidateFamily:[...new Set(gov.flatMap(r=>engine.framePrepositions[r.lemma]||[]))]});
   return matches;
  }
  function readings(candidate){
   const a=candidate.analysis,w=norm(candidate.word);
   if(!has(a,'verb','auxiliary'))return [];
   const out=[];
   if(w==='went'&&has(a,'finiteVerb'))out.push({lemma:'go',family:'INTRANSITIVE',form:'inflected'});
   // FOUND keeps the FIND-past reading distinct from the ESTABLISH-base reading.
   // Other unrepresented senses stay UNKNOWN, rather than contaminating frames.
   for(const lemma of [...new Set([...(a?.lemmas||[]),w])])for(const [family,words]of Object.entries(engine.frameGroups))
    if(words.split(' ').includes(lemma))out.push({lemma,family,form:lemma===w?'base':'inflected'});
   if(w==='found'&&has(a,'baseVerb'))out.push({lemma:'found',family:'DIRECT_TRANSITIVE',form:'base',sense:'establish'});
   if(has(a,'auxiliary','modal'))out.push({lemma:w,family:'AUXILIARY_MODAL',form:'auxiliary'});
   return out;
  }
  function assess(c,m){
   const w=norm(c.word),a=c.analysis;
   if(m.matchState!=='SUPPORTED')return {outcome:'UNKNOWN',support:0};
   if(m.candidateFamily){
    const fit=m.candidateFamily.includes(w);
    const preferred=m.preferred || (m.family==='list'?'and':null);
    const nounNumberConflict=m.situationId==='noun-phrase/parallel-determiner' &&
      ((m.rightNumber==='singular' && plural.includes(w)) || (m.rightNumber==='plural' && singular.includes(w)));
    return {outcome:fit&&!nounNumberConflict?'SUPPORTED':'CONTRADICTED',support:fit&&!nounNumberConflict?(w===m.parallel||w===preferred?1:0.7):0};
   }
   if(m.frame==='AUXILIARY_MODAL') {
    const base=has(a,'baseVerb')&&a.ordinaryBase&&!has(a,'thirdSingular','pastTense','pastParticiple','presentParticiple');
    const otherVerb=has(a,'verb')&&!base;
    return {outcome:base?'SUPPORTED':otherVerb?'CONTRADICTED':'UNKNOWN',support:base?0.98:0,readings:[]};
   }
   if(m.frame==='SENTENCE_INITIAL_INVERSION') {
    const auxiliary=has(a,'auxiliary');
    if(!auxiliary)return {outcome:'UNKNOWN',support:0,readings:[]};
    return m.declarativeInversion?{outcome:'CONTRADICTED',support:0,readings:[]}:{outcome:'SUPPORTED',support:0.9,readings:[]};
   }
   if(m.targetRole==='subject'&&m.frame==='SUBJECT_BEFORE_FINITE') {
    const nominalReading=has(a,'noun','properNoun','subjectPronoun','questionWord','possessivePronoun')||subjectQuantifiers.includes(w);
    if(!nominalReading)return {outcome:'CONTRADICTED',support:0,readings:[]};
    const classes=engine.semanticClasses?.(w,a,Boolean(c.properNoun))||[];
    const personLike=Boolean(m.personEvidence)&&(Boolean(c.properNoun)||classes.includes('PERSON')||classes.includes('ANIMATE')||has(a,'subjectPronoun','questionWord'));
    return {outcome:'SUPPORTED',support:0.92+(personLike?0.18:0),personSupport:personLike?0.18:0,readings:[]};
   }
   if(m.frame==='GO_ADVERBIAL_COMPLEMENT') {
    const classes=engine.semanticClasses?.(w,a,Boolean(c.properNoun))||[];
    const adverbial=has(a,'adverb')||bareMovementWords.has(w)||classes.includes('PLACE')&&bareMovementWords.has(w)||has(a,'presentParticiple');
    return {outcome:adverbial?'SUPPORTED':'CONTRADICTED',support:adverbial?0.94:0,readings:[]};
   }
   if(m.frame==='PREPOSITION_DETERMINER_HEAD') {
    const nominalReading=has(a,'noun','properNoun','subjectPronoun','objectPronoun','possessivePronoun');
    return {outcome:nominalReading?'SUPPORTED':'CONTRADICTED',support:nominalReading?0.94:0,readings:[]};
   }
   if(m.situationId==='noun-phrase/number'){
    // Number belongs to the noun reading, never the past-tense verb lemma.
    const n=has(a,'noun')?(a.pluralNoun||['children','men','women','people'].includes(w)?'plural':'singular'):null;
    const conflict=m.requiredNumber&&((n&&n!==m.requiredNumber)||m.terminal&&!has(a,'noun'))||m.rightNumber==='singular'&&plural.includes(w)||m.rightNumber==='plural'&&singular.includes(w);
    return {outcome:conflict?'CONTRADICTED':m.requiredNumber&&n===m.requiredNumber?'SUPPORTED':'UNKNOWN',support:m.requiredNumber&&n===m.requiredNumber?0.8:0};
   }
   if(m.targetRole==='object') {
    if(m.declarativeObject && has(a,'questionWord')) return {outcome:'CONTRADICTED',support:0,readings:[]};
    const objectCompatible=has(a,'objectPronoun','noun','properNoun','possessivePronoun');
    return {outcome:objectCompatible?'SUPPORTED':'UNKNOWN',support:objectCompatible?0.9:0,readings:[]};
   }
   if(m.declarativeObject && has(a,'questionWord')) return {outcome:'CONTRADICTED',support:0,readings:[]};
   const rs=readings(c);
   if(!rs.length)return {outcome:'UNKNOWN',support:0,roleSupport:a?.primaryVerb&&has(a,'finiteVerb','baseVerb')?0.5:0,readings:[]};
   const results=rs.map(r=>{
    let fit=null;
    if(m.frame==='DIRECT_TRANSITIVE'||m.frame==='OBJECT_PARTICLE')fit=['DIRECT_TRANSITIVE','OPTIONAL_TRANSITIVE'].includes(r.family)||
      m.frame==='OBJECT_PARTICLE'&&r.lemma==='look'||r.family==='COPULAR'&&!m.objectPronoun;
    if(m.frame==='PREPOSITIONAL_COMPLEMENT')fit=r.family==='PREPOSITIONAL_COMPLEMENT'?(engine.framePrepositions[r.lemma]||[]).includes(m.preposition):null;
    if(m.frame==='COPULAR')fit=r.family==='COPULAR'||has(a,'beAuxiliary')?true:null;
    return {...r,outcome:fit===null?'UNKNOWN':fit?'SUPPORTED':'CONTRADICTED'};
   });
   return {outcome:results.some(r=>r.outcome==='SUPPORTED')?'SUPPORTED':results.every(r=>r.outcome==='CONTRADICTED')?'CONTRADICTED':'UNKNOWN',support:results.some(r=>r.outcome==='SUPPORTED')?0.9:0,roleSupport:results.some(r=>r.outcome==='UNKNOWN')&&a?.primaryVerb&&has(a,'finiteVerb','baseVerb')?0.5:0,readings:results};
  }
  function proposals(matches,lexical){
   const words=new Set(matches.filter(m=>m.mayPropose).flatMap(m=>m.candidateFamily||[]));
   if(matches.some(m=>m.situationId==='verb/complement'&&m.mayPropose&&m.targetRole!=='object'))for(const base of Object.values(engine.frameGroups).join(' ').split(' ')){
    const third=/[^aeiou]y$/.test(base)?base.slice(0,-1)+'ies':base+(/(s|x|z|ch|sh|o)$/.test(base)?'es':'s');
    const past=base.endsWith('e')?base+'d':/[^aeiou]y$/.test(base)?base.slice(0,-1)+'ied':base+'ed';
    [base,third,past].forEach(w=>words.add(w));
   }
   return [...words].map(w=>lexical?.(w)).filter(Boolean);
  }
  function rank(input){
   const board=global.GGGPublicBoard.snapshot(input.state),situations=match(board,input.visibleAnalyses);
   const strong=situations.filter(m=>m.matchState==='SUPPORTED'&&m.evidenceStrength>=STRONG);
   const roleOwners=strong.filter(m=>m.situationId!=='noun-phrase/number');
   const exclusiveRoleOwners=roleOwners.filter(m=>!m.allowOpenFallback);
   const proposed=proposals(situations,input.lexical);
   const candidates=[...input.candidates,...proposed];
   const base=engine.rank({...input,state:board.state,candidates,constructionOwner:'situation-pilot',ownedTarget:exclusiveRoleOwners.length?(exclusiveRoleOwners.every(m=>m.candidateRole==='predicate')?'predicate':'closed'):false});
   const candidateMap=new Map(candidates.map(c=>[norm(c.word),c]));
   const ranked=base.ranked.map(c=>{
    const candidate=candidateMap.get(c.normalized);
   const trace=situations.filter(m=>m.matchState==='SUPPORTED').map(m=>({situationId:m.situationId,publicAnchors:m.publicAnchors,evidenceStrength:m.evidenceStrength,targetRole:m.targetRole,declarativeObject:m.declarativeObject,allowOpenFallback:m.allowOpenFallback,...assess(candidate,m)}));
    const strongTrace=trace.filter(t=>t.evidenceStrength>=STRONG);
    const conflict=strongTrace.some(t=>t.outcome==='CONTRADICTED'&&!t.allowOpenFallback);
    // Competing strong role hypotheses remain alternatives; number evidence is
    // compatible with either and never overrides a role by execution order.
    const roleTrace=strongTrace.filter(t=>t.situationId!=='noun-phrase/number');
    const overlap=roleTrace.some(t=>t.outcome==='SUPPORTED')&&roleTrace.some(t=>t.outcome==='CONTRADICTED');
    const pilotQuestionAllowed=has(candidate.analysis,'questionWord') &&
      !strongTrace.some(t=>t.situationId==='verb/complement' && t.declarativeObject);
    const legacyConflict=pilotQuestionAllowed?false:c.hardConflict;
    const structuralConflict=(conflict&&!overlap)||legacyConflict;
    const support=Math.max(roleOwners.length?0:Math.min(0.85,Math.log1p(c.contextWeight)/Math.log(1501)),...trace.map(t=>(t.outcome==='SUPPORTED'?t.support:t.roleSupport||0)*t.evidenceStrength));
    const familiarity=Math.max(0,Math.min(1,(c.zipf-2.5)/4.5));
    const phrase=c.phraseWeight>1?0.1:0;
    // One bounded structural contribution; repeated anchors do not multiply.
    const relativeSupport=structuralConflict?0:Math.min(1,0.12+0.65*support+0.12*familiarity+phrase+(roleOwners.length?0:0.1*c.contextFit));
    return {...c,hardConflict:structuralConflict,structuralConflict,overlap,
     contextMismatch:pilotQuestionAllowed?false:c.contextMismatch,relativeSupport,weight:relativeSupport,
     evidence:[...trace,{source:'familiarity',support:0.12*familiarity},{source:'phrase',support:phrase}],candidateReadings:readings(candidate)};
   }).sort((a,b)=>b.weight-a.weight||a.normalized.localeCompare(b.normalized));
   ranked.forEach((c,i)=>c.rank=i+1);
   const competingRoles=ranked.some(c=>c.overlap);
   const evidenceStrength=Math.min(competingRoles?0.6:1,Math.max(0,...situations.filter(m=>m.matchState==='SUPPORTED'&&(m.situationId!=='noun-phrase/number'||m.requiredNumber)).map(m=>m.evidenceStrength)));
   const families=exclusiveRoleOwners.filter(m=>m.candidateFamily);
   const coverage={status:families.length?'CLOSED_FAMILY':'PARTIAL_LEXICON',confidence:families.length?0.95:0.4,
    exhaustive:families.length>0,available:ranked.filter(c=>!c.structuralConflict).length,exhausted:false};
   const credible=ranked.filter(c=>!c.structuralConflict&&(!c.contextMismatch||c.overlap)&&
     (exclusiveRoleOwners.length?c.evidence.some(t=>t.outcome==='SUPPORTED')||candidateMap.get(c.normalized)?.analysis?.primaryVerb:true));
   // All compatible closed-family alternatives survive; large open inventories
   // receive only a bounded familiarity tail. Scarcity does not raise evidence.
   const residual=base.band.map(old=>{const c=ranked.find(c=>c.normalized===old.normalized);return c&&!c.structuralConflict?{...c,weight:Math.sqrt(old.probability),relativeSupport:old.probability}:null;}).filter(Boolean);
   const embeddedQuestionEligible=input.visibleAnalyses.slice(0,board.targetSlot).some((a,j)=>
    a?.primaryVerb && ['know','say','tell','ask','wonder'].includes(engine.tokenAt(board.slots[j]).toLowerCase())) &&
    has(input.visibleAnalyses[board.targetSlot+1],'finiteVerb');
   const embeddedQuestionWords=embeddedQuestionEligible?ranked.filter(c=>has(candidateMap.get(c.normalized)?.analysis,'questionWord')&&!c.structuralConflict&&!c.contextMismatch):[];
   const kept=exclusiveRoleOwners.length
    ?credible.filter(c=>c.weight>=(credible[0]?.weight||1)*0.4).slice(0,families.length?32:20)
    : [...new Map([...credible,...residual,...embeddedQuestionWords].map(c=>[c.normalized,c])).values()];
   const mass=kept.reduce((n,c)=>n+c.weight**2,0);
   const band=kept.map(c=>({...c,probability:c.weight**2/mass}));
   coverage.exhausted=!band.length;
   return {...base,policy:{version:VERSION},state:board.state,board,situations,ranked,band,coverage,evidenceStrength,
    evidenceStatus:competingRoles?'AMBIGUOUS':evidenceStrength>=STRONG?'SUPPORTED':evidenceStrength?'UNCERTAIN':'UNKNOWN',
    convergence:evidenceStrength,counts:{...base.counts,recommended:credible.length,selectionBand:band.length},selectionPower:2};
  }
  function opportunity(r){
   if(!r.band.length)return {score:0,relativePriority:0,reasons:{exhausted:true}};
   const key=engine.evidenceKey(r.state),old=attention.get(r.state.targetSlotIndex),attempts=old?.key===key?old.attempts:0;
   const closed=r.coverage.status==='CLOSED_FAMILY';
   const pattern=engine.tokenAt(r.state.slots[r.state.targetSlotIndex]);
   const punctuationNarrowing=/['-]/.test(pattern)&&r.state.slots[r.state.targetSlotIndex].length<=5;
   const partialShort=r.state.slots[r.state.targetSlotIndex].length<=4&&r.fraction>0;
   const boundedPatternBonus=punctuationNarrowing?0.18:partialShort?0.08:0;
   const priority=Math.min(1,0.08+0.5*r.evidenceStrength+0.22*r.fraction+(closed?0.15:0)+boundedPatternBonus+0.05*r.coverage.confidence)/(1+attempts*0.35);
   return {score:priority,relativePriority:priority,reasons:{evidenceStrength:r.evidenceStrength,coverage:r.coverage.status,visibleFraction:r.fraction,unproductiveAttempts:attempts}};
  }
  function choose(r,seed,actor,turn){
   const selected=engine.choose(r,seed,actor,turn);if(!selected)return null;
   selected.diagnostic={...selected.diagnostic,engineVersion:VERSION,publicBoardRevision:r.board.revision,candidateProviderVersion:VERSION,
    situationIds:r.situations.filter(m=>m.matchState==='SUPPORTED').map(m=>m.situationId),situations:r.situations,
    evidenceStrength:r.evidenceStrength,evidenceStatus:r.evidenceStatus,coverage:r.coverage};
   return {...selected,slot:r.state.targetSlotIndex,candidate:selected.word,relativeSupport:selected.relativeSupport,
    evidenceStatus:r.evidenceStatus,coverage:r.coverage,boardRevision:r.board.revision};
  }
  function noteAttempt(r){const key=engine.evidenceKey(r.state),i=r.state.targetSlotIndex,old=attention.get(i);attention.set(i,{key,attempts:old?.key===key?old.attempts+1:1});}
  return Object.freeze({version:VERSION,rank,opportunity,choose,noteAttempt,match,assess,readings,reset:()=>attention.clear()});
 }
 global.GGGSituationPilot=Object.freeze({create});
})(globalThis);
