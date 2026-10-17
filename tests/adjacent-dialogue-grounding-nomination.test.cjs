const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { fixture } = require('./human-playtest-fixture.cjs');
const { root } = require('./ai-harness.cjs');
const plain = value => JSON.parse(JSON.stringify(value));
const version = 'adjacent-dialogue-grounding-nomination-v1';

(async () => {
  const { h, e, board, turns } = await fixture();
  const source = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
  vm.runInContext(source.slice(source.indexOf('  const ENTITY_TYPE_ORDER'), source.indexOf('  function candidateEntityTypes')), h);
  vm.runInContext(fs.readFileSync(path.join(root, 'public-board.js'), 'utf8'), h);
  vm.runInContext(fs.readFileSync(path.join(root, 'proper-noun-bank.js'), 'utf8'), h);
  await h.GGGProperNounBank.ready();
  const provider = fs.readFileSync(path.join(root, 'assets/ettin/ettin-provider.js'), 'utf8');
  vm.runInContext(provider.slice(provider.indexOf('function alphaCount('), provider.indexOf('function renderBoard(')), h);
  h.GGGEttinProvider = { validateCandidate: h.validateCandidate };
  h.location.search = '?humanPlaytestMode=1&ettinPilot=1';
  turns(); h.performance = { now: () => 0 };
  const events = [];
  h.logEttinPilot = (type, target, detail) => events.push({ type, ...detail });
  let passed = 0, failed = 0;
  async function check(name, run) {
    try { await run(); passed++; console.log('PASS', name); }
    catch (error) { failed++; console.error('FAIL', name, error.stack); }
  }
  const hidden = (pattern = '____.', capital = false) => ({ pattern, capital });
  const tokens = (verb = 'like', noun = 'cats') => ['Do', 'you', verb, noun + '?', 'Yes,', 'I', verb,
    hidden('_'.repeat(noun.length) + '.')];
  function input(words = tokens(), index = words.length - 1) {
    const targetSlot = board(words).find(slot => slot.slotIndex === index) ||
      { slotIndex: index, group: h.groups[index], length: h.groups[index].querySelectorAll().length };
    const state = h.getHumanPlaytestPublicState(targetSlot);
    return { state, targetSlot, snapshot: h.buildEttinPublicSnapshot(state), boardKey: e.boardKey(state),
      opportunity: null, ordinaryCap: 112, ordinary: [] };
  }
  const recognize = x => h.recognizeAdjacentDialogueGroundingNomination(x.state);
  for (const [verb, noun] of [['like', 'cats'], ['like', 'dogs'], ['watch', 'birds'], ['eat', 'apples']]) {
    await check(`public affirmative reply: ${verb} ${noun}`, () => {
      const x = input(tokens(verb, noun)), evidence = recognize(x);
      assert.equal(evidence.reason, 'role-aligned'); assert.equal(evidence.nominee, noun);
      assert.equal(evidence.mechanismVersion, version);
      assert.equal(evidence.relation, 'affirmative-polar-reply');
      assert.equal(evidence.predicateLemma, verb);
      assert.equal(evidence.questionSubject, 'you'); assert.equal(evidence.replySubject, 'I');
      assert.equal(evidence.affirmation, 'Yes');
      assert.equal(evidence.sourceRole, 'direct-object'); assert.equal(evidence.targetRole, 'direct-object');
      assert.equal(evidence.sourceObjectSlot, 3); assert.equal(evidence.targetObjectSlot, 7);
      assert.deepEqual(plain(evidence.sourceSpan), { start: 0, end: 3 });
      assert.deepEqual(plain(evidence.targetSpan), { start: 4, end: 7 });
      for (const method of ['recognizeAdjacentQaNomination', 'recognizeAdjacentDeclarativeNomination',
        'recognizeAdjacentItSubjectNomination', 'recognizeAdjacentOwnershipNomination']) {
        assert.notEqual(h[method](x.state).reason, 'role-aligned');
      }
    });
  }
  const replace = (index, value) => { const words = tokens(); words[index] = value; return words; };
  const negatives = [
    ['missing Yes', ['Do','you','like','cats?','I','like',hidden()]],
    ...['No,','Maybe,','Sure,','Yeah,','Indeed,'].map(marker => [marker, replace(4, marker)]),
    ['predicate mismatch', replace(6, 'hate')],
    ['she', replace(5, 'she')], ['we', replace(5, 'we')],
    ['reverse perspective', ['Do','I','like','cats?','Yes,','you','like',hidden()]],
    ['coordinated source', ['Do','you','like','cats','or','dogs?','Yes,','I','like',hidden()]],
    ['intervening sentence', ['Do','you','like','cats?','Birds','sing.','Yes,','I','like',hidden()]],
    ['past tense', ['Did','you','like','cats?','Yes,','I','liked',hidden()]],
    ['negation', ['Do','you','like','cats?','Yes,','I','do','not','like',hidden()]],
    ['hidden source', replace(3, hidden('c___?'))],
    ['contradictory letters', replace(7, hidden('d___.'))],
    ['wrong length', replace(7, hidden('_____.'))],
    ['mass noun', tokens('like', 'water')],
    ['WH territory', ['Who','visits','Kyoto?','Elena','visits',hidden('_____.', true)]],
    ['hidden affirmation', replace(4, hidden('Y__,', true))],
    ['hidden source verb', replace(2, hidden('l___'))],
    ['hidden reply verb', replace(6, hidden('l___'))],
    ['hidden subject', replace(1, hidden('y__'))],
    ['missing comma', replace(4, 'Yes')], ['extra punctuation', replace(4, 'Yes,,')],
    ['internal punctuation', replace(3, "ca'ts?")],
    ['wrong question casing', replace(0, 'do')], ['wrong object casing', replace(3, 'Cats?')],
    ['wrong verb casing', replace(2, 'Like')], ['wrong target casing', replace(7, hidden('____.', true))],
    ['solved target', replace(7, 'cats.')],
    ['unsupported auxiliary', tokens('have', 'cats')],
    ['ambiguous tense metadata', tokens('read', 'books')],
    ['pronoun object', tokens('like', 'them')],
    ['singular object', tokens('like', 'cat')],
    ['extra modifier', ['Do','you','like','small','cats?','Yes,','I','like',hidden()]],
    ['exclamation reply', replace(7, hidden('____!'))],
    ['no preceding question', ['Yes,','I','like',hidden()]],
  ];
  for (const [name, words] of negatives) await check(`abstains: ${name}`, () => {
    const evidence = recognize(input(words));
    assert.notEqual(evidence.reason, 'role-aligned'); assert.equal(evidence.nominee, undefined);
  });
  await check('compatible partial target and surrounding sentences', () => {
    const words = ['Birds','sing.', ...replace(7, hidden('c_t_.')), 'Dogs','bark.'];
    const result = recognize(input(words, 9));
    assert.equal(result.nominee, 'cats'); assert.equal(result.sourceSpan.start, 2);
  });
  await check('no reverse access or hidden predicate target', () => {
    for (const index of [2, 3, 6]) {
      const words = ['Do','you','like','cats?','Yes,','I','like','cats.'];
      words[index] = hidden(index === 3 ? '____?' : '____');
      assert.equal(recognize(input(words, index)).nominee, undefined);
    }
  });
  for (const [name, mutate] of [
    ['unsupported predicate', a => ({ ...a, primaryVerb: false })],
    ['multiple supported bases', a => ({ ...a, lemmas: ['like', 'watch'] })],
  ]) await check(`lexical refusal: ${name}`, () => {
    const original = h.getHumanPlaytestAnalysis;
    h.getHumanPlaytestAnalysis = word => String(word).toLowerCase() === 'like' ? mutate(original(word)) : original(word);
    try { assert.equal(recognize(input()).nominee, undefined); }
    finally { h.getHumanPlaytestAnalysis = original; }
  });
  await check('hidden-answer independence and zero hidden-letter reads', () => {
    const x = input(); let reads = 0;
    const observe = answer => {
      h.groups[7].querySelectorAll().forEach((block, index) => {
        const dataset = { revealed: 'false', trailing: index === 3 ? '.' : '' };
        Object.defineProperty(dataset, 'letter', { get() { reads++; return answer[index]; } });
        block.dataset = dataset;
      });
      const state = h.getHumanPlaytestPublicState(x.targetSlot);
      return { state, evidence: h.recognizeAdjacentDialogueGroundingNomination(state) };
    };
    const first = observe('cats'), second = observe('dogs');
    assert.deepEqual(plain(first), plain(second)); assert.equal(first.evidence.nominee, 'cats');
    assert.equal(reads, 0);
  });
  async function prepared(words = tokens()) {
    const x = input(words);
    x.lexicalPool = await h.buildHumanPlaytestPool(x.targetSlot, [], x.state, true);
    const record = x.lexicalPool.contextualAccess.classData.enriched.find(c => c.normalized === 'cats');
    assert(record); assert(x.lexicalPool.hardCandidates.some(c => c.normalized === 'cats'));
    x.ordinary = x.lexicalPool.candidates.filter(c => c.normalized !== 'cats').slice(0, 8);
    return { x, record };
  }
  const admit = (x, evidence = recognize(x)) => h.admitCrossSentenceNomination({ ...x, evidence, mechanismVersion: version });
  await check('new admission appends exactly one prepared record without evidence metadata', async () => {
    const { x, record } = await prepared(), before = plain(x), result = admit(x);
    assert.equal(result.diagnostic.reason, 'admitted'); assert.equal(result.diagnostic.evidenceAdditionCount, 1);
    assert.equal(result.diagnostic.finalCandidateCount, x.ordinary.length + 1);
    assert.deepEqual(plain(result.candidates.slice(0, -1)), before.ordinary);
    for (const key of Object.keys(record)) assert.deepEqual(plain(result.candidates.at(-1)[key]), plain(record[key]), key);
    assert(!Object.keys(result.candidates.at(-1)).some(key => /dialogue|affirmation|replySubject|predicateLemma/.test(key)));
    assert.deepEqual(plain(x), before);
  });
  await check('already present preserves order and metadata without capacity consumption', async () => {
    const { x, record } = await prepared();
    x.ordinary.splice(2, 0, { ...record, marker: 'preserve' }); x.evidenceBudget = 0;
    const before = plain(x.ordinary), result = admit(x);
    assert.equal(result.diagnostic.reason, 'already-present'); assert.equal(result.diagnostic.evidenceAdditionCount, 0);
    assert.deepEqual(plain(result.candidates), before);
  });
  const refusals = [
    ['authorization', x => { x.lexicalPool.hardCandidates = []; x.lexicalPool.universe = []; }, 'no-authorized-candidate-record'],
    ['hard exclusion', x => { x.lexicalPool.hardCandidates = []; }, 'existing-preparation-excluded'],
    ['enriched exclusion', x => { x.lexicalPool.contextualAccess.classData.enriched = []; }, 'existing-preparation-excluded'],
    ['role ineligible', (x, r) => { r.roleEligible = false; }, 'existing-preparation-excluded'],
    ['missing lexical classes', (x, r) => { delete r.lexicalClasses; }, 'existing-preparation-excluded'],
    ['public rejection', x => { x.state.rejectedWordsBySlot[7] = ['cats']; }, 'public-rejection'],
    ['disabled allowance', x => { x.evidenceBudget = 0; }, 'evidence-capacity-blocked'],
    ['exhausted allowance', x => { x.evidenceUsed = 1; }, 'evidence-capacity-blocked'],
    ['ordinary overflow', x => { x.ordinaryCap = 1; }, 'evidence-capacity-blocked'],
    ['stale board', x => { x.boardKey = 'old'; }, 'stale-board'],
    ['stale opportunity', x => { x.opportunity = { ticket: -1, gameId: -1, boardKey: x.boardKey }; }, 'stale-opportunity'],
    ['hard length', x => { x.state.slots[7].letters.pop(); }, 'target-length'],
    ['hard letters', x => { x.state.slots[7].letters[0].visible = 'd'; }, 'revealed-letter-mismatch'],
    ['hard case', x => { x.state.slots[7].letters[0].capital = true; }, 'case-pattern-mismatch'],
  ];
  for (const [name, mutate, reason] of refusals) await check(`shared admission refuses ${name}`, async () => {
    const { x, record } = await prepared(), evidence = recognize(x);
    mutate(x, record); if (name !== 'stale board') x.boardKey = e.boardKey(x.state);
    x.snapshot = h.buildEttinPublicSnapshot(x.state);
    const before = plain(x.ordinary), result = admit(x, evidence);
    assert.equal(result.diagnostic.reason, reason); assert.equal(result.diagnostic.evidenceAdditionCount, 0);
    assert.deepEqual(plain(result.candidates), before);
  });
  await check('absolute block remains authoritative', async () => {
    const { x } = await prepared(); h.vault4Dictionary.absoluteBlockedWords.add('cats');
    try { const result = admit(x); assert.equal(result.diagnostic.reason, 'absolute-block');
      assert.equal(result.diagnostic.evidenceAdditionCount, 0); }
    finally { h.vault4Dictionary.absoluteBlockedWords.delete('cats'); }
  });
  async function integrated(x, qaEvidence, onScore) {
    const names = ['buildHumanPlaytestPool', 'buildEttinPersonAccessExtension', 'buildEttinContextualAccessExtension',
      'buildEntityTypeAccessExtension', 'recognizeAdjacentQaNomination'];
    const saved = names.map(name => h[name]), oldScore = h.GGGEttinProvider.scoreCandidates;
    events.length = 0; let scored;
    try {
      h.buildHumanPlaytestPool = async () => ({ ...x.lexicalPool, candidates: x.ordinary });
      h.buildEttinPersonAccessExtension = () => [];
      h.buildEttinContextualAccessExtension = () => ({ candidates: [] });
      h.buildEntityTypeAccessExtension = () => ({ candidates: [], matchedTypes: new Map() });
      if (qaEvidence) h.recognizeAdjacentQaNomination = () => qaEvidence;
      h.GGGEttinProvider.scoreCandidates = async (_, candidates) => {
        scored = plain(candidates); if (onScore) onScore();
        return { candidates: candidates.map((candidate, i) => ({ ...candidate,
          rank: i + 1, score: -i, probability: 1 / candidates.length })) };
      };
      return { result: await h.buildEttinPilotPool(x.targetSlot), scored };
    } finally { names.forEach((name, i) => { h[name] = saved[i]; }); h.GGGEttinProvider.scoreCandidates = oldScore; }
  }
  await check('integration preserves scoring rank and prepared metadata', async () => {
    const { x, record } = await prepared(), { result, scored } = await integrated(x);
    assert.equal(result.status, 'ready');
    assert.equal(result.pool.adjacentDialogueGroundingNomination.reason, 'admitted');
    assert.equal(scored.at(-1).word, 'cats');
    for (const key of Object.keys(record)) assert.deepEqual(scored.at(-1)[key], plain(record[key]), key);
    assert.equal(result.pool.candidates.find(c => c.normalized === 'cats').rank, scored.length);
    assert(!Object.keys(scored.at(-1)).some(key => /dialogue|affirmation|replySubject|predicateLemma/.test(key)));
    assert.equal(result.pool.candidateCap, result.pool.ordinaryCandidateCap + 1);
    assert(events.some(e => e.type === 'ettin-adjacent-dialogue-grounding-recognition' && e.reason === 'role-aligned'));
    assert(events.some(e => e.type === 'ettin-adjacent-dialogue-grounding-nomination' && e.reason === 'admitted'));
  });
  for (const conflict of [false, true]) await check(conflict ? 'provider conflict adds nothing' : 'same nominee deduplicates with provenance', async () => {
    const { x } = await prepared(), evidence = recognize(x);
    const { result } = await integrated(x, { ...evidence, nominee: conflict ? 'dogs' : 'cats', mechanismVersion: 'adjacent-qa-nomination-v1' });
    const d = result.pool.crossSentenceNomination;
    assert.equal(d.reason, conflict ? 'conflicting-provider-nominations' : 'admitted');
    assert.equal(d.evidenceAdditionCount, conflict ? 0 : 1);
    assert.deepEqual(Array.from(d.contributingProviders), ['adjacent-qa-nomination-v1', version]);
    assert.equal(result.pool.candidates.filter(c => c.normalized === 'cats').length, conflict ? 0 : 1);
    assert.equal(d.providerNominees.find(p => p.provider === version).dialogueGrounding.relation, 'affirmative-polar-reply');
    assert(events.some(e => e.type === 'ettin-cross-sentence-nomination'));
  });
  await check('failed shared admission does not rescue a nominee via another provider', async () => {
    const { x } = await prepared(), evidence = recognize(x);
    x.lexicalPool.contextualAccess.classData.enriched = [];
    const { result } = await integrated(x, { ...evidence, mechanismVersion: 'adjacent-qa-nomination-v1' });
    assert.equal(result.pool.crossSentenceNomination.reason, 'existing-preparation-excluded');
    assert.equal(result.pool.crossSentenceNomination.evidenceAdditionCount, 0);
    assert.equal(result.pool.candidates.length, x.ordinary.length);
  });
  await check('abstention diagnostic is emitted with no nominee', async () => {
    const { x } = await prepared(replace(4, 'No,')); await integrated(x);
    assert(events.some(e => e.type === 'ettin-adjacent-dialogue-grounding-recognition' &&
      e.reason === 'unsupported-fixed-token' && e.nominee === undefined));
  });
  await check('board changes during scoring discard the admitted result', async () => {
    const { x } = await prepared();
    const { result } = await integrated(x, null, () => board(replace(7, hidden('c___.'))));
    assert.equal(result.status, 'stale');
    assert(events.some(e => e.type === 'ettin-adjacent-dialogue-grounding-nomination' && e.discarded));
  });
  await check('diagnostic provenance cannot change Stage 3 distribution or selection', async () => {
    vm.runInContext(source.slice(source.indexOf('  const ETTIN_CONTEXT_PRIOR_VERSION'),
      source.indexOf('  function evaluateEntitySlotCompatibility')), h);
    const { x, record } = await prepared();
    const candidates = [...x.ordinary, record].map((c, i, all) => ({ ...c, word: c.submissionSurface,
      rank: i + 1, score: -i, probability: 1 / all.length }));
    const publicBoard = h.GGGPublicBoard.snapshot(x.state);
    const pool = { predictionMode: 'ettin-pilot', candidates, targetSlot: x.targetSlot, targetLength: 4,
      publicBoardKey: x.boardKey, snapshot: x.snapshot, attentionPlan: { boardKey: x.boardKey,
        considered: [{ slotIndex: 7, band: 'WEAK' }], publicBoard: { slots: publicBoard.slots } } };
    const one = h.buildEttinStage3Distribution({ ...pool, adjacentDialogueGroundingNomination: recognize(x) });
    const two = h.buildEttinStage3Distribution({ ...pool, adjacentDialogueGroundingNomination: { reason: 'unsupported-fixed-token' } });
    assert.equal(one.ok, true, one.reason); assert.deepEqual(plain(one), plain(two));
    assert.equal(h.chooseEttinStage3Candidate({ ...pool, stage3Distribution: one }, () => 0.5).candidate.word,
      h.chooseEttinStage3Candidate({ ...pool, stage3Distribution: two }, () => 0.5).candidate.word);
  });
  console.log(`${passed} passed; ${failed} failed`); process.exitCode = failed ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });
