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
  turns();
  h.performance = { now: () => 0 };
  const events = [];
  h.logEttinPilot = (type, target, detail) => events.push({ type, ...detail });
  let passed = 0, failed = 0;
  async function check(name, run) {
    try { await run(); passed++; console.log('PASS', name); }
    catch (error) { failed++; console.error('FAIL', name, error.stack || error.message); }
  }
  const targetPattern = (pattern = '____', capital = false) => ({
    pattern: /[.!?]$/.test(pattern) ? pattern : `${pattern}.`, capital,
  });
  function setup(tokens, targetIndex, targetSolved = false) {
    const slots = board(tokens);
    const targetSlot = slots.find(slot => slot.slotIndex === targetIndex) ||
      { slotIndex: targetIndex, group: h.groups[targetIndex], length: h.groups[targetIndex]?.querySelectorAll().length };
    assert(targetSlot.group, 'fixture target slot is unavailable');
    if (targetSolved) h.groups[targetIndex].classList.add('revealed');
    const state = h.getHumanPlaytestPublicState(targetSlot);
    return { state, targetSlot, snapshot: h.buildEttinPublicSnapshot(state),
      boardKey: e.boardKey(state), opportunity: null, ordinaryCap: 112, ordinary: [] };
  }
  const recognize = input => h.recognizeAdjacentItSubjectNomination(input.state);
  const positives = [
    ['A dog watches cats', ['A', 'dog', 'watches', 'cats.', 'It', 'watches', targetPattern()], 'cats', 'watch'],
    ['A cat watches birds', ['A', 'cat', 'watches', 'birds.', 'It', 'watches', targetPattern('_____')], 'birds', 'watch'],
    ['A fox eats hens', ['A', 'fox', 'eats', 'hens.', 'It', 'eats', targetPattern()], 'hens', 'eat'],
    ['A tiger watches goats', ['A', 'tiger', 'watches', 'goats.', 'It', 'watches', targetPattern('_____')], 'goats', 'watch'],
    ['A horse likes dogs', ['A', 'horse', 'likes', 'dogs.', 'It', 'likes', targetPattern()], 'dogs', 'like'],
    ['An owl watches rats', ['An', 'owl', 'watches', 'rats.', 'It', 'watches', targetPattern()], 'rats', 'watch'],
  ];
  for (const [name, tokens, nominee, lemma] of positives) await check(name, () => {
    const input = setup(tokens, 6), evidence = recognize(input);
    assert.equal(evidence.reason, 'role-aligned');
    assert.equal(evidence.mechanismVersion, 'adjacent-it-subject-nomination-v1');
    assert.equal(evidence.antecedent, tokens[1]);
    assert.equal(evidence.reference, 'It');
    assert.deepEqual(plain(evidence.binding), { sourceRole: 'subject', targetRole: 'subject' });
    assert.equal(evidence.predicateLemma, lemma);
    assert.equal(evidence.sourceRole, 'direct-object');
    assert.equal(evidence.targetRole, 'direct-object');
    assert.equal(evidence.nominee, nominee);
    assert.equal(evidence.sourceObjectSlot, 3);
    assert.equal(evidence.targetObjectSlot, 6);
    assert.equal(evidence.sourceSpan.start, 0);
    assert.equal(evidence.targetSpan.start, 4);
  });
  await check('partial target letters and later unrelated sentences are allowed', () => {
    const input = setup(['A', 'dog', 'watches', 'cats.', 'It', 'watches', targetPattern('c___'),
      'Birds', 'sing.'], 6);
    assert.equal(recognize(input).nominee, 'cats');
  });
  await check('public lexical number and animal readings are present for approved examples', () => {
    for (const [word, number] of [['dog', 'singular'], ['cat', 'singular'], ['fox', 'singular'],
      ['tiger', 'singular'], ['horse', 'singular'], ['owl', 'singular'], ['cats', 'plural'],
      ['birds', 'plural'], ['hens', 'plural'], ['goats', 'plural'], ['dogs', 'plural'], ['rats', 'plural']]) {
      const analysis = h.getHumanPlaytestAnalysis(word);
      assert.equal(e.subjectNumber(analysis, word), number, `${word} number`);
      assert(analysis.primaryNoun, `${word} has primary noun reading`);
      assert(e.semanticClasses(word, analysis, false).includes('ANIMAL'), `${word} is public ANIMAL class`);
    }
  });
  const negatives = [
    ['singular source object', ['A', 'dog', 'watches', 'a', 'cat.', 'It', 'watches', targetPattern()], 7],
    ['fish number unresolved', ['A', 'dog', 'watches', 'fish.', 'It', 'watches', targetPattern()], 6],
    ['sheep invariant number', ['A', 'dog', 'watches', 'sheep.', 'It', 'watches', targetPattern('_____')], 6],
    ['hidden antecedent', ['A', targetPattern('d_g', true), 'watches', 'cats.', 'It', 'watches', targetPattern()], 6],
    ['partial antecedent', ['A', targetPattern('d_g', false), 'watches', 'cats.', 'It', 'watches', targetPattern()], 6],
    ['hidden source predicate', ['A', 'dog', targetPattern('w______', false), 'cats.', 'It', 'watches', targetPattern()], 6],
    ['unresolved source object', ['A', 'dog', 'watches', targetPattern('____.'), 'It', 'watches', targetPattern()], 6],
    ['partial reference', ['A', 'dog', 'watches', 'cats.', targetPattern('I_', true), 'watches', targetPattern()], 6],
    ['hidden target predicate', ['A', 'dog', 'watches', 'cats.', 'It', targetPattern('w______'), targetPattern()], 6],
    ['plural source subject', ['Dogs', 'watch', 'cats.', 'It', 'watches', targetPattern()], 5],
    ['they unsupported', ['A', 'dog', 'watches', 'cats.', 'They', 'watch', targetPattern()], 6],
    ['she unsupported', ['A', 'dog', 'watches', 'cats.', 'She', 'watches', targetPattern()], 6],
    ['first person unsupported', ['A', 'dog', 'watches', 'cats.', 'I', 'watch', targetPattern()], 6],
    ['possessive structure', ['A', 'dog', 'watches', 'cats.', 'Its', 'owner', 'watches', targetPattern()], 7],
    ['demonstrative unsupported', ['A', 'dog', 'watches', 'cats.', 'That', 'watches', targetPattern()], 6],
    ['coordinated antecedents', ['A', 'dog', 'and', 'a', 'fox', 'watch', 'cats.', 'It', 'watches', targetPattern()], 8],
    ['relative clause', ['A', 'dog', 'that', 'sleeps', 'watches', 'cats.', 'It', 'watches', targetPattern()], 8],
    ['PP and extra entity', ['A', 'dog', 'watches', 'cats', 'near', 'birds.', 'It', 'watches', targetPattern()], 8],
    ['past source predicate', ['A', 'dog', 'watched', 'cats.', 'It', 'watches', targetPattern()], 6],
    ['progressive source', ['A', 'dog', 'is', 'watching', 'cats.', 'It', 'watches', targetPattern()], 7],
    ['perfect source', ['A', 'dog', 'has', 'watched', 'cats.', 'It', 'watches', targetPattern()], 7],
    ['passive source', ['Cats', 'are', 'watched', 'by', 'a', 'dog.', 'It', 'watches', targetPattern()], 8],
    ['negation', ['A', 'dog', 'does', 'not', 'watch', 'cats.', 'It', 'watches', targetPattern()], 8],
    ['modal', ['A', 'dog', 'can', 'watch', 'cats.', 'It', 'watches', targetPattern()], 7],
    ['different predicate lemma', ['A', 'dog', 'watches', 'cats.', 'It', 'likes', targetPattern()], 6],
    ['agreement failure', ['A', 'dog', 'watches', 'cats.', 'It', 'watch', targetPattern()], 6],
    ['unsupported punctuation', ['A', 'dog', 'watches', 'cats!', 'It', 'watches', targetPattern()], 6],
    ['nonadjacent sentences', ['A', 'dog', 'watches', 'cats.', 'Birds', 'sing.', 'It', 'watches', targetPattern()], 8],
    ['not opening pair', ['Birds', 'sing.', 'A', 'dog', 'watches', 'cats.', 'It', 'watches', targetPattern()], 8],
    ['proper name antecedent', ['A', 'Maria', 'watches', 'cats.', 'It', 'watches', targetPattern()], 6],
    ['human antecedent', ['A', 'teacher', 'watches', 'cats.', 'It', 'watches', targetPattern()], 6],
    ['inanimate antecedent', ['A', 'machine', 'watches', 'cats.', 'It', 'watches', targetPattern()], 6],
    ['weather it and no target', ['A', 'dog', 'watches', 'cats.', 'It', 'rains.'], 5],
    ['reverse direction and cataphora', ['It', 'watches', 'cats.', 'A', 'dog', 'watches', targetPattern()], 6],
  ];
  for (const [name, tokens, index] of negatives) await check(name, () => {
    const evidence = recognize(setup(tokens, index));
    assert.notEqual(evidence.reason, 'role-aligned', `${name} must abstain`);
    assert.equal(evidence.nominee, undefined, `${name} must not nominate`);
  });
  await check('source and target predicates require one shared supported lemma', () => {
    const original = h.getHumanPlaytestAnalysis;
    h.getHumanPlaytestAnalysis = word => {
      const analysis = original(word);
      return /^(watch|watches)$/.test(String(word).toLowerCase())
        ? { ...analysis, lemmas: [...analysis.lemmas, 'like'] } : analysis;
    };
    try { assert.notEqual(recognize(setup(positives[0][1], 6)).reason, 'role-aligned'); }
    finally { h.getHumanPlaytestAnalysis = original; }
  });

  async function prepared(tokens = positives[0][1]) {
    const input = setup(tokens, 6);
    input.lexicalPool = await h.buildHumanPlaytestPool(input.targetSlot, [], input.state, true);
    input.ordinaryCap = 112;
    const record = input.lexicalPool.contextualAccess.classData.enriched.find(c => c.normalized === 'cats');
    assert(record, 'cats has a real enriched candidate record');
    assert(input.lexicalPool.hardCandidates.some(c => c.normalized === 'cats'), 'cats passes hard authorization');
    input.ordinary = input.lexicalPool.candidates.filter(c => c.normalized !== 'cats').slice(0, 6);
    return { input, record };
  }
  const admit = (input, evidence = h.recognizeAdjacentItSubjectNomination(input.state)) => h.admitCrossSentenceNomination({ ...input,
    evidence,
    mechanismVersion: 'adjacent-it-subject-nomination-v1' });
  await check('authorized enriched nominee absent from ordinary list appends exactly once', async () => {
    const { input, record } = await prepared();
    assert(!input.ordinary.some(c => c.normalized === 'cats'));
    const oldOrder = input.ordinary.map(c => c.word), before = plain(input.ordinary);
    const result = admit(input);
    assert.equal(result.diagnostic.reason, 'admitted');
    assert.equal(result.diagnostic.evidenceAdditionCount, 1);
    assert.equal(result.candidates.length, input.ordinary.length + 1);
    assert.deepEqual(result.candidates.slice(0, -1).map(c => c.word), oldOrder);
    assert.equal(result.candidates.at(-1).submissionSurface, 'cats');
    for (const key of Object.keys(record)) assert.deepEqual(plain(result.candidates.at(-1)[key]), plain(record[key]), key);
    assert.deepEqual(plain(input.ordinary), before);
    assert(!Object.keys(result.candidates.at(-1)).some(key => /adjacent|predicateLemma|antecedent|contributingProvider/.test(key)));
  });
  await check('nominee already present preserves position and metadata without capacity use', async () => {
    const { input, record } = await prepared();
    const existing = { ...record, sentinelMetadata: 'keep-me' };
    input.ordinary.splice(2, 0, existing);
    input.evidenceBudget = 0;
    const before = plain(input.ordinary), result = admit(input);
    assert.equal(result.diagnostic.reason, 'already-present');
    assert.equal(result.diagnostic.evidenceAdditionCount, 0);
    assert.deepEqual(plain(result.candidates), before);
    assert.equal(result.candidates[2].sentinelMetadata, 'keep-me');
  });
  const controls = [
    ['authorization failure', x => { x.lexicalPool.hardCandidates = []; x.lexicalPool.universe = []; }, 'no-authorized-candidate-record'],
    ['excluded from preparation', x => { x.lexicalPool.contextualAccess.classData.enriched = []; }, 'existing-preparation-excluded'],
    ['wrong target length', x => { x.state.slots[6].letters.pop(); }, 'target-length'],
    ['revealed letter mismatch', x => { x.state.slots[6].letters[1].visible = 'x'; }, 'revealed-letter-mismatch'],
    ['case mismatch', x => { x.state.slots[6].letters[0].capital = true; }, 'case-pattern-mismatch'],
    ['public rejection', x => { x.state.rejectedWordsBySlot[6] = ['cats']; }, 'public-rejection'],
    ['disabled allowance', x => { x.evidenceBudget = 0; }, 'evidence-capacity-blocked'],
    ['exhausted allowance', x => { x.evidenceUsed = 1; }, 'evidence-capacity-blocked'],
    ['stale board', x => { x.boardKey = 'stale'; }, 'stale-board'],
    ['stale opportunity', x => { x.opportunity = { ticket: -1, gameId: -1, boardKey: x.boardKey }; }, 'stale-opportunity'],
  ];
  for (const [name, mutate, expected] of controls) await check(name, async () => {
    const { input } = await prepared(), evidence = h.recognizeAdjacentItSubjectNomination(input.state); mutate(input);
    if (name !== 'stale board') input.boardKey = e.boardKey(input.state);
    input.snapshot = h.buildEttinPublicSnapshot(input.state);
    const result = admit(input, evidence);
    assert.equal(result.diagnostic.evidenceAdditionCount, 0);
    assert.deepEqual(plain(result.candidates), plain(input.ordinary));
    if (expected) assert.equal(result.diagnostic.reason, expected);
  });
  await check('absolute block policy rejects the nominee', async () => {
    const { input } = await prepared();
    h.vault4Dictionary.absoluteBlockedWords.add('cats');
    try {
      const result = admit(input);
      assert.equal(result.diagnostic.reason, 'absolute-block');
      assert.equal(result.diagnostic.evidenceAdditionCount, 0);
      assert.deepEqual(plain(result.candidates), plain(input.ordinary));
    } finally { h.vault4Dictionary.absoluteBlockedWords.delete('cats'); }
  });
  await check('provider overlap deduplicates once and preserves all provenance', async () => {
    const { input } = await prepared();
    const saved = [h.recognizeAdjacentQaNomination, h.recognizeAdjacentDeclarativeNomination];
    const it = h.recognizeAdjacentItSubjectNomination(input.state);
    try {
      h.recognizeAdjacentQaNomination = () => ({ ...it, mechanismVersion: 'adjacent-qa-nomination-v1' });
      h.recognizeAdjacentDeclarativeNomination = () => ({ ...it, mechanismVersion: 'adjacent-declarative-nomination-v1' });
      for (const key of ['buildEttinPersonAccessExtension','buildEttinContextualAccessExtension','buildEntityTypeAccessExtension']) {
        if (key === 'buildEttinContextualAccessExtension') h[key] = () => ({ candidates: [] });
        else if (key === 'buildEntityTypeAccessExtension') h[key] = () => ({ candidates: [], matchedTypes: new Map() });
        else h[key] = () => [];
      }
      h.buildHumanPlaytestPool = async () => ({ ...input.lexicalPool, candidates: input.ordinary });
      h.GGGEttinProvider.scoreCandidates = async (snapshot, candidates) => ({ candidates: candidates.map((c, i) =>
        ({ ...c, rank: i + 1, score: -i, probability: 1 / candidates.length })) });
      const result = await h.buildEttinPilotPool(input.targetSlot);
      assert.equal(result.status, 'ready');
      const diagnostic = result.pool.crossSentenceNomination;
      assert.equal(diagnostic.reason, 'admitted');
      assert.equal(diagnostic.evidenceAdditionCount, 1);
      assert.deepEqual(Array.from(diagnostic.contributingProviders), [
        'adjacent-qa-nomination-v1', 'adjacent-declarative-nomination-v1', 'adjacent-it-subject-nomination-v1']);
      assert.equal(result.pool.candidates.filter(c => c.normalized === 'cats').length, 1);
      assert(result.pool.candidates.find(c => c.normalized === 'cats').rank > 0);
      assert.equal(diagnostic.providerNominees.find(item =>
        item.provider === 'adjacent-it-subject-nomination-v1').antecedent, 'dog');
      assert(events.some(event => event.type === 'ettin-cross-sentence-nomination'));
    } finally { h.recognizeAdjacentQaNomination = saved[0]; h.recognizeAdjacentDeclarativeNomination = saved[1]; }
  });
  await check('real Mechanism #3 nomination enters ordinary ETTIN scoring without a bonus', async () => {
    const { input } = await prepared();
    const saved = Object.fromEntries(['buildHumanPlaytestPool','buildEttinPersonAccessExtension',
      'buildEttinContextualAccessExtension','buildEntityTypeAccessExtension'].map(key => [key, h[key]]));
    let scoredInput;
    try {
      h.buildHumanPlaytestPool = async () => ({ ...input.lexicalPool, candidates: input.ordinary });
      h.buildEttinPersonAccessExtension = () => [];
      h.buildEttinContextualAccessExtension = () => ({ candidates: [] });
      h.buildEntityTypeAccessExtension = () => ({ candidates: [], matchedTypes: new Map() });
      h.GGGEttinProvider.scoreCandidates = async (snapshot, candidates) => {
        scoredInput = plain(candidates);
        return { candidates: candidates.map((candidate, index) => ({ ...candidate, rank: index + 1,
          score: -index, probability: 1 / candidates.length })) };
      };
      const result = await h.buildEttinPilotPool(input.targetSlot);
      assert.equal(result.status, 'ready');
      const diagnostic = result.pool.adjacentItSubjectNomination;
      assert.equal(diagnostic.reason, 'admitted');
      assert.equal(diagnostic.evidenceAdditionCount, 1);
      assert.equal(scoredInput.length, input.ordinary.length + 1);
      assert.deepEqual(scoredInput.slice(0, -1).map(candidate => candidate.word),
        plain(input.ordinary.map(candidate => candidate.submissionSurface)));
      assert.equal(scoredInput.at(-1).word, 'cats');
      assert.equal(result.pool.candidates.at(-1).rank, result.pool.candidates.length);
      assert.equal(result.pool.candidates.at(-1).score, -(result.pool.candidates.length - 1));
      assert.equal(result.pool.candidates.at(-1).probability, 1 / result.pool.candidates.length);
      for (let index = 0; index < input.ordinary.length; index++) {
        for (const key of ['supportTier','proposalReasons','frequency','properNounBankCategories']) {
          assert.equal(JSON.stringify(scoredInput[index][key]), JSON.stringify(input.ordinary[index][key]), key + ' at ' + index);
        }
      }
      const enriched = input.lexicalPool.contextualAccess.classData.enriched.find(candidate => candidate.normalized === 'cats');
      for (const key of Object.keys(enriched)) {
        assert.equal(JSON.stringify(scoredInput.at(-1)[key]), JSON.stringify(enriched[key]), key + ' nominee metadata');
      }
      assert(!Object.keys(scoredInput.at(-1)).some(key =>
        /adjacent|antecedent|predicateLemma|contributingProvider/.test(key)));
      assert(events.some(event => event.type === 'ettin-adjacent-it-subject-nomination' && event.reason === 'admitted'));
    } finally { Object.assign(h, saved); }
  });
  await check('conflicting provider nominees add nothing', async () => {
    const { input } = await prepared();
    const it = h.recognizeAdjacentItSubjectNomination(input.state);
    const saved = [h.recognizeAdjacentQaNomination, h.recognizeAdjacentDeclarativeNomination,
      h.recognizeAdjacentItSubjectNomination];
    const ordinary = input.ordinary.filter(c => !['cats', 'birds'].includes(c.normalized));
    try {
      h.recognizeAdjacentQaNomination = () => ({ ...it, nominee: 'birds', mechanismVersion: 'adjacent-qa-nomination-v1' });
      h.recognizeAdjacentDeclarativeNomination = () => ({ ...it, mechanismVersion: 'adjacent-declarative-nomination-v1' });
      h.recognizeAdjacentItSubjectNomination = () => it;
      h.buildHumanPlaytestPool = async () => ({ ...input.lexicalPool, candidates: ordinary });
      for (const key of ['buildEttinPersonAccessExtension','buildEttinContextualAccessExtension','buildEntityTypeAccessExtension']) {
        if (key === 'buildEttinContextualAccessExtension') h[key] = () => ({ candidates: [] });
        else if (key === 'buildEntityTypeAccessExtension') h[key] = () => ({ candidates: [], matchedTypes: new Map() });
        else h[key] = () => [];
      }
      h.GGGEttinProvider.scoreCandidates = async (snapshot, candidates) => ({ candidates: candidates.map((c, i) =>
        ({ ...c, rank: i + 1, score: -i, probability: 1 / candidates.length })) });
      const result = await h.buildEttinPilotPool(input.targetSlot);
      assert.equal(result.status, 'ready');
      assert.equal(result.pool.crossSentenceNomination.reason, 'conflicting-provider-nominations');
      assert.equal(result.pool.crossSentenceNomination.evidenceAdditionCount, 0);
      assert(!result.pool.candidates.some(c => ['cats', 'birds'].includes(c.normalized)));
    } finally {
      h.recognizeAdjacentQaNomination = saved[0]; h.recognizeAdjacentDeclarativeNomination = saved[1];
      h.recognizeAdjacentItSubjectNomination = saved[2];
    }
  });
  await check('shared admission failure adds nothing and does not retry another provider', async () => {
    const { input } = await prepared();
    const it = h.recognizeAdjacentItSubjectNomination(input.state);
    const saved = [h.recognizeAdjacentQaNomination, h.recognizeAdjacentDeclarativeNomination,
      h.recognizeAdjacentItSubjectNomination, h.buildHumanPlaytestPool];
    try {
      h.recognizeAdjacentQaNomination = () => ({ ...it, mechanismVersion: 'adjacent-qa-nomination-v1' });
      h.recognizeAdjacentDeclarativeNomination = () => ({ ...it, mechanismVersion: 'adjacent-declarative-nomination-v1' });
      h.recognizeAdjacentItSubjectNomination = () => it;
      input.lexicalPool.hardCandidates = input.lexicalPool.hardCandidates.filter(c => c.normalized !== 'cats');
      input.lexicalPool.universe = input.lexicalPool.universe.filter(c => c.normalized !== 'cats');
      h.buildHumanPlaytestPool = async () => ({ ...input.lexicalPool, candidates: input.ordinary });
      for (const key of ['buildEttinPersonAccessExtension','buildEttinContextualAccessExtension','buildEntityTypeAccessExtension']) {
        if (key === 'buildEttinContextualAccessExtension') h[key] = () => ({ candidates: [] });
        else if (key === 'buildEntityTypeAccessExtension') h[key] = () => ({ candidates: [], matchedTypes: new Map() });
        else h[key] = () => [];
      }
      h.GGGEttinProvider.scoreCandidates = async (snapshot, candidates) => ({ candidates: candidates.map((candidate, index) =>
        ({ ...candidate, rank: index + 1, score: -index, probability: 1 / candidates.length })) });
      const result = await h.buildEttinPilotPool(input.targetSlot);
      assert.equal(result.status, 'ready');
      assert.equal(result.pool.crossSentenceNomination.reason, 'no-authorized-candidate-record');
      assert.equal(result.pool.crossSentenceNomination.evidenceAdditionCount, 0);
      assert(!result.pool.candidates.some(candidate => candidate.normalized === 'cats'));
      assert.deepEqual(Array.from(result.pool.crossSentenceNomination.contributingProviders), [
        'adjacent-qa-nomination-v1', 'adjacent-declarative-nomination-v1', 'adjacent-it-subject-nomination-v1']);
    } finally {
      h.recognizeAdjacentQaNomination = saved[0];
      h.recognizeAdjacentDeclarativeNomination = saved[1];
      h.recognizeAdjacentItSubjectNomination = saved[2];
      h.buildHumanPlaytestPool = saved[3];
    }
  });
  await check('board and opportunity changes during scoring discard the prepared result', async () => {
    for (const staleKind of ['preparation','board','opportunity']) {
      const { input } = await prepared();
      const savedPoolBuilder = h.buildHumanPlaytestPool;
      const owner = staleKind === 'opportunity'
        ? vm.runInContext('({ ticket: HUMAN_PLAYTEST_TURN.generation, gameId: ETTIN_ATTENTION.gameId })', h)
        : null;
      if (owner) owner.boardKey = input.boardKey;
      const changeBoard = () => { h.groups[0].querySelectorAll()[0].textContent = 'X'; };
      h.buildHumanPlaytestPool = async () => {
        if (staleKind === 'preparation') changeBoard();
        return { ...input.lexicalPool, candidates: input.ordinary };
      };
      h.GGGEttinProvider.scoreCandidates = async (snapshot, candidates) => {
        if (staleKind === 'board') changeBoard();
        else vm.runInContext('HUMAN_PLAYTEST_TURN.generation++', h);
        return { candidates: candidates.map((candidate, index) => ({ ...candidate, rank: index + 1,
          score: -index, probability: 1 / candidates.length })) };
      };
      try {
        const result = await h.buildEttinPilotPool(input.targetSlot, null, owner);
        assert.equal(result.status, 'stale', staleKind);
        if (staleKind !== 'preparation') {
          const expected = staleKind === 'board' ? 'stale-board' : 'stale-opportunity';
          assert(events.some(event => event.type === 'ettin-adjacent-it-subject-nomination' &&
            event.reason === expected && event.discarded === true), staleKind);
        }
      } finally { h.buildHumanPlaytestPool = savedPoolBuilder; }
    }
  });
  await check('same public board with different hidden answers produces identical evidence', () => {
    const input = setup(positives[0][1], 6);
    let hiddenAnswerReads = 0;
    const observe = hiddenAnswer => {
      h.groups[6].querySelectorAll().forEach((block, index) => {
        const data = { revealed: 'false', trailing: index === 3 ? '.' : '' };
        Object.defineProperty(data, 'letter', { get() { hiddenAnswerReads++; return hiddenAnswer[index]; } });
        block.dataset = data;
      });
      const state = h.getHumanPlaytestPublicState(input.targetSlot);
      return { state, evidence: h.recognizeAdjacentItSubjectNomination(state) };
    };
    const firstResult = observe('cats'), secondResult = observe('dogs');
    const { state: first, evidence: firstEvidence } = firstResult;
    const { state: second, evidence: secondEvidence } = secondResult;
    assert.deepEqual(plain(first), plain(second));
    assert.deepEqual(plain(firstEvidence), plain(secondEvidence));
    assert.equal(firstEvidence.nominee, 'cats');
    assert.equal(hiddenAnswerReads, 0);
  });
  await check('Stage 3 he/she compatibility remains its existing separate Q/A behavior', () => {
    const input = setup(['Who', 'does', { pattern: '_____', capital: true }, 'love?', 'She', 'loves', 'Tom.'], 2);
    const construction = h.buildEttinConstructionContext(input.state, e, h.vault4Dictionary.dictionary);
    const context = h.discoursePersonCompatibilityContextForTarget(input.state, input.targetSlot, construction, e);
    assert.equal(context.active, true);
    assert.equal(context.pronoun, 'she');
    assert.equal(context.role, 'subject');
    assert.equal(context.predicate, 'love');
    assert.notEqual(h.recognizeAdjacentItSubjectNomination(input.state).reason, 'role-aligned');
  });
  console.log(`${passed} passed; ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });
