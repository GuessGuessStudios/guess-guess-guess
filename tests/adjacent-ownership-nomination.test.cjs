const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { fixture } = require('./human-playtest-fixture.cjs');
const { root } = require('./ai-harness.cjs');
const plain = value => JSON.parse(JSON.stringify(value));

(async () => {
  const { h, e, board, turns } = await fixture();
  const source = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
  vm.runInContext(source.slice(source.indexOf('  const ENTITY_TYPE_ORDER'), source.indexOf('  function candidateEntityTypes')), h);
  vm.runInContext(fs.readFileSync(path.join(root, 'public-board.js'), 'utf8'), h);
  h.location.search = '?humanPlaytestMode=1&ettinPilot=1';
  vm.runInContext(fs.readFileSync(path.join(root, 'proper-noun-bank.js'), 'utf8'), h);
  await h.GGGProperNounBank.ready();
  const provider = fs.readFileSync(path.join(root, 'assets/ettin/ettin-provider.js'), 'utf8');
  vm.runInContext(provider.slice(provider.indexOf('function alphaCount('), provider.indexOf('function renderBoard(')), h);
  h.GGGEttinProvider = { validateCandidate: h.validateCandidate };
  turns(); h.performance = { now: () => 0 };
  const events = [];
  h.logEttinPilot = (type, target, detail) => events.push({ type, ...detail });
  let passed = 0, failed = 0;
  async function check(name, run) {
    try { await run(); passed++; console.log('PASS', name); }
    catch (error) { failed++; console.error('FAIL', name, error.stack || error.message); }
  }
  const hidden = (length, first = '_', capital = false) => ({ pattern: `${first}${'_'.repeat(length - 1)}${'.'}`, capital });
  const pairs = [
    ['teacher', ['The', 'teacher', 'owns', 'the', 'dog.', 'The', 'dog', 'belongs', 'to', 'the', hidden(7)], 10],
    ['doctor', ['The', 'doctor', 'owns', 'the', 'cat.', 'The', 'cat', 'belongs', 'to', 'the', hidden(6)], 10],
    ['nurse', ['The', 'nurse', 'owns', 'the', 'rabbit.', 'The', 'rabbit', 'belongs', 'to', 'the', hidden(5)], 10],
    ['boy', ['The', 'boy', 'owns', 'the', 'horse.', 'The', 'horse', 'belongs', 'to', 'the', hidden(3)], 10],
    ['girl', ['The', 'girl', 'owns', 'the', 'goat.', 'The', 'goat', 'belongs', 'to', 'the', hidden(4)], 10],
    ['student', ['The', 'student', 'owns', 'the', 'bird.', 'The', 'bird', 'belongs', 'to', 'the', hidden(7)], 10],
  ];
  function input(tokens, targetIndex) {
    const targetSlot = board(tokens).find(slot => slot.slotIndex === targetIndex) ||
      { slotIndex: targetIndex, group: h.groups[targetIndex], length: h.groups[targetIndex]?.querySelectorAll().length };
    assert(targetSlot?.group, 'target fixture must remain unresolved');
    const state = h.getHumanPlaytestPublicState(targetSlot);
    return { state, targetSlot, snapshot: h.buildEttinPublicSnapshot(state),
      boardKey: e.boardKey(state), opportunity: null, ordinaryCap: 112, ordinary: [] };
  }
  const recognize = value => h.recognizeAdjacentOwnershipNomination(value.state);
  for (const [owner, tokens, index] of pairs) await check(`positive ${owner} with real lexical metadata`, () => {
    const x = input(tokens, index), evidence = recognize(x);
    assert.equal(evidence.mechanismVersion, 'adjacent-ownership-nomination-v1');
    assert.equal(evidence.reason, 'role-aligned');
    assert.equal(evidence.nominee, owner);
    assert.equal(evidence.sourceOwner, owner);
    assert.equal(evidence.repeatedAnimal, tokens[4].replace('.', ''));
    assert.equal(evidence.targetRole, 'owner-complement');
    for (const word of [owner, evidence.repeatedAnimal]) {
      const analysis = h.getHumanPlaytestAnalysis(word), semantic = e.semanticClasses(word, analysis, false);
      assert.equal(analysis.primaryNoun, true, `${word} primary noun`);
      assert.equal(analysis.pluralNoun, false, `${word} singular lexical form`);
      assert.equal(e.subjectNumber(analysis, word), 'singular', `${word} number`);
      assert(analysis.roles.includes('noun'));
      assert(semantic.includes(word === owner ? 'PERSON' : 'ANIMAL'));
    }
  });
  await check('compatible partial target letters still nominate exact owner', () => {
    const x = input(['The', 'teacher', 'owns', 'the', 'dog.', 'The', 'dog', 'belongs', 'to', 'the', hidden(7, 't')], 10);
    assert.equal(recognize(x).nominee, 'teacher');
  });
  await check('pair inside longer puzzle uses only immediate preceding sentence', () => {
    const x = input(['Birds', 'sing.', ...pairs[0][1]], 12);
    const evidence = recognize(x);
    assert.equal(evidence.reason, 'role-aligned');
    assert.equal(evidence.nominee, 'teacher');
    assert.equal(evidence.sourceSpan.start, 2);
    assert.equal(evidence.targetSpan.start, 7);
  });

  const unsupported = [
    ['has', ['The','teacher','has','the','dog.','The','dog','belongs','to','the',hidden(7)], 10],
    ['likes', ['The','teacher','likes','the','dog.','The','dog','belongs','to','the',hidden(7)], 10],
    ['owned past', ['The','teacher','owned','the','dog.','The','dog','belongs','to','the',hidden(7)], 10],
    ['negation', ['The','teacher','does','not','own','the','dog.','The','dog','belongs','to','the',hidden(7)], 12],
    ['modal', ['The','teacher','may','own','the','dog.','The','dog','belongs','to','the',hidden(7)], 11],
    ['passive', ['The','dog','is','owned','by','the','teacher.','The','dog','belongs','to','the',hidden(7)], 12],
    ['different animal', ['The','teacher','owns','the','dog.','The','cat','belongs','to','the',hidden(7)], 10],
    ['pronoun target subject', ['The','teacher','owns','the','dog.','It','belongs','to','the',hidden(7)], 9],
    ['pronoun source owner', ['She','owns','the','dog.','The','dog','belongs','to','the',hidden(7)], 9],
    ['proper name source owner', ['Maria','owns','the','dog.','The','dog','belongs','to','the',hidden(5)], 9],
    ['indefinite object', ['The','teacher','owns','a','dog.','The','dog','belongs','to','the',hidden(7)], 10],
    ['plural animal', ['The','teacher','owns','the','dogs.','The','dogs','belong','to','the',hidden(7)], 10],
    ['multiple objects', ['The','teacher','owns','the','dog','and','the','cat.','The','dog','belongs','to','the',hidden(7)], 13],
    ['multiple owners', ['The','teacher','and','doctor','own','the','dog.','The','dog','belongs','to','the',hidden(7)], 12],
    ['modified animal', ['The','teacher','owns','the','small','dog.','The','dog','belongs','to','the',hidden(7)], 11],
    ['extra attachment', ['The','teacher','owns','the','dog','in','town.','The','dog','belongs','to','the',hidden(7)], 12],
    ['nonadjacent', ['The','teacher','owns','the','dog.','Birds','sing.','The','dog','belongs','to','the',hidden(7)], 12],
    ['exclamation boundary', ['The','teacher','owns','the','dog!','The','dog','belongs','to','the',hidden(7)], 10],
    ['wrong internal punctuation', ['The','teacher,','owns','the','dog.','The','dog','belongs','to','the',hidden(7)], 10],
    ['target past tense', ['The','teacher','owns','the','dog.','The','dog','belonged','to','the',hidden(7)], 10],
    ['wrong relation', ['The','teacher','owns','the','dog.','The','dog','belongs','with','the',hidden(7)], 10],
    ['non-animal object', ['The','teacher','owns','the','car.','The','car','belongs','to','the',hidden(7)], 10],
    ['non-person owner', ['The','school','owns','the','dog.','The','dog','belongs','to','the',hidden(6)], 10],
    ['hidden owner', ['The',{pattern:'t____er',capital:false},'owns','the','dog.','The','dog','belongs','to','the',hidden(7)], 10],
    ['hidden source animal', ['The','teacher','owns',{pattern:'___',capital:false},'dog.','The','dog','belongs','to','the',hidden(7)], 10],
    ['conflicting target letters', ['The','teacher','owns','the','dog.','The','dog','belongs','to','the',hidden(7,'s')], 10],
    ['wrong target length', ['The','teacher','owns','the','dog.','The','dog','belongs','to','the',hidden(6)], 10],
    ['solved target', ['The','teacher','owns','the','dog.','The','dog','belongs','to','the','teacher.'], 10],
    ['hidden predicate', ['The','teacher',{pattern:'o___',capital:false},'the','dog.','The','dog','belongs','to','the',hidden(7)], 10],
    ['hidden target predicate', ['The','teacher','owns','the','dog.','The','dog',{pattern:'b______',capital:false},'to','the',hidden(7)], 10],
    ['hidden target preposition', ['The','teacher','owns','the','dog.','The','dog','belongs',{pattern:'__',capital:false},'the',hidden(7)], 10],
    ['hidden target determiner', ['The','teacher','owns','the','dog.','The','dog','belongs','to',{pattern:'___',capital:false},hidden(7)], 10],
    ['wrong target role', ['The','teacher','owns','the','dog.','The','dog',{pattern:'b______',capital:false},'to','the','teacher.'], 7],
    ['capitalized owner', ['The','Teacher','owns','the','dog.','The','dog','belongs','to','the',hidden(7)], 10],
    ['capitalized predicate', ['The','teacher','Owns','the','dog.','The','dog','belongs','to','the',hidden(7)], 10],
  ];
  for (const [name, tokens, index] of unsupported) await check(`abstains: ${name}`, () => {
    const evidence = recognize(input(tokens, index));
    assert.notEqual(evidence.reason, 'role-aligned', `${name} reason`);
    assert.equal(evidence.nominee, undefined, `${name} nominee`);
  });
  await check('fixed predicates do not depend on generic primaryVerb classification', () => {
    const original = h.getHumanPlaytestAnalysis;
    h.getHumanPlaytestAnalysis = word => /^(owns|belongs)$/.test(String(word).toLowerCase())
      ? { ...original(word), primaryVerb: false } : original(word);
    try { assert.equal(recognize(input(pairs[0][1], 10)).nominee, 'teacher'); }
    finally { h.getHumanPlaytestAnalysis = original; }
  });

  async function prepared(tokens = pairs[0][1], index = 10) {
    const x = input(tokens, index);
    x.lexicalPool = await h.buildHumanPlaytestPool(x.targetSlot, [], x.state, true);
    const record = x.lexicalPool.contextualAccess.classData.enriched.find(c => c.normalized === 'teacher');
    assert(record, 'teacher has a prepared enriched candidate record');
    assert(x.lexicalPool.hardCandidates.some(c => c.normalized === 'teacher'), 'teacher is hard authorized');
    x.ordinary = x.lexicalPool.candidates.filter(c => c.normalized !== 'teacher').slice(0, 8);
    return { x, record };
  }
  function admit(x, evidence = h.recognizeAdjacentOwnershipNomination(x.state)) {
    return h.admitCrossSentenceNomination({ ...x, evidence, mechanismVersion: 'adjacent-ownership-nomination-v1' });
  }
  await check('authorized absent nominee appends one prepared record unchanged', async () => {
    const { x, record } = await prepared(), before = plain(x.ordinary);
    const result = admit(x);
    assert.equal(result.diagnostic.reason, 'admitted');
    assert.equal(result.diagnostic.mechanismVersion, 'adjacent-ownership-nomination-v1');
    assert.equal(result.diagnostic.evidenceAdditionCount, 1);
    assert.equal(result.diagnostic.finalCandidateCount, before.length + 1);
    assert.deepEqual(plain(result.candidates.slice(0, -1)), before);
    for (const key of Object.keys(record)) assert.deepEqual(plain(result.candidates.at(-1)[key]), plain(record[key]), key);
    assert(!Object.keys(result.candidates.at(-1)).some(key => /ownership|repeatedAnimal|sourceOwner/.test(key)));
  });
  await check('already present preserves position and metadata and consumes no capacity', async () => {
    const { x, record } = await prepared();
    x.ordinary.splice(2, 0, { ...record, marker: 'preserve' }); x.evidenceBudget = 0;
    const before = plain(x.ordinary), result = admit(x);
    assert.equal(result.diagnostic.reason, 'already-present');
    assert.equal(result.diagnostic.evidenceAdditionCount, 0);
    assert.deepEqual(plain(result.candidates), before);
    assert.equal(result.candidates[2].marker, 'preserve');
  });
  const admissionFailures = [
    ['authorization', x => { x.lexicalPool.hardCandidates = []; x.lexicalPool.universe = []; }, 'no-authorized-candidate-record'],
    ['prepared exclusion', x => { x.lexicalPool.contextualAccess.classData.enriched = []; }, 'existing-preparation-excluded'],
    ['public rejection', x => { x.state.rejectedWordsBySlot[10] = ['teacher']; }, 'public-rejection'],
    ['disabled allowance', x => { x.evidenceBudget = 0; }, 'evidence-capacity-blocked'],
    ['exhausted allowance', x => { x.evidenceUsed = 1; }, 'evidence-capacity-blocked'],
    ['stale board', x => { x.boardKey = 'stale'; }, 'stale-board'],
    ['stale opportunity', x => { x.opportunity = vm.runInContext(
      `({ ticket: HUMAN_PLAYTEST_TURN.generation - 1, gameId: ETTIN_ATTENTION.gameId, boardKey: ${JSON.stringify(x.boardKey)} })`, h); }, 'stale-opportunity'],
  ];
  for (const [name, mutate, reason] of admissionFailures) await check(`shared admission rejects ${name}`, async () => {
    const { x } = await prepared(), evidence = h.recognizeAdjacentOwnershipNomination(x.state);
    mutate(x); if (name !== 'stale board') x.boardKey = e.boardKey(x.state);
    x.snapshot = h.buildEttinPublicSnapshot(x.state);
    const before = plain(x.ordinary), result = admit(x, evidence);
    assert.equal(result.diagnostic.reason, reason);
    assert.equal(result.diagnostic.evidenceAdditionCount, 0);
    assert.deepEqual(plain(result.candidates), before);
  });
  await check('same nominee from another provider has combined provenance and one admission', async () => {
    const { x } = await prepared(), evidence = h.recognizeAdjacentOwnershipNomination(x.state);
    const saved = [h.recognizeAdjacentQaNomination, h.recognizeAdjacentDeclarativeNomination,
      h.recognizeAdjacentItSubjectNomination, h.recognizeAdjacentOwnershipNomination,
      h.buildHumanPlaytestPool, h.buildEttinPersonAccessExtension,
      h.buildEttinContextualAccessExtension, h.buildEntityTypeAccessExtension];
    try {
      h.recognizeAdjacentQaNomination = () => ({ ...evidence, mechanismVersion: 'adjacent-qa-nomination-v1' });
      h.recognizeAdjacentDeclarativeNomination = () => ({ mechanismVersion: 'adjacent-declarative-nomination-v1', reason: 'none' });
      h.recognizeAdjacentItSubjectNomination = () => ({ mechanismVersion: 'adjacent-it-subject-nomination-v1', reason: 'none' });
      h.recognizeAdjacentOwnershipNomination = () => evidence;
      h.buildHumanPlaytestPool = async () => ({ ...x.lexicalPool, candidates: x.ordinary });
      h.buildEttinPersonAccessExtension = () => [];
      h.buildEttinContextualAccessExtension = () => ({ candidates: [] });
      h.buildEntityTypeAccessExtension = () => ({ candidates: [], matchedTypes: new Map() });
      h.GGGEttinProvider.scoreCandidates = async (_, candidates) => ({ candidates: candidates.map((candidate, i) =>
        ({ ...candidate, rank: candidates.length - i, score: -i, probability: 1 / candidates.length })) });
      const result = await h.buildEttinPilotPool(x.targetSlot);
      assert.equal(result.status, 'ready');
      const diagnostic = result.pool.crossSentenceNomination;
      assert.equal(diagnostic.reason, 'admitted');
      assert.equal(diagnostic.evidenceAdditionCount, 1);
      assert.deepEqual(Array.from(diagnostic.contributingProviders), ['adjacent-qa-nomination-v1', 'adjacent-ownership-nomination-v1']);
      assert.equal(result.pool.candidates.filter(candidate => candidate.normalized === 'teacher').length, 1);
      assert.equal(result.pool.candidates.find(candidate => candidate.normalized === 'teacher').rank, 1);
      assert(events.some(event => event.type === 'ettin-adjacent-ownership-recognition' && event.reason === 'role-aligned'));
      assert(events.some(event => event.type === 'ettin-cross-sentence-nomination' && event.mechanismVersion === 'adjacent-qa-nomination-v1'));
    } finally {
      [h.recognizeAdjacentQaNomination, h.recognizeAdjacentDeclarativeNomination,
        h.recognizeAdjacentItSubjectNomination, h.recognizeAdjacentOwnershipNomination,
        h.buildHumanPlaytestPool, h.buildEttinPersonAccessExtension,
        h.buildEttinContextualAccessExtension, h.buildEntityTypeAccessExtension] = saved;
    }
  });
  await check('conflicting nominee from another provider adds nothing', async () => {
    const { x } = await prepared(), evidence = h.recognizeAdjacentOwnershipNomination(x.state);
    const saved = [h.recognizeAdjacentQaNomination, h.recognizeAdjacentDeclarativeNomination,
      h.recognizeAdjacentItSubjectNomination, h.recognizeAdjacentOwnershipNomination,
      h.buildHumanPlaytestPool, h.buildEttinPersonAccessExtension,
      h.buildEttinContextualAccessExtension, h.buildEntityTypeAccessExtension];
    try {
      h.recognizeAdjacentQaNomination = () => ({ ...evidence, nominee: 'student', mechanismVersion: 'adjacent-qa-nomination-v1' });
      h.recognizeAdjacentDeclarativeNomination = () => ({ reason: 'none' });
      h.recognizeAdjacentItSubjectNomination = () => ({ reason: 'none' });
      h.recognizeAdjacentOwnershipNomination = () => evidence;
      h.buildHumanPlaytestPool = async () => ({ ...x.lexicalPool, candidates: x.ordinary });
      h.buildEttinPersonAccessExtension = () => [];
      h.buildEttinContextualAccessExtension = () => ({ candidates: [] });
      h.buildEntityTypeAccessExtension = () => ({ candidates: [], matchedTypes: new Map() });
      h.GGGEttinProvider.scoreCandidates = async (_, candidates) => ({ candidates: candidates.map((candidate, i) =>
        ({ ...candidate, rank: i + 1, score: -i, probability: 1 / candidates.length })) });
      const result = await h.buildEttinPilotPool(x.targetSlot);
      assert.equal(result.pool.crossSentenceNomination.reason, 'conflicting-provider-nominations');
      assert.equal(result.pool.crossSentenceNomination.evidenceAdditionCount, 0);
      assert(!result.pool.candidates.some(candidate => ['teacher', 'student'].includes(candidate.normalized)));
    } finally {
      [h.recognizeAdjacentQaNomination, h.recognizeAdjacentDeclarativeNomination,
        h.recognizeAdjacentItSubjectNomination, h.recognizeAdjacentOwnershipNomination,
        h.buildHumanPlaytestPool, h.buildEttinPersonAccessExtension,
        h.buildEttinContextualAccessExtension, h.buildEntityTypeAccessExtension] = saved;
    }
  });
  await check('ETTIN receives nominee with prepared metadata and authoritative last rank', async () => {
    const { x, record } = await prepared();
    const saved = [h.buildHumanPlaytestPool, h.buildEttinPersonAccessExtension,
      h.buildEttinContextualAccessExtension, h.buildEntityTypeAccessExtension];
    let scored;
    try {
      h.buildHumanPlaytestPool = async () => ({ ...x.lexicalPool, candidates: x.ordinary });
      h.buildEttinPersonAccessExtension = () => [];
      h.buildEttinContextualAccessExtension = () => ({ candidates: [] });
      h.buildEntityTypeAccessExtension = () => ({ candidates: [], matchedTypes: new Map() });
      h.GGGEttinProvider.scoreCandidates = async (_, candidates) => {
        scored = plain(candidates);
        return { candidates: candidates.map((candidate, i) => ({ ...candidate,
          rank: candidates.length - i, score: -i, probability: 1 / candidates.length })) };
      };
      const result = await h.buildEttinPilotPool(x.targetSlot);
      assert.equal(result.status, 'ready');
      assert.equal(result.pool.adjacentOwnershipNomination.mechanismVersion, 'adjacent-ownership-nomination-v1');
      assert.equal(result.pool.adjacentOwnershipNomination.sourceOwner, 'teacher');
      assert(events.some(event => event.type === 'ettin-adjacent-ownership-nomination' && event.reason === 'admitted'));
      assert.equal(scored.at(-1).word, 'teacher');
      for (const key of Object.keys(record)) assert.deepEqual(scored.at(-1)[key], plain(record[key]), key);
      assert.equal(result.pool.candidates.find(candidate => candidate.normalized === 'teacher').rank, 1);
      assert(!Object.keys(scored.at(-1)).some(key => /ownership|repeatedAnimal|sourceOwner/.test(key)));
      assert.equal(result.pool.ordinaryCandidateCap, 112);
      assert.equal(result.pool.candidateCap, 113);
    } finally {
      [h.buildHumanPlaytestPool, h.buildEttinPersonAccessExtension,
        h.buildEttinContextualAccessExtension, h.buildEntityTypeAccessExtension] = saved;
    }
  });
  await check('diagnostic provenance does not alter Stage 3 distribution or selection', async () => {
    vm.runInContext(source.slice(source.indexOf("  const ETTIN_CONTEXT_PRIOR_VERSION"),
      source.indexOf('  function evaluateEntitySlotCompatibility')), h);
    const { x } = await prepared();
    const candidates = x.lexicalPool.candidates.filter(candidate => candidate.normalized !== 'teacher').slice(0, 5);
    candidates.push(x.lexicalPool.contextualAccess.classData.enriched.find(candidate => candidate.normalized === 'teacher'));
    const scoredCandidates = candidates.map((candidate, i) => ({ ...candidate,
      word: candidate.submissionSurface, rank: i + 1, score: -i, probability: 1 / candidates.length }));
    const publicBoard = h.GGGPublicBoard.snapshot(x.state);
    const pool = { predictionMode: 'ettin-pilot', candidates: scoredCandidates,
      targetSlot: x.targetSlot, targetLength: x.targetSlot.length, publicBoardKey: x.boardKey,
      snapshot: x.snapshot, attentionPlan: { boardKey: x.boardKey,
        considered: [{ slotIndex: x.targetSlot.slotIndex, band: 'WEAK' }],
        publicBoard: { slots: publicBoard.slots.map(slot => ({ ...slot, sentence: slot.sentenceIndex })) } } };
    const one = h.buildEttinStage3Distribution({ ...pool, adjacentOwnershipNomination: { reason: 'admitted' } });
    const two = h.buildEttinStage3Distribution({ ...pool, adjacentOwnershipNomination: { reason: 'unsupported-owner' } });
    assert.equal(one.ok, true, one.reason);
    assert.deepEqual(plain(one), plain(two));
    const firstChoice = h.chooseEttinStage3Candidate({ ...pool, stage3Distribution: one }, () => 0.5);
    const secondChoice = h.chooseEttinStage3Candidate({ ...pool, stage3Distribution: two }, () => 0.5);
    assert.equal(firstChoice.candidate.word, secondChoice.candidate.word);
  });
  await check('ownership abstention diagnostic is emitted and labelled', async () => {
    const tokens = ['The','teacher','owns','the','dog.','The','cat','belongs','to','the',hidden(7)];
    const { x } = await prepared(tokens, 10);
    const saved = [h.buildHumanPlaytestPool, h.buildEttinPersonAccessExtension,
      h.buildEttinContextualAccessExtension, h.buildEntityTypeAccessExtension];
    try {
      h.buildHumanPlaytestPool = async () => ({ ...x.lexicalPool, candidates: x.ordinary });
      h.buildEttinPersonAccessExtension = () => [];
      h.buildEttinContextualAccessExtension = () => ({ candidates: [] });
      h.buildEntityTypeAccessExtension = () => ({ candidates: [], matchedTypes: new Map() });
      h.GGGEttinProvider.scoreCandidates = async (_, candidates) => ({ candidates: candidates.map((candidate, i) =>
        ({ ...candidate, rank: i + 1, score: -i, probability: 1 / candidates.length })) });
      await h.buildEttinPilotPool(x.targetSlot);
      assert(events.some(event => event.type === 'ettin-adjacent-ownership-recognition' &&
        event.mechanismVersion === 'adjacent-ownership-nomination-v1' && event.reason === 'owned-animal-mismatch' &&
        event.nominee === undefined));
    } finally {
      [h.buildHumanPlaytestPool, h.buildEttinPersonAccessExtension,
        h.buildEttinContextualAccessExtension, h.buildEntityTypeAccessExtension] = saved;
    }
  });
  await check('hidden target backing answer cannot affect recognition', () => {
    const x = input(pairs[0][1], 10); let reads = 0;
    const observe = answer => {
      h.groups[10].querySelectorAll().forEach((block, index) => {
        const data = { revealed: 'false', trailing: index === 6 ? '.' : '' };
        Object.defineProperty(data, 'letter', { get() { reads++; return answer[index]; } });
        block.dataset = data;
      });
      const state = h.getHumanPlaytestPublicState(x.targetSlot);
      return { state, evidence: h.recognizeAdjacentOwnershipNomination(state) };
    };
    const a = observe('teacher'), b = observe('student');
    assert.deepEqual(plain(a.state), plain(b.state));
    assert.deepEqual(plain(a.evidence), plain(b.evidence));
    assert.equal(a.evidence.nominee, 'teacher');
    assert.equal(reads, 0);
  });
  await check('Mechanisms #1, #2, and #3 still recognize their existing shapes', () => {
    const qa = input(['Who','helps',{pattern:'_____?',capital:true},'Alice','and','Bruno','help','Clara.'], 2);
    const declarative = input(['Maria','buys','bread.','Maria','buys',hidden(5)], 5);
    const it = input(['A','dog','watches','cats.','It','watches',hidden(4)], 6);
    assert.equal(h.recognizeAdjacentQaNomination(qa.state).reason, 'role-aligned');
    assert.equal(h.recognizeAdjacentDeclarativeNomination(declarative.state).reason, 'role-aligned');
    assert.equal(h.recognizeAdjacentItSubjectNomination(it.state).reason, 'role-aligned');
  });

  console.log(`${passed} passed; ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });
