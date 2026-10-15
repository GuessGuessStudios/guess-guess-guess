// General eligibility mechanism copied from evidence-eligibility-refinement-public-text-repair.
// The experiment and its artifacts are untouched. No examples, mappings or judgments.
// Browser port: import/export wrapper and local assertion helpers only.
(function(global) {
'use strict';
const R={
  "version": 1,
  "states": [
    "ELIGIBLE_SUPPORT",
    "ELIGIBLE_CONFLICT",
    "UNRESOLVED"
  ],
  "auxiliary": {
    "modal": "baseVerb",
    "doAuxiliary": "baseVerb",
    "haveAuxiliary": "pastParticiple",
    "beAuxiliary": "beComplement"
  },
  "forms": [
    "baseVerb",
    "finiteVerb",
    "pastParticiple",
    "presentParticiple"
  ],
  "generic": [
    "verb",
    "auxiliary",
    "pronoun"
  ],
  "nominals": [
    "noun",
    "properNoun"
  ],
  "determiners": [
    "article",
    "determiner",
    "possessiveDeterminer"
  ],
  "pronouns": [
    "subjectPronoun",
    "objectPronoun",
    "possessivePronoun"
  ],
  "unsupported": [
    "particle",
    "conjunction",
    "questionWord"
  ],
  "boundaries": "[.!?,;:]",
  "unsupportedPunctuation": "[\"“”()—’']",
  "branchLimit": 2048,
  "negativeAllowlist": [
    "modal:baseVerb",
    "doAuxiliary:baseVerb",
    "haveAuxiliary:pastParticiple"
  ],
  "duplicateHeadPolicy": "Only a candidate participial auxiliary's independently established allowed required-form mismatch; lexical-verb adjacent-head/valency ambiguity abstains.",
  "nominalPolicy": "No common-noun, modifier/head, compound, subject-predicate eligibility without reliable determination/number/attachment representation. Current harness does not provide those certificates.",
  "syntacticScope": "Only bounded syntactic relation. No contextual plausibility, target correctness, semantic, agreement or valency certification."
};
const clone=x=>JSON.parse(JSON.stringify(x));
const assert=(ok,message='Invalid public observation')=>{if(!ok)throw new Error(message);};
assert.equal=(a,b,message)=>assert(a===b,message);
const keys=(x,expected)=>assert(x&&Object.keys(x).sort().join('|')===expected.slice().sort().join('|'));
const lexical=c=>/^[\p{L}\p{M}]$/u.test(c);
function validateSlot(slot){
 keys(slot,['solved','trailing','letters','gaps']);
 assert.equal(typeof slot.solved,'boolean');assert(Array.isArray(slot.letters));assert(Array.isArray(slot.gaps));
 assert.equal(slot.gaps.length,slot.letters.length+1,'One public punctuation gap before/between/after lexical positions');
 for(const gap of slot.gaps){assert.equal(typeof gap,'string');assert(!/[\p{L}\p{M}\s]/u.test(gap),'Gap must contain only public nonletter nonwhitespace characters');}
 assert.equal(slot.trailing,slot.gaps.at(-1),'Trailing field must equal the true final gap');
 if(!slot.letters.length)assert(slot.solved,'Nonlexical token cannot be a hidden guess slot');
 for(const l of slot.letters){
 keys(l,['capital','visible']);assert.equal(typeof l.capital,'boolean');
 assert(l.visible===null||typeof l.visible==='string'&&Array.from(l.visible).length===1&&lexical(l.visible));
 if(slot.solved)assert(l.visible!==null);
 }
 return slot;
}
function validatePublic(s){
 keys(s,['slots','spacing','targetSlotIndex','rejectedWordsBySlot']);
 assert(Array.isArray(s.slots)&&s.slots.length>0);
 assert(Array.isArray(s.spacing)&&s.spacing.length===s.slots.length+1);
 assert(s.spacing.every(x=>typeof x==='string'&&/^\s*$/u.test(x)));
 assert(s.spacing.slice(1,-1).every(x=>x.length>0),'Distinct tokens require original whitespace');
 s.slots.forEach(validateSlot);
 assert(Number.isInteger(s.targetSlotIndex)&&s.slots[s.targetSlotIndex]);
 assert(s.slots[s.targetSlotIndex].letters.length>0&&!s.slots[s.targetSlotIndex].solved);
 assert(s.rejectedWordsBySlot&&typeof s.rejectedWordsBySlot==='object'&&!Array.isArray(s.rejectedWordsBySlot));
 for(const [k,v]of Object.entries(s.rejectedWordsBySlot)){
 assert(/^\d+$/.test(k));assert(Number(k)<s.slots.length);
 assert(Array.isArray(v)&&v.every(w=>typeof w==='string'&&/^[a-z]+$/.test(w)));
 }
 return s;
}

function renderSlot(slot){
 validateSlot(slot);
 let text=slot.gaps[0];for(let i=0;i<slot.letters.length;i++)text+=(slot.letters[i].visible===null?'_':slot.letters[i].visible)+slot.gaps[i+1];
 return text;
}

function legacyConsumable(slot){
 validateSlot(slot);
 return slot.letters.length>0&&slot.gaps.slice(0,-1).every(x=>x==='')&&
 slot.letters.every(l=>l.visible===null||/^[A-Za-z]$/.test(l.visible))&&/^[^A-Za-z0-9]*$/.test(slot.trailing);
}

const S='ELIGIBLE_SUPPORT',C='ELIGIBLE_CONFLICT',U='UNRESOLVED';
function core(state,candidate,analyses){
 validatePublic(state);
 const target=state.targetSlotIndex,slots=state.slots,n=slots.length;
 const known=a=>!!a&&(a.known||a.dictionaryProper);
 const specific=a=>[...new Set((a?.roles||[]).filter(r=>!R.generic.includes(r)))];
 const token=i=>i<0||i>=n?null:{index:i,word:i===target?candidate:slots[i].solved?slots[i].letters.map(l=>l.visible).join(''):null,hidden:i!==target&&!slots[i].solved,analysis:i===target?analyses.candidate:analyses.visible[i],roles:specific(i===target?analyses.candidate:analyses.visible[i]),punct:slots[i].trailing};
 const boundary=i=>i<0||i>=n||new RegExp(R.boundaries).test(slots[i].trailing);
 const aux=t=>Object.keys(R.auxiliary).filter(r=>t?.roles.includes(r));
 const isVerb=r=>R.forms.includes(r)||Object.hasOwn(R.auxiliary,r);
 const branches=[];let steps=0;
 const copy=b=>JSON.parse(JSON.stringify(b));
 function branch(role){return {role,used:[],trace:[],governingDependency:null,candidateAttachment:null,obligationsIntroduced:[],obligationsDischarged:[],continuingObligations:[],localBoundaryJustification:null,positiveEvidence:[],hardConflicts:[],abstentionReasons:[],interpretationCoverage:{candidateRoles:specific(analyses.candidate),status:'PENDING',lexicalInventoryExhaustive:false}};}
 function touch(b,i,action,role=null){const t=token(i);if(!t)return;if(!b.used.includes(i))b.used.push(i);b.trace.push({position:i,word:t.word,candidate:i===target,action,role});}
 function finish(b,status,reason,position=null){
 if(status===S&&(!b.positiveEvidence.length||b.continuingObligations.length||!b.candidateAttachment||!b.localBoundaryJustification)){status=U;reason='incomplete-support-certificate';}
 b.state=status;b.reason=reason;
 b.interpretationCoverage.status=status===U?'UNRESOLVED':status===C?'REPRESENTED_VERBAL_FORMS_EXHAUSTED':'RELATION_ESTABLISHED_FOR_THIS_INTERPRETATION';
 if(status===U)b.abstentionReasons.push({reason,position});
 branches.push(b);
 }
 function gate(b,i){
 if(++steps>R.branchLimit){finish(b,U,'branch-limit',i);return false;}
 const t=token(i);if(!t){finish(b,U,'required-continuation-missing',i);return false;}
 touch(b,i,'inspect');
 if(t.hidden){finish(b,U,'hidden-on-candidate-dependency',i);return false;}
 if(!known(t.analysis)){finish(b,U,'unknown-on-candidate-dependency',i);return false;}
 if(new RegExp(R.unsupportedPunctuation).test(t.punct)){finish(b,U,'unsupported-punctuation-on-dependency',i);return false;}
 if(!t.roles.length){finish(b,U,'missing-specific-interpretations',i);return false;}
 return true;
 }
 function introduce(b,i,required,subtype,candidateOwned=false){const o={id:i+':'+required,origin:i,required,subtype,candidateOwned};b.obligationsIntroduced.push(o);b.continuingObligations.push(o);touch(b,i,'introduce',required);}
 function discharge(b,i){const o=b.continuingObligations.shift();if(o){b.obligationsDischarged.push({...o,dischargedAt:i});touch(b,i,'discharge',o.required);}}
 function conflict(b,i,required,subtype,reason){
 const t=token(i),rs=i===target?[b.role]:t.roles;
 const sufficient=rs.length&&rs.every(isVerb)&&t.roles.some(r=>R.forms.includes(r));
 const owned=i===target||b.continuingObligations[0]?.candidateOwned;
 if(!owned||!sufficient||!R.negativeAllowlist.includes(subtype+':'+required)){finish(b,U,'mismatch-not-hard-candidate-local-form-evidence',i);return;}
 b.hardConflicts.push({rule:subtype+':'+required,position:i,reason,scope:'candidate-or-candidate-introduced-auxiliary-obligation'});
 finish(b,C,reason,i);
 }
 function close(b,i){
 if(i>=n||boundary(i-1)){b.localBoundaryJustification={kind:'visible-punctuation-or-end',position:i-1};finish(b,S,'completed-bounded-auxiliary-relation');return;}
 if(!gate(b,i))return;
 const t=token(i),rs=t.roles;
 if(rs.every(r=>r==='adverb')){touch(b,i,'continuing-adverb');close(b,i+1);return;}
 const nominalBoundary=rs.every(r=>[...R.nominals,...R.determiners,...R.pronouns,'preposition'].includes(r));
 if(nominalBoundary){touch(b,i,'downstream-phrase-boundary');b.localBoundaryJustification={kind:'represented-nominal-or-prepositional-boundary',position:i,downstreamPhraseCertified:false};finish(b,S,'completed-bounded-auxiliary-relation');return;}
 // A lexical verbal head after a discharge can require sense/valency or another
 // attachment. It is never made a conflict merely by adjacency.
 finish(b,U,'unresolved-continuation-attachment-or-valency',i);
 }
 function consume(b,i,required,subtype,origin){
 const t=token(i);discharge(b,i);
 if(i===target){
 b.candidateAttachment={kind:'required-verbal-form',governor:origin,position:target,required};
 b.positiveEvidence.push({kind:'auxiliary-required-form',positions:[origin,target],scope:R.syntacticScope});
 }else if(b.candidateAttachment?.kind==='intervening-adverb'){
 b.positiveEvidence.push({kind:'auxiliary-adverb-visible-discharge',positions:[origin,target,i],scope:R.syntacticScope});
 }
 const subtypes=aux(t);
 if(subtypes.length){
 if(subtypes.length!==1){finish(b,U,'ambiguous-auxiliary-subtype',i);return;}
 const a=subtypes[0],req=R.auxiliary[a];
 introduce(b,i,req,a,i===target||b.governingDependency?.candidateChainOrigin===target);
 if(i===target)b.governingDependency.candidateChainOrigin=target;
 if(boundary(i)){finish(b,U,'boundary-before-auxiliary-discharge',i);return;}
 need(b,i+1,req,a,i);
 }else close(b,i+1);
 }
 function need(b,i,required,subtype,origin){
 if(!gate(b,i))return;
 const t=token(i),rs=i===target?[b.role]:t.roles;
 const unsafe=rs.filter(r=>!isVerb(r)&&r!=='adverb');
 for(const r of unsafe){const q=copy(b);touch(q,i,'unresolved-represented-alternative',r);finish(q,U,'nonverbal-or-unsupported-alternative-on-auxiliary-path',i);}
 let entered=false;
 if(rs.includes('adverb')){
 entered=true;const q=copy(b);touch(q,i,'intervening-adverb','adverb');
 if(i===target)q.candidateAttachment={kind:'intervening-adverb',governor:origin,position:target,required};
 if(boundary(i))finish(q,U,'boundary-before-required-form',i);else need(q,i+1,required,subtype,origin);
 }
 const verbRoles=rs.filter(isVerb);
 if(verbRoles.length){
 entered=true;
 // Form aliases remain explicit candidate branches. Auxiliary subtype branches
 // use their word's represented forms; other candidate branches use their own.
 const forms=i===target&&R.forms.includes(b.role)?[b.role]:t.roles.filter(r=>R.forms.includes(r));
 const matches=required==='beComplement'?forms.some(r=>['presentParticiple','pastParticiple'].includes(r)):forms.includes(required);
 if(matches)consume(copy(b),i,required,subtype,origin);
 else conflict(copy(b),i,required,subtype,'hard-required-form-mismatch');
 }
 if(!entered&&!unsafe.length)finish(b,U,'unrepresented-required-continuation',i);
 }
 function governor(b){
 // Straight inversion supports a represented pronominal subject only.
 let start=target;while(start>0&&!boundary(start-1))start--;
 let end=target;while(end<n-1&&!/[.!?]/.test(slots[end].trailing))end++;
 const opening=token(start);
 if(start<target&&slots[end].trailing.includes('?')&&aux(opening).length){
 if(aux(opening).length!==1||opening.roles.some(r=>!isVerb(r))){finish(b,U,'ambiguous-governing-auxiliary',start);return null;}
 if(!gate(b,start)||!gate(b,start+1))return null;
 const subject=token(start+1);
 if(subject.index===target||subject.roles.length!==1||subject.roles[0]!=='subjectPronoun'){finish(b,U,'inverted-subject-attachment-unresolved',start+1);return null;}
 touch(b,start+1,'established-inverted-pronominal-subject');
 return {origin:start,from:start+2,subtype:aux(opening)[0],attachment:'inverted-auxiliary-pronominal-subject'};
 }
 // Find a contiguous auxiliary/adverb path; never jump over another predicate.
 let i=target-1;
 while(i>=0&&!boundary(i)&&token(i).roles.length===1&&token(i).roles[0]==='adverb'&&!token(i).hidden&&known(token(i).analysis))i--;
 if(i<0||boundary(i)||!aux(token(i)).length)return false;
 let origin=i;
 while(origin>0&&!boundary(origin-1)){
 const left=token(origin-1);
 if(left.hidden||!known(left.analysis)){finish(b,U,'unknown-upstream-attachment',origin-1);return null;}
 if(left.roles.length===1&&left.roles[0]==='adverb'){origin--;continue;}
 if(aux(left).length){origin--;continue;}
 break;
 }
 // If the leftmost scanned token was an adverb, attachment is not established.
 if(aux(token(origin)).length!==1||token(origin).roles.some(r=>!isVerb(r))){finish(b,U,'ambiguous-governing-auxiliary',origin);return null;}
 const subject=token(origin-1);
 if(!subject||subject.hidden||!known(subject.analysis)||subject.roles.length!==1||subject.roles[0]!=='subjectPronoun'||!boundary(origin-2)){
 finish(b,U,'governing-attachment-not-established',origin-1);return null;
 }
 if(!gate(b,origin)||!gate(b,origin-1))return null;
 touch(b,origin-1,'established-pronominal-subject');
 return {origin,from:origin+1,subtype:aux(token(origin))[0],attachment:'clause-initial-pronominal-subject-auxiliary'};
 }
 function analyze(role){
 const b=branch(role);touch(b,target,'candidate-interpretation',role);
 if(!gate(b,target))return;
 const prev=token(target-1);
 if(prev&&!boundary(target-1)&&prev.roles.includes('preposition')){
 if(!gate(b,target-1))return;
 b.governingDependency={kind:'prepositional-object',origin:target-1};
 if(prev.roles.length!==1){finish(b,U,'preposition-attachment-or-role-ambiguity',target-1);return;}
 if(!['objectPronoun','possessivePronoun'].includes(role)){finish(b,U,'nominal-coverage-determination-number-or-construction-unresolved',target);return;}
 if(!boundary(target)&&target!==n-1){finish(b,U,'pronoun-object-phrase-boundary-unresolved',target+1);return;}
 b.candidateAttachment={kind:'complete-pronominal-object',governor:target-1,position:target};
 introduce(b,target-1,'object-pronoun','preposition');discharge(b,target);
 b.localBoundaryJustification={kind:'visible-punctuation-or-end',position:target};
 b.positiveEvidence.push({kind:'prepositional-pronoun-object',positions:[target-1,target],scope:R.syntacticScope});
 finish(b,S,'completed-pronominal-object');return;
 }
 const g=governor(b);
 if(g===null)return;
 if(g){
 b.governingDependency={kind:'auxiliary-required-form',...g};
 introduce(b,g.origin,R.auxiliary[g.subtype],g.subtype);
 need(b,g.from,R.auxiliary[g.subtype],g.subtype,g.origin);return;
 }
 finish(b,U,R.nominals.includes(role)||R.determiners.includes(role)||role==='adjective'?'nominal-completion-number-or-attachment-not-certified':isVerb(role)||role==='subjectPronoun'?'ordinary-agreement-or-clause-attachment-not-certified':'no-eligible-positive-relation');
 }
 const rs=specific(analyses.candidate);
 if(!known(analyses.candidate)||!rs.length){const b=branch('unknown');finish(b,U,'missing-candidate-interpretations',target);}else rs.forEach(analyze);
 // Every represented candidate role has a terminal branch; visible ambiguities
 // on the necessary path also have explicit terminal abstentions.
 const unresolved=branches.some(b=>b.state===U);
 const status=!unresolved&&branches.some(b=>b.state===S)?S:branches.length&&branches.every(b=>b.state===C)?C:U;
 const used=new Set(branches.flatMap(b=>b.used));
 return {
 state:status,certifies:R.syntacticScope,contextualPlausibility:'NOT_ASSESSED',
 candidateInterpretations:branches,
 governingDependency:branches.map(b=>b.governingDependency),
 publicAnchors:[...used].filter(i=>i!==target&&slots[i].solved).sort((a,b)=>a-b).map(i=>({position:i,word:token(i).word})),
 candidateAttachment:branches.map(b=>b.candidateAttachment),
 obligationsIntroduced:branches.flatMap(b=>b.obligationsIntroduced),
 obligationsDischarged:branches.flatMap(b=>b.obligationsDischarged),
 continuingObligations:branches.flatMap(b=>b.continuingObligations),
 localBoundaryJustification:branches.map(b=>b.localBoundaryJustification),
 interpretationCoverage:{representedCandidateRoles:rs,terminalCandidateRoles:[...new Set(branches.map(b=>b.role))],allRepresentedRolesPreserved:rs.every(r=>branches.some(b=>b.role===r)),hasRelevantUnresolved:unresolved,lexicalInventoryExhaustive:false,negativeScope:'represented-verbal-family-under-established-hard-form-requirement-only'},
 reasonsForAbstention:branches.flatMap(b=>b.abstentionReasons),
 unexaminedRemainder:slots.flatMap((s,i)=>i===target||used.has(i)?[]:[{position:i,word:token(i).word,reason:!s.solved?'hidden-outside-dependency':!known(token(i).analysis)?'unknown-outside-dependency':'unexamined-outside-bounded-relation'}])
 };
}

function assessEligibility(state,candidate,analyses){
 validatePublic(state);
 const target=state.targetSlotIndex;
 const unsupported=state.slots.flatMap((slot,i)=>legacyConsumable(slot)?[]:[{
 position:i,publicSurface:renderSlot(slot),reason:'public-surface-outside-frozen-letter-plus-suffix-interface',
 representedRoles:i===target?(analyses.candidate?.roles||[]):(analyses.visible[i]?.roles||[])
 }]);
 const safe={candidate:analyses.candidate,visible:analyses.visible.map((a,i)=>
 legacyConsumable(state.slots[i])?a:{word:null,roles:[],lemmas:[],known:false,dictionaryProper:false})};
 let result;
 if(!legacyConsumable(state.slots[target])){
 // No interpretation is silently discarded: defer every represented candidate
 // role because the existing grammar cannot consume this public surface.
 result=core(state,candidate,{...safe,candidate:{word:candidate,roles:[],known:false,dictionaryProper:false}});
 const roles=[...new Set((analyses.candidate?.roles||[]).filter(r=>!R.generic.includes(r)))];
 const reason='unsupported-public-token-representation';
 result.candidateInterpretations=(roles.length?roles:['unknown']).map(role=>{
 const b=clone(result.candidateInterpretations[0]);
 b.role=role;b.used=[target];b.trace=[{position:target,word:candidate,candidate:true,action:'defer-public-surface-interpretation',role}];
 b.reason=reason;b.abstentionReasons=[{reason,position:target}];
 b.interpretationCoverage={...b.interpretationCoverage,candidateRoles:roles,status:'UNRESOLVED_PUBLIC_SURFACE'};
 return b;
 });
 result.interpretationCoverage={...result.interpretationCoverage,representedCandidateRoles:roles,terminalCandidateRoles:result.candidateInterpretations.map(b=>b.role),allRepresentedRolesPreserved:true,hasRelevantUnresolved:true};
 result.governingDependency=result.candidateInterpretations.map(()=>null);
 result.candidateAttachment=result.candidateInterpretations.map(()=>null);
 result.localBoundaryJustification=result.candidateInterpretations.map(()=>null);
 result.reasonsForAbstention=[{reason,position:target}];
 }else result=core(state,candidate,safe);
 // Diagnostic public token text must retain its punctuation too.
 for(const b of result.candidateInterpretations)for(const t of b.trace){
 if(!t.candidate&&state.slots[t.position]?.solved)t.word=renderSlot(state.slots[t.position]);
 }
 for(const a of result.publicAnchors)a.word=renderSlot(state.slots[a.position]);
 for(const a of result.unexaminedRemainder)if(state.slots[a.position].solved)a.word=renderSlot(state.slots[a.position]);
 result.publicSurfaceRepresentation={version:2,unsupportedTokens:unsupported,policy:'Preserve exact public surface; unsupported target interpretations abstain, unsupported relevant visible tokens are unknown to unchanged grammar.'};
 return result;
}

global.GGGHumanEligibility=Object.freeze({assessEligibility,validatePublic,renderSlot,S,C,U});
})(globalThis);

