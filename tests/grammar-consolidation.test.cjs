const assert = require('node:assert/strict');
const { harness, group } = require('./ai-harness.cjs');

function state(h, text, targetIndex, visible, pattern = '') {
  const tokens = text.split(/\s+/);
  h.groups = tokens.map(token => group(token.replace(/[.?!,;:]$/, ''), token.match(/[.?!,;:]$/)?.[0] || ''));
  const solved = visible || tokens.map((_, i) => i).filter(i => i !== targetIndex);
  solved.forEach(i => {
    h.groups[i].classList.add('revealed');
    h.groups[i].querySelectorAll().forEach(b => { b.textContent = b.dataset.letter; b.dataset.revealed = 'true'; });
  });
  [...pattern].forEach((c, i) => {
    if (!'*_'.includes(c)) {
      const b = h.groups[targetIndex].querySelectorAll()[i];
      b.textContent = c; b.dataset.revealed = 'true';
    }
  });
  const target = { group: h.groups[targetIndex], slotIndex: targetIndex,
    answer: tokens[targetIndex].replace(/[.?!,;:]$/, ''), length: h.groups[targetIndex].querySelectorAll().length };
  const roles = h.inferAiTargetRoles(target);
  const context = { ...h.getAiGrammarContext(target), targetLength: target.length, targetRoles: roles };
  return { target, roles, context };
}
function score(h, s, word) { return h.scoreAiCandidateForGrammar({ word, sources: [4] }, s.context); }
const cases = [
  ['noun', 'The cat sat on the mat.', 1, ['cat','dog','pet'], ['she','his','why']],
  ['verb', 'The cat sat on the mat.', 2, ['sat','run','pet'], ['rat','art','yet']],
  ['preposition', 'The cat sat on the mat.', 3, ['on','in','at'], ['an','we','am']],
  ['final noun', 'The cat sat on the mat.', 5, ['mat','dog','bed'], ['how','are','nor']],
  ['prepositional noun phrase', 'The cat sat on the mat.', 4, ['the','his'], ['run','who']],
  ['transitive noun phrase', 'She loves the cat.', 2, ['the','her'], ['go','who']],
  ['finite predicate', 'She loves Tom.', 1, ['loves','runs'], ['his','old']],
  ['object', 'She loves Tom.', 2, ['Tom','him','dogs'], ['go','does']],
  ['modal', 'The boy will run home.', 3, ['run','pet'], ['ran','runs','red']],
  ['infinitive', 'He wants to leave.', 3, ['leave','run'], ['left','runs','his']],
  ['copula', 'The boy is happy.', 3, ['happy','ready'], ['run','did']],
  ['location', 'The boy is in the house.', 3, ['in','near'], ['run','does']],
  ['declarative auxiliary', 'She is happy.', 0, ['she','he'], ['who','why','how']],
  ['WH subject position', 'Who does Susan love?', 2, ['Susan','she'], ['go','where']],
  ['WH verb position', 'Who does Susan love?', 3, ['love','run'], ['loves','Susan','where']],
  ['WH opening', 'Who does Susan love?', 0, ['who','why','how'], ['the','her']],
  ['where do', 'Where did John go?', 3, ['go','run'], ['went','where']],
  ['what do', 'What did Mary buy?', 3, ['buy','take'], ['bought','when']],
  ['why do', 'Why did he leave?', 3, ['leave','go'], ['left','why']],
  ['when modal', 'When will they arrive?', 3, ['arrive','come'], ['came','when']],
  ['how modal', 'How can I help?', 3, ['help','run'], ['ran','how']],
  ['yes/no do', 'Did John leave?', 2, ['leave','go'], ['left','who']],
  ['yes/no modal', 'Can she swim?', 2, ['swim','run'], ['swam','she']],
  ['yes/no will', 'Will they come?', 2, ['come','go'], ['came','who']],
  ['yes/no have', 'Has he finished?', 2, ['finished','gone'], ['finish','go']],
  ['BE identity', 'Who is he?', 2, ['he','Susan'], ['go','why']],
  ['BE location subject', 'Where are they?', 2, ['they','dogs'], ['go','where']],
  ['BE adjective', 'Is he ready?', 2, ['ready','happy'], ['run','did']],
  ['BE progressive', 'Are they coming?', 2, ['coming','running'], ['come','ran']],
  ['subject WH predicate', 'Who broke the window?', 1, ['broke','opened'], ['who','his']],
  ['subject WH short', 'What happened?', 1, ['happened','broke'], ['what','who']],
  ['question auxiliary', 'Who does Susan love?', 1, ['does','did'], ['love','who']],
  ['yes/no opening', 'Did John leave?', 0, ['did','can'], ['the','who']],
  ['question subject', 'Did John leave?', 1, ['John','he'], ['go','where']],
  ['subject WH with object', 'Who loves Tom?', 1, ['loves','likes'], ['who','does']],
  ['inverted object', 'Who did Susan love?', 2, ['Susan','she'], ['go','where']],
  ['question object complement', 'Did Susan love Tom?', 3, ['Tom','him'], ['go','did']],
  ['question final noun phrase', 'Did John sit on the mat?', 5, ['mat','rug'], ['go','who']],
  ['inverted determiner subject head', 'Where did the boy go?', 3, ['boy','girl'], ['go','when']],
];

async function main() {
  const h = await harness();
  if (process.argv.includes('--trace')) {
    for (const [name,text,index,good,bad] of cases) {
      const s = state(h,text,index);
      const words = [...good,...bad];
      const pool = { targetSlot:s.target,targetLength:s.target.length,
        candidates:words.filter(w=>w.length===s.target.length).map(word=>({word,sources:[4],sourcePrior:1})) };
      const distribution = h.getAiCandidateDistribution(pool,6);
      console.log(JSON.stringify({name, profile:s.roles.ranked.slice(0,4),confidence:s.roles.confidence,
        scores:Object.fromEntries(words.map(w=>[w,score(h,s,w)])),
        distribution:distribution.map(x=>({word:x.candidate.word,q:x.heuristicProbability,p:x.probability}))}));
    }
    return;
  }
  let checks=0, failures=0;
  const check=(name,fn)=>{try{fn();checks++;console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,e.message);}};
  for(const [name,text,index,good,bad] of cases) check(name,()=>{
    const s=state(h,text,index);
    for(const a of good) for(const b of bad) {
      assert(score(h,s,a)>score(h,s,b)*1.2, a+' should outrank '+b+' in '+text);
      assert(score(h,s,b)>0,'grammar is not an exclusion');
    }
    assert(s.roles.ranked.every(x=>x.weight>=0&&x.probability>=0));
    assert(Math.abs(s.roles.ranked.reduce((n,x)=>n+x.probability,0)-1)<1e-9);
  });
  const forms = [
    ['love','loves','loved','loving'],['run','runs','ran','running'],['sit','sits','sat','sitting'],
    ['play','plays','played','playing'],['watch','watches','watched','watching'],['pet','pets','petted','petting'],
    ['go','goes','went','going'],['buy','buys','bought','buying'],['leave','leaves','left','leaving'],
    ['study','studies','studied','studying'],['try','tries','tried','trying'],['stop','stops','stopped','stopping']
  ];
  for(const words of forms) check('forms '+words[0],()=>{
    words.forEach((word,i)=>{
      const roles=h.classifyAiCandidateWord({word});
      assert(roles.has(['baseVerb','finiteVerb','finiteVerb','presentParticiple'][i]),word);
      assert(roles.has('verb'),word+' lexical verb');
    });
  });
  check('irregular participles',()=> {
    for(const word of ['gone','seen','eaten','taken','made','got','given','written','spoken','broken'])
      assert(h.classifyAiCandidateWord({word}).has('pastParticiple'),word);
  });
  check('no suffix-only false positives',()=>{
    for(const word of ['when','chicken','golden']) assert(!h.classifyAiCandidateWord({word}).has('finiteVerb'),word);
    assert(!h.classifyAiCandidateWord({word:'family'}).has('adverb'));
  });
  for(const [role,words] of Object.entries({
    beAuxiliary:'am is are was were be been being',doAuxiliary:'do does did',haveAuxiliary:'have has had',
    modal:'can could will would shall should may might must'
  })) check(role,()=>words.split(' ').forEach(word=>assert(h.classifyAiCandidateWord({word}).has(role),word)));
  check('pronouns and determiner ambiguity',()=>{
    for(const word of ['who','whom','what','which','that','this','these','those','he','she','they','we','I','you','him','her','them','us'])
      assert(h.classifyAiCandidateWord({word}).has('pronoun'),word);
    for(const word of ['my','your','his','her','our','their'])
      assert(h.classifyAiCandidateWord({word}).has('possessiveDeterminer'),word);
    assert(h.classifyAiCandidateWord({word:'who'}).has('objectPronoun'));
    assert(h.classifyAiCandidateWord({word:'that'}).has('conjunction'));
  });
  check('auxiliaries retain the forms needed by other auxiliaries',()=>{
    for(const word of ['be','do','have']) assert(h.classifyAiCandidateWord({word}).has('baseVerb'),word);
    for(const word of ['been','done','had']) assert(h.classifyAiCandidateWord({word}).has('pastParticiple'),word);
    assert(h.classifyAiCandidateWord({word:'being'}).has('presentParticiple'));
    const s=state(h,'He will be ready.',2);
    assert(score(h,s,'be')>score(h,s,'was'));
  });
  check('multi-role lexical verbs',()=>['run','play','watch','pet'].forEach(word=>{
    const r=h.classifyAiCandidateWord({word});assert(r.has('noun')&&r.has('baseVerb'));
  }));
  check('solved proper name remains a subject',()=>{
    const s=state(h,'Susan loves Tom.',1);
    assert(h.classifyVisibleAiWord('Susan').has('properNoun'));
    assert(score(h,s,'loves')>score(h,s,'old')*2);
    assert.deepEqual([...h.classifyVisibleAiWord('Susan')].sort(),[...h.classifyAiCandidateWord({word:'Susan'})].sort());
  });
  check('hidden-answer independence really changes DOM answers',()=>{
    const s=state(h,'The cat sat on the mat.',2,[0,1,4,5]);
    const snapshot=JSON.stringify(h.inferAiTargetRoles(s.target));
    for(const i of [2,3]) h.groups[i].querySelectorAll().forEach(b=>b.dataset.letter='z');
    s.target.answer='zzz';
    assert.equal(JSON.stringify(h.inferAiTargetRoles(s.target)),snapshot);
  });
  check('one public clue is not duplicated through adjacency aliases',()=>{
    const s=state(h,'The cat sat.',2,[1]);
    const first=h.inferAiTargetRolesFromContext(s.context);
    const duplicate={...s.context,visibleBefore:[...s.context.visibleBefore,...s.context.visibleBefore]};
    assert.equal(JSON.stringify(h.inferAiTargetRolesFromContext(duplicate)),JSON.stringify(first));
  });
  check('non-adjacent evidence respects predicate scope',()=>{
    const s=state(h,'She really loves Tom.',3,[0,2]);
    assert(score(h,s,'him')>score(h,s,'go'));
    const gap=state(h,'The cat sat on the mat.',2,[0,1,4,5]);
    assert(score(h,gap,'sat')>score(h,gap,'rat'));
  });
  check('two-gap complement is not a second subject predicate',()=>{
    const s=state(h,'The cat sat on the mat.',3,[0,1,4,5]);
    assert(score(h,s,'on')>score(h,s,'go'));
  });
  check('recorded answer-state middle blank can be a predicate before a name',()=>{
    const s=state(h,'She loves Tom.',1,[2]);
    assert(score(h,s,'loves')>score(h,s,'their'));
  });
  check('unresolved prepositional object allows an article',()=>{
    const s=state(h,'The cat sat on the mat.',4,[0,1,2,3]);
    assert(score(h,s,'the')>score(h,s,'go'));
  });
  check('unresolved WH construction keeps both inversion and subject-WH plausible',()=>{
    const s=state(h,'Who does Susan love?',1,[0]);
    assert(score(h,s,'does')>score(h,s,'loves'));
    assert(score(h,s,'loves')>score(h,s,'who'));
  });
  check('prepositional phrase noun is not a fresh subject',()=>{
    const s=state(h,'The cat on the mat sat.',5);
    assert(!s.roles.evidence?.some(e=>e.kind==='subject-predicate'&&e.anchors.includes(4)));
  });
  check('soft punctuation bounds distant propagation',()=>{
    const s=state(h,'She loves Tom; John left.',4,[0,1,2]);
    assert.equal(s.context.visibleBefore.length,0);
    assert(!s.context.sentenceInitial);
  });
  check('hard punctuation bounds evidence',()=>{
    const s=state(h,'Who does Susan love? She loves Tom.',5,[0,1,2,3]);
    assert(!s.context.questionEvidence);
    assert.equal(s.context.visibleBefore.length,0);
  });
  check('confidence grows without negative role probabilities',()=>{
    const a=state(h,'The cat sat on the mat.',2,[]).roles;
    const b=state(h,'The cat sat on the mat.',2,[1]).roles;
    const c=state(h,'The cat sat on the mat.',2,[0,1,3,4,5]).roles;
    assert(b.confidence>a.confidence&&c.confidence>=b.confidence);
    assert(c.ranked.every(x=>x.probability>=0));
  });
  for(const [text,index,pattern,good,bad] of [
    ['The cat sat on the mat.',3,'_n',['on','in'],['an']],
    ['The cat sat on the mat.',2,'__t',['sat','sit','pet'],['rat','art','yet']],
    ['She loves Tom.',0,'S__',['She','Sam','Son'],['Sad']],
    ['Who does Susan love?',3,'lo__',['love','look','lose'],['long']],
    ['She loves Tom.',1,'love_',['loves'],['lover']]
  ]) check('filtered '+pattern+' '+text,()=>{
    const s=state(h,text,index,undefined,pattern);
    const pool={targetSlot:s.target,targetLength:s.target.length,candidates:[...good,...bad,'zzzzzz'].map(word=>({word,sources:[4],sourcePrior:1}))};
    const dist=h.getAiCandidateDistribution(pool,6);
    assert(!dist.some(x=>x.candidate.word==='zzzzzz'));
    for(const a of good) for(const b of bad) {
      const x=dist.find(x=>x.candidate.word===a),y=dist.find(x=>x.candidate.word===b);
      assert(x&&y);assert(x.heuristicProbability>y.heuristicProbability);
    }
    assert.deepEqual(s.roles.weights,h.inferAiTargetRoles(s.target).weights);
  });
  check('assistance is the unchanged mixture',()=>{
    const s=state(h,'She loves Tom.',1);
    const pool={targetSlot:s.target,targetLength:5,candidates:['loves','likes','lover'].map(word=>({word,sources:[4],sourcePrior:1}))};
    const settings=JSON.parse(JSON.stringify(h.aiLogicSettings));
    for(const c of [0,15,100]){
      h.getCorrectGuessChance=()=>c;
      const d=h.getAiCandidateDistribution(pool,6);
      d.forEach(x=>assert(Math.abs(x.probability-((1-c/100)*x.heuristicProbability+(x.isCorrect?c/100:0)))<1e-12));
      assert(Math.abs(d.reduce((n,x)=>n+x.probability,0)-1)<1e-12);
    }
    h.aiLogicSettings=settings;
  });
  check('answer identity does not override grammar at zero assistance',()=>{
    const s=state(h,'The his sat.',1);
    h.getCorrectGuessChance=()=>0;
    const pool={targetSlot:s.target,targetLength:3,candidates:[
      {word:'his',sources:[2],sourcePrior:1},{word:'cat',sources:[3],sourcePrior:1} ]};
    const d=h.getAiCandidateDistribution(pool,1);
    assert(d[0].isCorrect&&d[0].probability<d[1].probability);
    const scores=[1,2,3,4].map(source=>h.scoreAiCandidateForGrammar({word:'cat',sources:[source]},s.context));
    assert(scores.every(x=>x===scores[0]),'vault identity is not grammar');
  });
  check('weighted sampling still varies and retains grammar mismatches',()=>{
    const s=state(h,'The cat sat on the mat.',2);
    h.getCorrectGuessChance=()=>0;
    const pool={targetSlot:s.target,targetLength:3,candidates:['sat','pet','rat'].map(word=>({word,sources:[4],sourcePrior:1}))};
    const d=h.getAiCandidateDistribution(pool,1);
    const counts={sat:0,pet:0,rat:0};
    for(let i=0;i<5000;i++) counts[h.chooseFinalAiCandidate(pool,1).word]++;
    d.forEach(x=>assert(Math.abs(counts[x.candidate.word]/5000-x.probability)<0.03));
    assert(counts.rat>0&&counts.sat>counts.rat*3&&counts.pet>counts.rat*3);
  });
  console.log(checks+' passed; '+failures+' failed');
  if(failures) process.exitCode=1;
}
if(require.main===module) main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={state,score,cases};
