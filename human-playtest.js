// Upgrade 1: public board -> completions/context -> opportunities -> bounded choice.
// Receives public snapshots and general lexical data only. No puzzle/answer access.
(function (global) {
  'use strict';
  const POLICY = Object.freeze({ version:'human-playtest-upgrade-1-repair-4', supportBoost:1.25 });
  const normalize = w => String(w || '').toLowerCase().replace(/[’‘]/g,"'").replace(/[‐‑]/g,'-');
  const tokenLetters = w => normalize(w).replace(/[^a-z]/g,'');
  const shortWords=new Set('a i am an as at be by do go he if in is it me my no of oh on or ox so to up us we ad ah aw ax eh em er ex ha hi hm ho ma mm oh oi ok om ow pa pi uh um'.split(' '));
  const boundForms=new Set('multi anti pre post non cine'.split(' '));
  // General non-prose abbreviations/domain suffixes present in dictionaries.
  const proseAbbreviations=new Set('com org edu gov www inc ltd etc approx dept'.split(' '));
  const closedClasses={
    article:'a an the', determiner:'this that these those', possessive:'my your his her its our their',
    quantifier:'some any all many few no enough both several each every one two three four five six seven eight nine ten most much',
    coordinator:'and or but nor', preposition:'at in on to of for from with by near about into over under after before',
    pronoun:'i you he she it we they me him her us them who what', auxiliary:'am is are was were be been being has have had do does did',
    modal:'can could will would shall should may might must', negator:'not'
  };
  const closedWords=new Set(Object.values(closedClasses).join(' ').split(' '));
  const frameGroups={
    DIRECT_TRANSITIVE:'love like know see visit want need buy purchase invite tell give carry use find make read write build hear remember meet help',
    OPTIONAL_TRANSITIVE:'bathe wash eat drink cook sing play drive study learn feel',
    INTRANSITIVE:'arrive come go happen sleep die rain swim',
    PREPOSITIONAL_COMPLEMENT:'look live care listen smile laugh wait depend belong refer',
    COPULAR:'seem become appear remain'
  };
  const frames=new Map();for(const [family,words] of Object.entries(frameGroups))for(const w of words.split(' '))frames.set(w,family);
  const framePrepositions={look:['at','for','into'],live:['with','near','in','at','on'],care:['for','about'],listen:['to'],smile:['at'],laugh:['at','with'],wait:['for'],depend:['on'],belong:['to'],refer:['to']};
  function verbFrame(a,word) {for(const lemma of [...(a?.lemmas||[]),normalize(word)])if(frames.has(lemma))return {family:frames.get(lemma),lemma};return null;}
  const contractions=new Map();
  for(const [word,aux] of Object.entries({"don't":'do',"doesn't":'does',"didn't":'did',"can't":'can',"couldn't":'could',"won't":'will',"wouldn't":'would',"shouldn't":'should',"mustn't":'must',"isn't":'is',"aren't":'are',"wasn't":'was',"weren't":'were',"hasn't":'has',"haven't":'have',"hadn't":'had'}))contractions.set(word,aux);
  for(const pronoun of ['i','you','he','she','it','we','they','that','there','who','what'])
    for(const suffix of ["'s","'re","'ve","'ll","'d","'m"])
      if((suffix==="'m"&&pronoun==='i')||(suffix==="'s"&&!['i','you','we','they'].includes(pronoun))||(["'re","'ve"].includes(suffix)&&['you','we','they'].includes(pronoun))||["'ll","'d"].includes(suffix))contractions.set(pronoun+suffix,'subject');
  contractions.set("i've",'subject');
  let resourcePromise,language={pos:Object.create(null),names:Object.create(null),nameSourceMembership:Object.create(null),phrases:[],punctuated:[]},phrases=new Set(),punctuated=new Set(),resourceWords=[];
  async function loadResources() {
    if(!resourcePromise)resourcePromise=global.fetch('assets/language/human-playtest-language.json').then(r=>{if(!r.ok)throw Error('Playtest language resource unavailable');return r.json();}).then(data=>{
      if(data.format!=='ggg-human-language-v1')throw Error('Invalid playtest language resource');
      language={...data,pos:Object.assign(Object.create(null),data.pos),names:Object.assign(Object.create(null),data.names),nameSourceMembership:Object.assign(Object.create(null),data.nameSourceMembership||{})};phrases=new Set(data.phrases);punctuated=new Set(data.punctuated);
      resourceWords=[...closedWords,...Object.keys(data.names),...contractions.keys(),...data.punctuated];return data;
    });
    return resourcePromise;
  }
  function nameFamiliarity(word){return language.names[normalize(word)]||0;}
  function nameSourceMembership(word){return language.nameSourceMembership[normalize(word)]||null;}
  function extraWords(){return resourceWords;}
  function lexicalClass(word,dictionary,zipf,publicEntity=false) {
    word=normalize(word);
    if(publicEntity)return 'public-entity';
    if(proseAbbreviations.has(word))return null;
    if(contractions.has(word))return 'contraction';
    if(word.length<=2)return shortWords.has(word)?'ordinary':null;
    if(nameFamiliarity(word)&&!dictionary.isAccepted(word))return 'given-name';
    if(word.length===3&&(!/[aeiouy]/.test(word)||zipf<3.7))return nameFamiliarity(word)?'given-name':null;
    if(/^[a-z]+$/.test(word)&&dictionary.isAccepted(word))return boundForms.has(word)?'bound-or-marginal-standalone':'ordinary';
    if(word.length>=4&&dictionary.isProperWord(word)&&zipf>=3)return 'dictionary-capitalized';
    if(punctuated.has(word))return 'punctuated';
    return nameFamiliarity(word)?'given-name':null;
  }
  const has = (a,...roles) => roles.some(r => a?.roles?.includes?.(r) || a?.roles?.has?.(r));
  const verb = a => has(a,'verb','finiteVerb','baseVerb','pastParticiple','presentParticiple','auxiliary');
  const det = a => has(a,'article','determiner','possessiveDeterminer');
  const nominal = a => has(a,'noun','properNoun','subjectPronoun','objectPronoun');
  const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
  // Bounded semantic categories, shared across constructions, never answer lists.
  const semanticLists={
    PERSON:'mother father parent sister brother son daughter aunt uncle cousin friend teacher student doctor nurse boy girl man woman person people child children baby nobody somebody someone anyone everyone',
    ANIMAL:'cat dog bird fish horse cow pig sheep goat lion tiger bear rabbit mouse rat fox wolf owl duck hen chicken pet animal',
    PLACE:'city town village country school office house home hospital shop store market park garden beach street airport station restaurant library',
    TIME:'monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december day night morning evening week month year hour minute season summer winter spring autumn',
    FOOD:'bread milk cheese syrup rice meat butter cream ice sugar salt flour egg apple orange banana potato tomato soup coffee tea water cake fruit vegetable food maple peanut sushi',
    THING:'table chair desk door window computer phone pencil pen book bag box car train boat machine tool ball cup plate bottle art idea plan point'
  };
  const semantics=new Map();
  for(const [kind,words] of Object.entries(semanticLists))for(const w of words.split(' ')) {
    const classes=[kind,...(['PERSON','ANIMAL'].includes(kind)?['ANIMATE']:[])];
    semantics.set(w,classes);semantics.set(w+(/(s|x|ch|sh)$/.test(w)?'es':'s'),classes);
  }
  function semanticClasses(word,analysis,proper=false) {
    const known=semantics.get(normalize(word));if(known)return known;
    for(const lemma of analysis?.lemmas||[])if(semantics.has(lemma))return semantics.get(lemma);
    return proper&&nameFamiliarity(word)?['PERSON','ANIMATE']:[];
  }
  // Small general lexical supplement, separate from the unchanged normal engine.
  // These are grammatical readings, not candidate additions or puzzle answers.
  const lexical = new Map();
  function addReading(word,roles,lemma=word) {
    const old=lexical.get(word)||{roles:[],lemmas:[]};
    lexical.set(word,{roles:[...new Set([...old.roles,...roles])],lemmas:[...new Set([...old.lemmas,lemma])]});
  }
  for(const noun of 'game music computer device story movie letter picture number city country place idea problem question sentence word language puzzle student parent animal bird fish tree flower road street office town village market kitchen door floor chair desk phone paper money job life night morning evening week month year minute hour world team player sport fact reason way thing part point people'.split(' ')) {
    addReading(noun,['noun']);
    if(!['music','money','people','fish'].includes(noun))addReading(noun==='life'?'lives':/[^aeiou]y$/.test(noun)?noun.slice(0,-1)+'ies':noun+'s',['noun'],noun);
  }
  for(const [base,past,part] of [['set','set','set'],['put','put','put'],['cut','cut','cut'],['sleep','slept','slept'],['meet','met','met'],['feel','felt','felt'],['keep','kept','kept'],['stand','stood','stood'],['forget','forgot','forgotten'],['panic','panicked','panicked']]) {
    addReading(base,['verb','baseVerb']);addReading(base+'s',['verb','finiteVerb'],base);
    addReading(past,['verb','finiteVerb'],base);addReading(part,['verb','pastParticiple'],base);
    addReading(base+(['set','put','cut','forget'].includes(base)?base.at(-1):base==='panic'?'k':'')+'ing',['verb','presentParticiple'],base);
  }
  addReading('lite',['adjective']); // ordinary informal adjective, not a fabricated verb
  function enrichAnalysis(base) {
    const word=normalize(base.word),roles=new Set(base.roles),lemmas=new Set(base.lemmas),extra=lexical.get(word);
    // Closed grammatical classes use the existing curated readings. An obscure
    // dictionary noun sense of "have" must not erase auxiliary evidence.
    const codes=has(base,'auxiliary','pronoun','questionWord','particle','determiner','possessiveDeterminer','possessivePronoun','article','preposition','conjunction')||
      (has(base,'adverb')&&!has(base,'noun','verb'))?'':language.pos[word]||'';
    if(extra){extra.roles.forEach(r=>roles.add(r));extra.lemmas.forEach(l=>lemmas.add(l));}
    if(semantics.has(word)&&!has(base,'auxiliary','pronoun','preposition','conjunction'))roles.add('noun');
    const map={N:'noun',p:'noun',A:'adjective',v:'adverb',C:'conjunction',P:'preposition',D:'article',I:'article',r:'pronoun'};
    for(const code of codes)if(map[code])roles.add(map[code]);
    let primaryNoun=codes.startsWith('N')||codes.startsWith('p'),pluralNoun=codes.includes('p');
    for(const lemma of [word.replace(/ies$/,'y'),word.replace(/es$/,''),word.replace(/s$/,'')]) {
      if(lemma===word||!(language.pos[lemma]||'').includes('N'))continue;
      const plural=/[^aeiou]y$/.test(lemma)?lemma.slice(0,-1)+'ies':lemma+(/(s|x|ch|sh)$/.test(lemma)?'es':'s');
      if(word===plural){roles.add('noun');lemmas.add(lemma);pluralNoun=true;primaryNoun ||= language.pos[lemma].startsWith('N');}
    }
    // Only generate morphology from an independently attested verb lemma.
    if(/[ti]/.test(codes)){roles.add('verb');roles.add('baseVerb');}
    for(const lemma of [word.replace(/ies$/,'y'),word.replace(/es$/,''),word.replace(/s$/,''),word.replace(/ed$/,''),word.replace(/d$/,''),word.replace(/ing$/,''),word.replace(/ing$/,'e')]) {
      if(lemma===word||!/[ti]/.test(language.pos[lemma]||''))continue;
      const third=/[^aeiou]y$/.test(lemma)?lemma.slice(0,-1)+'ies':lemma+(/(s|x|z|ch|sh|o)$/.test(lemma)?'es':'s');
      const past=lemma.endsWith('e')?lemma+'d':/[^aeiou]y$/.test(lemma)?lemma.slice(0,-1)+'ied':lemma+'ed';
      const ing=lemma.replace(/e$/,'')+'ing';
      if(word===third){roles.add('verb');roles.add('finiteVerb');roles.add('thirdSingular');lemmas.add(lemma);}
      if(word===past){roles.add('verb');roles.add('finiteVerb');roles.add('pastParticiple');roles.add('pastTense');lemmas.add(lemma);}
      if(word===ing){roles.add('verb');roles.add('presentParticiple');lemmas.add(lemma);}
    }
    for(const lemma of lemmas) {
      const third=/[^aeiou]y$/.test(lemma)?lemma.slice(0,-1)+'ies':lemma+(/(s|x|z|ch|sh|o)$/.test(lemma)?'es':'s');
      if(word===third&&roles.has('finiteVerb'))roles.add('thirdSingular');
    }
    if(roles.has('finiteVerb')&&!roles.has('thirdSingular')&&!roles.has('auxiliary'))roles.add('pastTense');
    if(contractions.has(word)) {
      const aux=contractions.get(word);roles.add('contraction');
      if(aux==='subject')roles.add('subjectPronoun');
      else {roles.add('auxiliary');roles.add('finiteVerb');roles.add(['do','does','did'].includes(aux)?'doAuxiliary':['has','have','had'].includes(aux)?'haveAuxiliary':['is','are','was','were'].includes(aux)?'beAuxiliary':'modal');}
    }
    // Source-first ordinary readings and the existing curated core distinguish
    // inflections from a secondary base sense (e.g. found = establish).
    const primaryVerb=has(base,'verb')||has(extra,'verb')||/^[Vti]/.test(codes)||[...lemmas].some(l=>/^[Vti]/.test(language.pos[l]||''));
    const ordinaryBase=has(base,'baseVerb')||has(extra,'baseVerb')||(/^[ti]/.test(codes)&&!has(base,'finiteVerb','pastParticiple'));
    const transitive=primaryVerb&&([...lemmas,word].some(l=>(language.pos[l]||'').includes('t'))||has(base,'verb'))&&
      ![...lemmas,word].some(l=>'arrive come sleep swim happen rain go sit stand'.split(' ').includes(l));
    return {...base,word,primaryVerb,ordinaryBase,transitive,primaryNoun,pluralNoun,primaryAdjective:has(base,'adjective')&&!has(base,'noun'),known:base.known||roles.size>0,roles:[...roles],lemmas:[...lemmas]};
  }
  const vocabularyCache=new Map(), patternCache=new Map(), rankingCache=new Map(), attention=new Map();
  function boundedSet(cache,key,value,limit=128) {
    if(cache.size>=limit)cache.delete(cache.keys().next().value);
    cache.set(key,value);return value;
  }
  function cachedVocabulary(key,build) {
    if(!vocabularyCache.has(key))vocabularyCache.set(key,build());
    return vocabularyCache.get(key);
  }
  function tokenAt(slot,letters=slot.letters.map(l=>l.visible===null?'_':l.visible).join('')) {
    return [...letters].map((l,i)=>l+(i<slot.letters.length-1?normalize(slot.gaps[i+1]||''):'')).join('');
  }
  function pattern(slot) { return tokenAt(slot); }
  function matchesToken(word,slot) {
    const normalized=normalize(word),letters=tokenLetters(word);
    return /^[a-z]+(?:['-][a-z]+)*$/.test(normalized)&&letters.length===slot.letters.length&&
      tokenAt(slot,letters)===normalized&&slot.letters.every((l,i)=>l.visible===null||normalize(l.visible)===letters[i]);
  }
  function matchesCasePattern(surface,slotOrFlags) {
    const flags=Array.isArray(slotOrFlags)?slotOrFlags:slotOrFlags?.letters?.map(letter=>letter.capital);
    const letters=Array.from(String(surface??'')).filter(character=>/^[A-Za-z]$/.test(character));
    return Array.isArray(flags)&&letters.length===flags.length&&letters.every((character,index)=>
      (character!==character.toLowerCase())===Boolean(flags[index]));
  }
  function surfaceForSlot(surface,slot,sentenceInitial=false) {
    const chars=Array.from(String(surface??'')),flags=slot.letters.map(letter=>Boolean(letter.capital));
    if(sentenceInitial&&flags[0]&&chars[0]&&/^[a-z]$/.test(chars[0]))chars[0]=chars[0].toUpperCase();
    const adjusted=chars.join('');
    return matchesCasePattern(adjusted,flags)?adjusted:null;
  }
  // Rejections are a set for public-board identity. Preserve live insertion
  // order elsewhere, but canonicalize this identity representation so Stage 2,
  // candidate preparation, and Stage 3 compare equivalent boards equally.
  function boardKey(state) {
    const rejected = Object.fromEntries(Object.entries(state.rejectedWordsBySlot || {})
      .map(([index, words]) => [index, [...new Set(words || [])].sort()]));
    return JSON.stringify([state.slots, state.spacing, rejected]);
  }
  function boardId(state) {
    let hash=2166136261;
    for(const c of boardKey(state))hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
    return 'public-'+hash.toString(16).padStart(8,'0');
  }
  function sentence(state) {
    const i=state.targetSlotIndex;let start=i,end=i;
    while(start>0&&!/[.!?]/.test(state.slots[start-1].trailing))start--;
    while(end<state.slots.length-1&&!/[.!?]/.test(state.slots[end].trailing))end++;
    return {start,end,question:/\?/.test(state.slots[end].trailing)};
  }
  function properContext(state) {
    const i=state.targetSlotIndex,slot=state.slots[i],span=sentence(state);
    const capital=slot.letters[0]?.capital&&slot.letters.length>1;
    // Initial capitalization is orthographic sentence syntax, not public
    // evidence that the slot contains a name. Name routing starts only when a
    // capitalized slot is elsewhere in the sentence.
    const genuine=Boolean(capital&&i!==span.start);
    return {active:genuine,strong:genuine,sentenceInitial:i===span.start};
  }
  function retrieve(vocabulary,slot,rejected,key) {
    const signature=key+':'+normalize(pattern(slot))+':'+slot.letters.map(letter=>letter.capital?'U':'l').join('');
    let matches=key&&patternCache.get(signature);
    if(!matches) {
      matches=vocabulary.filter(c=>matchesToken(c.word,slot));
      if(key)boundedSet(patternCache,signature,matches);
    }
    const blocked=new Set(rejected||[]);
    return matches.filter(c=>!blocked.has(normalize(c.word)));
  }
  // Practical construction predictions are graded, not syntax certificates.
  // Role fits concern ordinary lexical readings and are never answer lists.
  const personModifiers=new Set('poor dear young old little beloved elderly brave clever honest kind lovely lucky lonely happy sad gentle sweet late famous notorious'.split(' '));
  const timeDeterminers=new Set('last next this every each previous following'.split(' '));
  const people=new Set('mother father parent sister brother son daughter aunt uncle friend teacher student man woman boy girl person people child children nobody somebody someone anybody anyone everyone everybody he she him her they them who'.split(' '));
  function subjectNumber(analysis,word) {
    if(['i','you','we','they'].includes(word))return word==='i'?'first':'plural';
    if(['he','she','it','who','nobody','somebody','someone','anybody','anyone','everyone','everybody','this','that'].includes(word))return 'singular';
    if(has(analysis,'properNoun'))return !nameFamiliarity(word)&&/(?:ians|ans|ese)$/.test(word)&&word.length>4?'plural':'singular';
    if(has(analysis,'noun'))return analysis.pluralNoun||(language.pos[word]||'').includes('p')||analysis.lemmas?.some(l=>l!==word&&has({roles:enrichAnalysis({word:l,roles:[],lemmas:[l]}).roles},'noun'))?'plural':'singular';
    return null;
  }
  function construction(state,visible, pilotOwned=false) {
    const i=state.targetSlotIndex,span=sentence(state),profiles=[];
    const usable=j=>j>=span.start&&j<=span.end&&state.slots[j].solved;
    const a=j=>usable(j)?visible[j]:null;
    const word=j=>a(j)?normalize(tokenAt(state.slots[j])):'';
    const leftBoundary=i===span.start||/[,;:]/.test(state.slots[i-1].trailing);
    const rightBoundary=i===span.end||/[,;:]/.test(state.slots[i].trailing);
    const left=leftBoundary?null:a(i-1),right=rightBoundary?null:a(i+1);
    const add=(reason,roles,strength=1,mismatch=0.07)=>profiles.push({reason,roles,strength,mismatch});
    const subject={subjectPronoun:9,properNoun:9,noun:5,article:2,determiner:2,possessiveDeterminer:2};
    const object={objectPronoun:9,noun:7,properNoun:9,possessivePronoun:7,article:3,determiner:3,possessiveDeterminer:3};
    const questionOpening=span.question&&i===span.start;
    const auxIndex=has(a(span.start),'questionWord')?span.start+1:span.start;
    const aux=a(auxIndex),sub=a(auxIndex+1);
    const invertedSubject=span.question&&has(aux,'auxiliary')&&i===auxIndex+1;
    let requiredForm=null,personLike=false,number=null,subjectWord='',predicate=false,objectPosition=false;
    // Parse a small, contiguous visible subject span. Comma-delimited names
    // can be appositives; conjunction is number evidence, not discourse memory.
    const before=[];
    for(let j=i-1;j>=Math.max(span.start,i-9)&&a(j);j--)before.unshift({a:a(j),word:word(j),index:j});
    const last=before.at(-1),prev=before.at(-2);
    const rightPredicate=verb(right)&&((has(right,'thirdSingular','pastTense')&&!right.primaryNoun)||has(a(i+2),'objectPronoun'));
    const objectCompound=has(left,'noun')&&!has(left,'thirdSingular','pastTense')&&(has(prev?.a,'preposition')||
      (verb(prev?.a)&&!has(prev?.a,'properNoun')&&(!nominal(prev?.a)||has(prev?.a,'finiteVerb')||(has(a(i-3),'subjectPronoun')&&!det(a(i-3))))));
    const leftVerb=verb(left)&&(has(left,'thirdSingular','pastTense','presentParticiple')||!nominal(left)||(nominal(prev?.a)&&!det(prev?.a)));
    if(last&&!invertedSubject&&!questionOpening&&!has(last.a,'auxiliary')&&!det(last.a)&&!leftVerb&&nominal(last.a)) {
      number=subjectNumber(last.a,last.word);subjectWord=last.word;
      predicate=Boolean(number)&&(!prev||det(prev.a)||nominal(prev.a)||prev.word==='and'||has(last.a,'subjectPronoun'));
      const and=before.findIndex(e=>e.word==='and');
      if(and>0&&before.slice(0,and).some(e=>nominal(e.a))&&before.slice(and+1).some(e=>nominal(e.a))) {number='plural';predicate=true;subjectWord='coordinated subject';}
    }
    if(last&&has(last.a,'subjectPronoun')&&!has(last.a,'auxiliary')&&(last.word!=='who'||last.index===span.start)) {
      number=subjectNumber(last.a,last.word);subjectWord=last.word;predicate=true;
    }
    if(objectCompound){predicate=false;number=null;add('object noun phrase after verb or preposition',{nounHead:18,noun:5,adjective:3},1,0.02);}
    if(questionOpening) {
      if(has(right,'auxiliary'))add('question: interrogative before auxiliary',{questionWord:14});
      else if(has(right,'subjectPronoun','properNoun')||(has(right,'noun')&&!verb(right))) {
        const complement=a(i+2);
        if(has(complement,'adjective','presentParticiple')&&!has(complement,'baseVerb'))
          add('question: copula before subject/complement',{beAuxiliary:15});
        else if(has(complement,'baseVerb'))add('question: auxiliary before subject/base verb',{doAuxiliary:13,modal:11});
        else if(has(complement,'pastParticiple'))add('question: auxiliary before subject/participle',{haveAuxiliary:13,beAuxiliary:9});
        else add('question: auxiliary before visible subject',{doAuxiliary:10,modal:10,beAuxiliary:10,haveAuxiliary:8},0.9);
      } else if(has(right,'finiteVerb'))add('question: interrogative subject before finite verb',{questionSubject:14});
      else add('question opening',{questionWord:9,doAuxiliary:6,modal:6,beAuxiliary:6,haveAuxiliary:4},0.8,0.16);
    } else if(i===span.start&&span.end>i&&!right) {
      add('sentence opening',{subjectPronoun:4,article:4,determiner:3,possessiveDeterminer:3,
        properNoun:2,noun:1.6,baseVerb:2,adverb:1.5},0.4,0.65);
    }
    if(!left&&i>span.start&&has(right,'properNoun')&&nameFamiliarity(word(i+1))&&!questionOpening){predicate=true;number=null;}
    // Two-sided evidence: noun phrase opening versus predicate position.
    if(has(right,'noun')&&!(word(i-1)==='to'&&right.primaryAdjective)&&!rightPredicate&&!has(right,'subjectPronoun','objectPronoun')&&!questionOpening&&!invertedSubject&&!predicate) {
      if(det(left))add('modifier after determiner before noun',{adjective:10,noun:4,presentParticiple:3,pastParticiple:3});
      else if(!left||verb(left)||has(left,'preposition','conjunction'))
        add('noun phrase before visible noun',{article:12,determiner:11,possessiveDeterminer:12,adjective:6,noun:2.5},verb(left)?1:0.9);
    } else if(det(left))add('noun phrase after determiner',rightPredicate?{nounHead:18,noun:8,properNoun:12}:{noun:11,properNoun:7,adjective:5,presentParticiple:3,pastParticiple:3},0.95);
    if(!questionOpening&&has(right,'finiteVerb')&&(!has(right,'noun')||has(right,'thirdSingular'))&&(!left||has(left,'conjunction'))) {
      add('subject before visible finite verb',subject);personLike=true;
    }
    if(predicate)add('predicate after visible subject',{finiteVerb:14,baseVerb:12,auxiliary:12,...(!right||verb(right)?{adverb:2}:{})},1,0.025);
    if(predicate&&has(right,'pastParticiple')&&!has(right,'baseVerb')) {
      const after=a(i+2);
      if(has(after,'objectPronoun')||det(after))add('active perfect: participle followed by object',{haveAuxiliary:28,beAuxiliary:0.035},1,0.025);
      else if(word(i+2)==='by')add('passive: participle followed by agent',{beAuxiliary:18,haveAuxiliary:2},1,0.05);
      else add('perfect or passive participle construction',{haveAuxiliary:12,beAuxiliary:10},0.9,0.05);
    }
    let governor=left;
    // Inversion: [WH] AUX SUBJECT ... BASE; no cross-sentence reasoning.
    if(span.question&&has(aux,'auxiliary')) {
      if(invertedSubject){add('question subject after auxiliary',subject);personLike=true;governor=null;}
      else if(i===auxIndex+2&&nominal(sub))governor=aux;
    }
    if(span.question&&i===span.start+1&&has(a(span.start),'questionWord')&&has(right,'subjectPronoun','properNoun','noun'))
      add('question auxiliary between interrogative and subject',{doAuxiliary:12,modal:10,beAuxiliary:4,haveAuxiliary:6});
    if(has(governor,'modal','doAuxiliary'))requiredForm='baseVerb';
    else if(has(governor,'haveAuxiliary')&&(right||rightBoundary)&&!(has(right,'noun')&&!rightPredicate))requiredForm='pastParticiple';
    if(requiredForm)add('auxiliary requires '+requiredForm,{[requiredForm]:14,adverb:2},1,0.035);
    else if(has(left,'beAuxiliary'))add('copula or progressive complement',{adjective:8,presentParticiple:9,pastParticiple:6,noun:3,article:3,preposition:3},0.85,0.12);
    else if(has(left,'preposition')) {
      if(word(i-1)==='to')add('to: infinitive or nominal object',{...object,baseVerb:9},0.7,0.16);
      else add('prepositional object',object,0.9,0.08);
    } else if(leftVerb&&!objectCompound&&(rightBoundary||has(right,'preposition'))) {
      add('object after visible verb',object,1,0.04);objectPosition=true;
    }
    if(leftVerb&&!objectCompound&&verbFrame(left,word(i-1))?.family==='DIRECT_TRANSITIVE')objectPosition=true;
    const animate=before.some(e=>people.has(e.word)||has(e.a,'properNoun'));
    if(objectPosition&&animate){add('animate subject with pronoun-compatible object',{objectPronoun:7,properNoun:5,noun:1},0.85,0.2);personLike=true;}
    if(i===span.start&&state.slots[i].gaps.some(g=>/['’]/.test(g))&&has(right,'baseVerb')&&!has(right,'subjectPronoun'))
      add('negative imperative before base verb',{negativeImperative:24,subjectPronoun:4},1,0.1);
    if(questionOpening&&has(right,'subjectPronoun','properNoun','noun')){number=subjectNumber(right,word(i+1));subjectWord=word(i+1);}
    const andAt=before.map(e=>e.word).lastIndexOf('and');
    const coordinatedAnimate=det(left)&&andAt>=0&&before.slice(0,andAt).some(e=>semanticClasses(e.word,e.a,has(e.a,'properNoun')).includes('ANIMATE'));
    if(!pilotOwned&&coordinatedAnimate)add('parallel animate noun phrase in coordinated subject',{animateNoun:24,nounHead:0.3,noun:0.25,properNoun:12},1,0.025);
    if(word(i-1)==='to'&&has(right,'adjective')&&(right.primaryAdjective||!has(right,'noun')))add('infinitive copula before adjective',{copulaBase:30},1,0.02);
    if(has(left,'finiteVerb','baseVerb')&&has(right,'baseVerb')&&!has(right,'noun')&&!has(left,'auxiliary'))add('infinitive complement marker',{infinitiveMarker:20},1,0.06);
    const pluralRight=has(right,'noun')&&(subjectNumber(right,word(i+1))==='plural'||
      (has(right,'properNoun')&&(/(?:ese|ans|ish)$/.test(word(i+1)))));
    const pluralObject=pluralRight&&(verb(left)||has(left,'preposition')||word(i-1)==='not');
    if(pluralObject){requiredForm=null;add('quantifier before plural nominal object',{pluralQuantifier:24,possessiveDeterminer:12,ordinaryAdjective:4},1,0.008);}
    // A bare personal name in a short fragment takes an ordinary modifier,
    // not the quantifiers used to introduce a common plural noun.
    const bareNameModifier=i===span.start&&i+1===span.end&&has(right,'properNoun')&&nameFamiliarity(word(i+1));
    if(bareNameModifier){profiles.length=0;add('modifier before singular personal name',{personModifier:24,ordinaryAdjective:3},1,0.008);}
    const timeModifier=semanticClasses(word(i+1),right).includes('TIME')&&!predicate&&(!left||has(left,'preposition'));
    if(timeModifier){profiles.length=0;add('time expression before day or period',{timeDeterminer:24,ordinaryAdjective:1},1,0.015);}
    const destination=has(right,'properNoun')||semanticClasses(word(i+1),right).includes('PLACE')||det(right);
    const lexicalBefore=before.filter(e=>verb(e.a)&&!has(e.a,'auxiliary'));
    const governing=lexicalBefore.find(e=>[...e.a.lemmas,e.word].some(w=>/^(buy|purchase|shop|go|walk|drive|travel|live|stay|sit)$/.test(w)));
    let prepositionFamily=null;
    if(destination&&governing&&(!predicate||governing.index<i-1)){
      const lemmas=[...governing.a.lemmas,governing.word];
      if(lemmas.some(w=>['buy','purchase','shop'].includes(w))&&i>governing.index+1)prepositionFamily='sourceLocation';
      else if(lemmas.some(w=>['go','walk','drive','travel'].includes(w)))prepositionFamily='direction';
      else if(lemmas.some(w=>['live','stay','sit'].includes(w)))prepositionFamily='staticLocation';
      if(prepositionFamily){profiles.length=0;requiredForm=null;predicate=false;number=null;add('visible verb and entity/location complement',{[prepositionFamily]:28},1,0.01);}
    }
    const directObject=!pilotOwned&&predicate&&(has(right,'objectPronoun','properNoun')||(has(right,'noun')&&!verb(right)));
    if(directObject)add('finite lexical predicate before direct object',{ordinaryFiniteTransitive:20,copularPredicate:12},1,0.005);
    if(state.slots[i].letters[0]?.capital&&i>span.start&&
      (personModifiers.has(word(i-1))||semanticClasses(word(i-1),left,has(left,'properNoun')).includes('ANIMATE')))personLike=true;
    const listCoordination=!pilotOwned&&i>=span.start+2&&/,/.test(state.slots[i-2].trailing)&&
      [['properNoun','noun'],['baseVerb','verb'],['adjective']].some(roles=>[i-1,i+1].every(j=>has(a(j),...roles)));
    if(listCoordination){profiles.length=0;number=null;predicate=false;requiredForm=null;add('final coordinator in parallel list',{listAnd:30,listOther:12},1,0.015);}
    const comma=state.slots.findIndex((s,j)=>j>=span.start&&j<span.end&&/,/.test(s.trailing));
    const conditionalOpening=i===span.start&&!span.question&&comma>i+1&&has(a(i+1),'subjectPronoun','noun','properNoun')&&
      has(a(comma+1),'subjectPronoun','noun','properNoun')&&verb(a(comma+2));
    if(conditionalOpening)add('subordinate clause before visible main clause',{conditionalIf:12,conditionalAs:4,conjunction:6},0.85,0.15);
    const parallelWords=[];
    for(let j=span.start+1;j<=span.end;j++) {
      if(j===i||!a(j)||!word(i-1)||word(j-1)!==word(i-1)||!state.slots[j].solved)continue;
      const between=state.slots.slice(Math.min(i,j)+1,Math.max(i,j));
      if(!between.some(s=>s.solved&&['and','or','but'].includes(normalize(tokenAt(s)))))continue;
      const flank=k=>has(a(k),'noun','properNoun')||state.slots[k]?.letters[0]?.capital;
      if(flank(i+1)&&flank(j+1)&&tokenLetters(word(j)).length===state.slots[i].letters.length)parallelWords.push(word(j));
    }
    // Parallel possessive noun phrases, still within this sentence only.
    const possessiveParallel=!pilotOwned&&word(i-1)==='and'&&has(right,'noun')&&has(a(i-3),'possessiveDeterminer')&&has(a(i-2),'noun');
    if(possessiveParallel){parallelWords.push(word(i-3));profiles.length=0;predicate=false;number=null;
      add('parallel possessive noun phrase',{possessiveDeterminer:24,article:10,determiner:8},1,0.015);}
    let closedFamily=null;
    if(listCoordination)closedFamily=closedClasses.coordinator.split(' ');
    else if(prepositionFamily)closedFamily=closedClasses.preposition.split(' ');
    else if(possessiveParallel)closedFamily=[...closedClasses.possessive.split(' '),...closedClasses.article.split(' '),...closedClasses.determiner.split(' ')];
    else if(pluralObject)closedFamily=[...closedClasses.quantifier.split(' '),...closedClasses.possessive.split(' ')];
    else if(word(i-1)==='to'&&has(right,'adjective')&&(right.primaryAdjective||!has(right,'noun')))closedFamily=['be'];
    const governorFrame=verbFrame(left,word(i-1));
    if(!pilotOwned&&destination&&governorFrame?.family==='PREPOSITIONAL_COMPLEMENT') {
      closedFamily=framePrepositions[governorFrame.lemma];profiles.length=0;predicate=false;number=null;requiredForm=null;
      add('prepositional verb complement',{licensedPreposition:24},1,0.01);
    }
    const negativeHave=has(left,'haveAuxiliary')&&has(a(i-2),'doAuxiliary');
    // Postnominal purchase/location entities must not automatically be people.
    const purchaseLocation=['at','in','from'].includes(word(i-1))&&before.some(e=>verbFrame(e.a,e.word)?.lemma==='buy'||verbFrame(e.a,e.word)?.lemma==='purchase');
    if(purchaseLocation)personLike=false;
    const expectedSemantic=[];
    const itemPosition=(/,/.test(state.slots[i].trailing)||['and','or'].includes(word(i-1)))&&!listCoordination;
    if(itemPosition)for(let j=span.start;j<=span.end;j++)if(a(j)&&j!==i&&
      (/,/.test(state.slots[j].trailing)||['and','or'].includes(word(j-1))))expectedSemantic.push(...semanticClasses(word(j),a(j),has(a(j),'properNoun')));
    if(objectPosition&&word(i-1))for(let j=span.start;j<i-1;j++)if(word(j)===word(i-1)&&a(j+1)&&
      state.slots.slice(j+1,i-1).some(s=>s.solved&&normalize(tokenAt(s))==='and'))expectedSemantic.push(...semanticClasses(word(j+1),a(j+1)));
    const pluralRequired=new Set('few many several both two three four five six seven eight nine ten these those'.split(' '));
    const singularRequired=new Set('a an one each every this that'.split(' '));
    const nounNumber=pilotOwned?null:pluralRequired.has(word(i-1))?'plural':singularRequired.has(word(i-1))?'singular':null;
    const rightNumber=!pilotOwned&&has(right,'noun')&&!has(right,'properNoun')?subjectNumber(right,word(i+1)):null;
    const standaloneAnd=i===span.start&&!state.slots.slice(0,span.start).some(s=>s.solved);
    const declarativeOpening=i===span.start&&!span.question&&!/[!]/.test(state.slots[span.end].trailing);
    const freeRelative=has(right,'finiteVerb')&&state.slots.slice(i+2,span.end+1).some((_,k)=>has(a(i+2+k),'finiteVerb'));
    return {profiles,questionOpening,personLike,requiredForm,number,subjectWord,predicate,objectPosition,objectCompound,animate,span,
      coordinatedAnimate,listCoordination,conditionalOpening,parallelWords,closedFamily,possessiveParallel,governorFrame,negativeHave,purchaseLocation,expectedSemantic,nounNumber,rightNumber,standaloneAnd,declarativeOpening,freeRelative,rightObjectPronoun:has(right,'objectPronoun'),afterObjectWord:word(i+2),pluralObject,bareNameModifier,timeModifier,prepositionFamily,directObject,
      visibleWords:state.slots.map((s,j)=>usable(j)?word(j):null),leftWord:word(i-1),rightWord:word(i+1)};
  }
  function contextual(candidate,context) {
    const roles=[...(candidate.analysis?.roles||[])],evidence=[];
    if(roles.includes('questionWord')&&roles.includes('subjectPronoun'))roles.push('questionSubject');
    if(normalize(candidate.word)==="don't")roles.push('negativeImperative');
    const w=normalize(candidate.word),classes=semanticClasses(w,candidate.analysis,candidate.properNoun);
    const analysis=candidate.analysis;
    const frame=verbFrame(analysis,w);
    const objectParticle=frame?.lemma==='look'&&['over','up','through'].includes(context.afterObjectWord);
    const transitive=frame?['DIRECT_TRANSITIVE','OPTIONAL_TRANSITIVE'].includes(frame.family)||objectParticle:analysis?.transitive;
    if(frame?.family==='COPULAR'&&!context.rightObjectPronoun)roles.push('copularPredicate');
    if(analysis?.primaryVerb&&transitive&&has(analysis,'finiteVerb','baseVerb')&&!has(analysis,'auxiliary'))roles.push('ordinaryFiniteTransitive');
    if(has(analysis,'adjective')&&!has(analysis,'determiner','article','pronoun','auxiliary')&&!analysis.primaryNoun)roles.push('ordinaryAdjective');
    if(timeDeterminers.has(w))roles.push('timeDeterminer');
    if(['at','from','in'].includes(w))roles.push('sourceLocation');
    if(w==='to')roles.push('direction');
    if(['in','at','on','by','near'].includes(w))roles.push('staticLocation');
    if(roles.includes('noun')&&!roles.includes('thirdSingular')&&!roles.includes('pastTense'))roles.push('nounHead');
    if(classes.includes('ANIMATE')&&roles.includes('noun'))roles.push('animateNoun');
    if(personModifiers.has(w)&&has(analysis,'adjective'))roles.push('personModifier');
    if(context.governorFrame&&framePrepositions[context.governorFrame.lemma]?.includes(w))roles.push('licensedPreposition');
    if(w==='be')roles.push('copulaBase');if(w==='to')roles.push('infinitiveMarker');
    if(['any','many','some','few','all','both','several','enough','these','those','no'].includes(w))roles.push('pluralQuantifier');
    if(w==='and')roles.push('listAnd');if(['or','nor'].includes(w))roles.push('listOther');
    if(w==='if')roles.push('conditionalIf');if(w==='as')roles.push('conditionalAs');
    let logWeight=0,strongestFit=0,mismatch=false,hardConflict=false;
    for(const p of context.profiles) {
      const fit=Math.max(0,...roles.map(r=>p.roles[r]||0));
      if(!roles.length||(!candidate.analysis?.known&&!candidate.properNoun)) {
        evidence.push({clue:p.reason,outcome:'INSUFFICIENT_EVIDENCE'});continue;
      }
      const outcome=fit>=3?'STRONG_FIT':fit>=1?'INSUFFICIENT_EVIDENCE':'STRONG_MISMATCH',weight=fit||p.mismatch;
      logWeight+=Math.log(weight)*p.strength;
      if(outcome==='STRONG_FIT')strongestFit=Math.max(strongestFit,p.strength);
      if(outcome==='STRONG_MISMATCH'&&p.strength>=0.75)mismatch=true;
      evidence.push({clue:p.reason,outcome,weight});
    }
    if(context.parallelWords.includes(w)){logWeight+=Math.log(18);strongestFit=1;evidence.push({clue:'parallel clause with matching anchor and nominal continuation',outcome:'STRONG_FIT',weight:18});}
    const penalize=(clue,weight)=>{logWeight+=Math.log(weight);mismatch=true;evidence.push({clue,outcome:'STRONG_MISMATCH',weight});};
    const reject=(clue)=>{penalize(clue,0.001);hardConflict=true;};
    if(context.closedFamily&&!context.closedFamily.includes(w))reject('construction requires closed-class member');
    if(context.directObject&&frame&&!transitive&&!(frame.family==='COPULAR'&&!context.rightObjectPronoun))reject('verb frame does not license this direct object');
    if(context.negativeHave&&has(analysis,'pastTense','pastParticiple','auxiliary')&&!has(analysis,'noun','adjective','determiner','article'))reject('DO + lexical HAVE cannot take a perfect participle');
    const candidateNumber=subjectNumber(analysis,w);
    if(context.nounNumber&&has(analysis,'noun')&&candidateNumber&&candidateNumber!==context.nounNumber)reject('number required by visible determiner or numeral');
    if(context.rightNumber==='singular'&&'few many several both two three four five six seven eight nine ten these those'.split(' ').includes(w))reject('plural quantifier before singular count noun');
    if(context.rightNumber==='plural'&&'a an one each every this that'.split(' ').includes(w))reject('singular determiner before plural noun');
    if(context.purchaseLocation&&candidate.nameFamiliarity&&!classes.includes('PLACE'))penalize('purchase location favors place/entity over personal name',0.025);
    if(context.standaloneAnd&&w==='and')penalize('isolated opening has no preceding coordination',0.08);
    if(context.declarativeOpening&&!context.freeRelative&&['who','what','why','how'].includes(w))penalize('declarative punctuation without visible WH construction',0.08);
    if(context.expectedSemantic.some(c=>classes.includes(c))){logWeight+=Math.log(4);evidence.push({clue:'soft semantic parallelism within sentence',outcome:'STRONG_FIT',weight:4});}
    if(context.requiredForm==='baseVerb'&&has(analysis,'verb')&&!analysis.ordinaryBase)penalize('ordinary DO/modal complement must be base form',0.005);
    if(context.directObject&&has(analysis,'modal','doAuxiliary'))reject('auxiliary missing lexical verb before direct object');
    if(context.predicate&&has(analysis,'verb')&&!analysis.primaryVerb&&!has(analysis,'auxiliary'))penalize('secondary verb reading in ordinary predicate',0.035);
    if(candidate.lexicalClass==='bound-or-marginal-standalone'&&!context.profiles.some(p=>(p.roles.nounHead||p.roles.noun>=7)&&analysis.primaryNoun))penalize('bound or marginal standalone form',0.04);
    const word=normalize(candidate.word),a=candidate.analysis,number=context.number;
    if(number&&!context.requiredForm) {
      let fit=true,applicable=false;
      const form=contractions.get(word)||word;
      if(['am','is','are','was','were','has','have','does','do'].includes(form)) {
        applicable=true;fit=(number==='singular'?['is','was','has','does']:number==='first'?['am','was','have','do']:['are','were','have','do']).includes(form);
      } else if(context.predicate&&!has(a,'auxiliary')&&has(a,'verb')) {
        applicable=true;fit=has(a,'pastTense')||(number==='singular'?has(a,'thirdSingular'):has(a,'baseVerb'));
      }
      if(applicable){const weight=fit?2:0.025;logWeight+=Math.log(weight);strongestFit=Math.max(strongestFit,fit?1:0);mismatch ||= !fit;
        evidence.push({clue:'subject agreement: '+context.subjectWord+' / '+number,outcome:fit?'STRONG_FIT':'STRONG_MISMATCH',weight});}
    }
    return {weight:clamp(Math.exp(logWeight),0.0001,1500),evidence,strongestFit,mismatch,hardConflict};
  }
  function phraseEvidence(word,state,context) {
    const i=state.targetSlotIndex,matches=[];
    if(context.bareNameModifier)return {weight:1,matches}; // lowercase compound attestations do not identify a person's name
    for(const size of [2,3])for(let start=i-size+1;start<=i;start++) {
      if(start<context.span.start||start+size-1>context.span.end)continue;
      const words=[];let valid=true;
      for(let j=start;j<start+size;j++) {
        const w=j===i?normalize(word):context.visibleWords[j];
        if(!w||(j<start+size-1&&/[,;:]/.test(state.slots[j].trailing))){valid=false;break;}
        words.push(w);
      }
      if(valid&&phrases.has(words.join(' ')))matches.push(words.join(' '));
    }
    const strength=20;
    return {weight:matches.length?Math.min(24,strength*matches.length):1,matches};
  }
  function rank({state,candidates,visibleAnalyses,vocabularyCount=candidates.length,constructionOwner=null,ownedTarget=false}) {
    // Token rejection belongs to the exact-token layer. The frozen eligibility
    // schema accepts alphabetic rejection strings only; do not widen its rules.
    const eligibilityState={...state,rejectedWordsBySlot:Object.fromEntries(Object.entries(state.rejectedWordsBySlot).map(([i,words])=>[i,words.filter(w=>/^[a-z]+$/.test(w))]))};
    global.GGGHumanEligibility.validatePublic(eligibilityState);
    const slot=state.slots[state.targetSlotIndex],proper=properContext(state);
    const context=construction(state,visibleAnalyses,constructionOwner==='situation-pilot');
    // The pilot owns these target constructions, including their role scores.
    // Retain shared lexical/name/phrase filtering, not competing role decisions.
    if(ownedTarget) Object.assign(context,{profiles:[],parallelWords:[],closedFamily:null,expectedSemantic:[],
      ...(ownedTarget==='predicate'?{}:{number:null,predicate:false,requiredForm:null})});
    const i=state.targetSlotIndex;
    const titleContext=!context.personLike&&((i>context.span.start&&has(visibleAnalyses[i-1],'article','determiner','possessiveDeterminer'))||
      (i>context.span.start+1&&state.slots[i-1]?.letters[0]?.capital)||
      (i<context.span.end&&state.slots[i+1]?.letters[0]?.capital));
    const allowedCapital=c=>!proper.strong||c.nameFamiliarity||c.lexicalClass==='public-entity'||
      (c.properNoun&&c.lexicalClass!=='ordinary'&&c.lexicalClass!=='dictionary-capitalized');
    const allMatches=retrieve(candidates,slot,state.rejectedWordsBySlot[state.targetSlotIndex]).filter(allowedCapital);
    // New morphology tags annotate readings; they are not alternative lexical
    // roles for the unchanged conservative eligibility mechanism.
    const eligibilityAnalysis=a=>a?{...a,roles:a.roles.filter(r=>!['thirdSingular','pastTense','contraction'].includes(r))}:a;
    const eligibilityVisible=visibleAnalyses.map(eligibilityAnalysis);
    const revealed=slot.letters.filter(l=>l.visible!==null).length,fraction=revealed/slot.letters.length;
    const narrowing=Math.max(0,Math.log2(Math.max(1,vocabularyCount)/Math.max(1,allMatches.length)));
    const strongPattern=fraction>=0.5&&narrowing>=2;
    const suppressed=[],ranked=[],seen=new Set();
    for(const candidate of allMatches) {
      const word=normalize(candidate.word);
      if(seen.has(word))continue;seen.add(word);
      const assessment=candidate.analysis?.roles?.length
        ?global.GGGHumanEligibility.assessEligibility(eligibilityState,tokenLetters(word),{candidate:eligibilityAnalysis(candidate.analysis),visible:eligibilityVisible})
        :{state:'UNRESOLVED',candidateInterpretations:[]};
      if(assessment.state==='ELIGIBLE_CONFLICT'){suppressed.push({word,grammarState:assessment.state});continue;}
      const phrase=phraseEvidence(word,state,context);
      // A bare noun at the start may be a compound prefix rather than a subject
      // ("peanut butter"). Preserve that reading only with attested phrase
      // evidence, never across an object or an established coordinated subject.
      const compound=(context.objectCompound||(context.predicate&&!context.rightWord&&context.visibleWords[context.span.start]===context.leftWord))&&has(candidate.analysis,'noun')&&
        phrase.matches.includes(context.leftWord+' '+word);
      const candidateContext=compound?{...context,number:null,predicate:false,profiles:[{reason:'attested noun compound',roles:{noun:14},strength:1,mismatch:0.05}]}:context;
      const graded=contextual(candidate,candidateContext),grammarWeight=assessment.state==='ELIGIBLE_SUPPORT'?POLICY.supportBoost:1;
      if(compound&&semanticClasses(context.leftWord,visibleAnalyses[state.targetSlotIndex-1]).includes('FOOD')&&semanticClasses(word,candidate.analysis).includes('FOOD')) {
        graded.weight*=3;graded.evidence.push({clue:'compatible food classes in attested compound',outcome:'STRONG_FIT',weight:3});
      }
      // Grammar and a phrase often support the same reading. Avoid counting
      // that fit twice at full strength; neutral noun modifiers need more help.
      if(graded.strongestFit>=0.75)phrase.weight=Math.min(6,phrase.weight);
      if(phrase.matches.length)graded.evidence.push({clue:'general phrase inventory',outcome:'STRONG_FIT',weight:phrase.weight,phrases:phrase.matches});
      const zipf=Number.isFinite(candidate.zipf)?candidate.zipf:3;
      // Common-word frequency cannot masquerade as familiarity with its surname.
      const familiarity=proper.strong&&candidate.nameFamiliarity?candidate.nameFamiliarity:zipf;
      const frequencyWeight=2**((clamp(familiarity,2.5,7)-3)*(strongPattern?0.65:0.9));
      const properWeight=candidate.properNoun&&proper.strong?(context.personLike?5:2):1;
      ranked.push({word:candidate.word,normalized:word,orthographicSurface:candidate.orthographicSurface,
        submissionSurface:candidate.submissionSurface,properNoun:Boolean(candidate.properNoun),
        grammarState:assessment.state,grammarWeight,contextWeight:graded.weight,contextFit:graded.strongestFit,
        contextMismatch:graded.mismatch,hardConflict:graded.hardConflict,evidence:graded.evidence,properWeight,frequencyWeight,zipf,phraseWeight:phrase.weight,lexicalClass:candidate.lexicalClass,
        weight:frequencyWeight*grammarWeight*graded.weight*properWeight*phrase.weight});
    }
    ranked.sort((a,b)=>b.weight-a.weight||a.normalized.localeCompare(b.normalized,'en'));
    ranked.forEach((e,i)=>{e.rank=i+1;});
    const contextStrong=ranked.some(e=>e.contextFit>=0.75&&!e.contextMismatch);
    const phraseStrong=ranked.some(e=>e.phraseWeight>1&&!e.contextMismatch);
    const neighbors=context.visibleWords.slice(Math.max(context.span.start,state.targetSlotIndex-2),state.targetSlotIndex+3).filter(Boolean).length;
    const sentenceSlots=state.slots.slice(context.span.start,context.span.end+1),solvedFraction=sentenceSlots.filter(s=>s.solved).length/sentenceSlots.length;
    const parallelStrong=context.parallelWords.length>0;
    const convergence=clamp(0.45*fraction+0.18*Math.min(1,narrowing/8)+(context.closedFamily?0.32:contextStrong?0.2:0)+(phraseStrong?0.25:0)+(parallelStrong?0.2:0)+
      0.2/Math.sqrt(allMatches.length||1)+0.025*neighbors+(proper.strong&&context.personLike?0.08:0)+
      (contextStrong||phraseStrong||parallelStrong?0.14*solvedFraction:0),0,1);
    const credible=ranked.filter(e=>!e.hardConflict&&(!contextStrong||!e.contextMismatch)&&e.weight>=(ranked[0]?.weight||0)*(0.16+0.4*convergence));
    // Band size follows evidence, with only a ceiling against enormous weak tails.
    // Legal-match counts are preserved before all graded/familiarity restrictions.
    const power=1+2.3*convergence,maxBand=Math.max(2,Math.ceil(26*(1-convergence)));
    const mass=credible.reduce((sum,e)=>sum+e.weight**power,0);
    const band=[];let kept=0;
    for(const e of credible){band.push(e);kept+=e.weight**power;if(band.length>=maxBand||kept>=mass*0.94)break;}
    const finalBand=band.map(e=>({...e,probability:e.weight**power/kept}));
    const counts={allLegitimateMatches:allMatches.length,vocabularyBeforePattern:vocabularyCount,
      commonMatches:allMatches.filter(c=>c.zipf>=4).length,afterGrammar:ranked.length,recommended:credible.length,selectionBand:finalBand.length};
    return {policy:POLICY,proper,ranked,band:finalBand,suppressed,context,counts,pattern:pattern(slot),revealed,fraction,narrowing,strongPattern,convergence,
      convergenceEvidence:{neighbors,contextStrong,phraseStrong,parallelStrong,solvedFraction,fraction,narrowing},selectionPower:power,state};
  }
  function evidenceKey(state) {
    const {start,end}=sentence(state);
    return JSON.stringify([state.targetSlotIndex,state.slots.slice(start,end+1)]);
  }
  function cachedRank(key,build) {
    if(!rankingCache.has(key))boundedSet(rankingCache,key,build());
    return rankingCache.get(key);
  }
  function opportunity(ranking) {
    if(!ranking.band.length)return {score:0,reasons:['no credible public completions']};
    const i=ranking.state.targetSlotIndex,old=attention.get(i),key=evidenceKey(ranking.state);
    const attempts=old?.key===key?old.attempts:0,newLetters=old?Math.max(0,ranking.revealed-old.revealed):0;
    const narrowedSinceAttempt=old?Math.max(0,old.matches-ranking.counts.allLegitimateMatches):0;
    const strongContext=Math.max(...ranking.band.map(e=>e.contextFit));
    const base=1+(ranking.context.closedFamily?9:0)+12*ranking.convergence+9*ranking.fraction+0.8*Math.min(10,ranking.narrowing)+7/Math.sqrt(ranking.counts.allLegitimateMatches+1)+
      5*strongContext+2/Math.sqrt(ranking.counts.recommended+1)*Math.min(1,12/ranking.counts.allLegitimateMatches)+
      (ranking.context.questionOpening?1.5:0)+(ranking.proper.strong&&ranking.context.personLike?1:0)+(newLetters?1.5:0);
    const fatigue=1/(1+attempts*0.65*(1-0.8*ranking.convergence));
    const longUnconstrainedName=ranking.proper.strong&&ranking.state.slots[i].letters.length>=8&&ranking.fraction<0.25&&
      !ranking.convergenceEvidence.phraseStrong&&!ranking.convergenceEvidence.parallelStrong&&ranking.counts.allLegitimateMatches>3;
    const nameCost=longUnconstrainedName?0.22:1;
    return {score:base*fatigue*nameCost+(ranking.convergenceEvidence.phraseStrong?5:0)+(ranking.convergenceEvidence.parallelStrong?4:0),reasons:{revealedLetters:ranking.revealed,visibleFraction:ranking.fraction,
      patternReductionBits:Number(ranking.narrowing.toFixed(2)),allMatches:ranking.counts.allLegitimateMatches,
      recommended:ranking.counts.recommended,contextStrength:strongContext,questionOpening:ranking.context.questionOpening,
      properName:ranking.proper.strong,newLettersSinceAttempt:newLetters,narrowedSinceAttempt,
      convergence:ranking.convergence,longUnconstrainedName,nameCost,unproductiveAttemptsWithoutNewEvidence:attempts,fatigue}};
  }
  function noteAttempt(ranking) {
    const i=ranking.state.targetSlotIndex,key=evidenceKey(ranking.state),old=attention.get(i);
    attention.set(i,{key,attempts:old?.key===key?old.attempts+1:1,revealed:ranking.revealed,matches:ranking.counts.allLegitimateMatches});
  }
  function roll(seed) {return ((Math.imul(seed>>>0,1664525)+1013904223)>>>0)/4294967296;}
  function chooseSlot(opportunities,seed) {
    const sorted=opportunities.filter(e=>e.score>0).slice().sort((a,b)=>b.score-a.score||a.slotIndex-b.slotIndex);
    const contenders=sorted.filter(e=>e.score>=sorted[0].score*0.9).slice(0,3);
    const total=contenders.reduce((sum,e)=>sum+e.score**3,0);
    const value=roll(seed);let cursor=value*total,selected=contenders.at(-1);
    for(const e of contenders){cursor-=e.score**3;if(cursor<0){selected=e;break;}}
    return {selected,sorted,value};
  }
  function choose(ranking,seed,character,turnNumber) {
    const value=roll(seed);let cursor=value,selected=ranking.band.at(-1);
    for(const e of ranking.band){cursor-=e.probability;if(cursor<0){selected=e;break;}}
    if(!selected)return null;
    const summary=e=>({word:e.word,normalized:e.normalized,rank:e.rank,probability:e.probability});
    return {...selected,diagnostic:{engineVersion:POLICY.version,boardId:boardId(ranking.state),policy:POLICY,character,turnNumber,
      candidateRankBeforeRandomSelection:selected.rank,grammarState:selected.grammarState,grammarSuppressedAny:ranking.suppressed.length>0,
      grammarSuppressedCount:ranking.suppressed.length,majorEvidence:selected.evidence,properNounBiasActive:ranking.proper.active,
      properNounRouteRequired:ranking.proper.strong,questionOpeningActive:ranking.context.questionOpening,visiblePattern:ranking.pattern,
      candidateCounts:ranking.counts,topPlausibleCandidates:ranking.band.slice(0,8).map(summary),
      lexicalClass:selected.lexicalClass,convergence:ranking.convergence,convergenceEvidence:ranking.convergenceEvidence,selectionPower:ranking.selectionPower,
      finalCandidateSelectionBand:ranking.band.map(summary),
      publicBoard:ranking.state.slots.map(s=>({pattern:pattern(s),capitals:s.letters.map(l=>l.capital),gaps:s.gaps,solved:s.solved})),
      rejectedWordsForSlot:ranking.state.rejectedWordsBySlot[ranking.state.targetSlotIndex]||[],
      random:{algorithm:'lcg32-one-step',seed:seed>>>0,value}}};
  }
  function reset(){attention.clear();rankingCache.clear();}
  // Future discourse/image evidence has an explicit public adapter boundary.
  // No discourse provider, image provider, or personality policy is connected.
  global.GGGHumanPlaytest=Object.freeze({POLICY,frameGroups,framePrepositions,subjectNumber,semanticClasses,loadResources,nameFamiliarity,nameSourceMembership,extraWords,lexicalClass,tokenLetters,tokenAt,matchesToken,matchesCasePattern,surfaceForSlot,enrichAnalysis,properContext,construction,contextual,timeDeterminer:word=>timeDeterminers.has(normalize(word)),rank,choose,opportunity,noteAttempt,
    chooseSlot,cachedVocabulary,retrieve,cachedRank,boardKey,boardId,evidenceKey,reset});
})(globalThis);
