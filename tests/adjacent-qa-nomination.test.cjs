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
  h.location.search = '?humanPlaytestMode=1&ettinPilot=1';
  vm.runInContext(fs.readFileSync(path.join(root, 'proper-noun-bank.js'), 'utf8'), h);
  await h.GGGProperNounBank.ready();
  const provider = fs.readFileSync(path.join(root, 'assets/ettin/ettin-provider.js'), 'utf8');
  // Exercise the real public hard validator without loading an ONNX model.
  vm.runInContext(provider.slice(provider.indexOf('function alphaCount('), provider.indexOf('function renderBoard(')), h);
  h.GGGEttinProvider = { validateCandidate: h.validateCandidate };
  turns();
  h.performance = { now: () => 0 };
  const events = [];
  h.logEttinPilot = (type, target, detail) => events.push({ type, ...detail });
  let passed = 0, failed = 0;
  async function check(name, run) {
    try { await run(); passed++; console.log('PASS', name); }
    catch (error) { failed++; console.error('FAIL', name, error.message); }
  }
  const hidden = (pattern = '_____', capital = true) => ({ pattern, capital });
  function setup(tokens, index) {
    const targetSlot = board(tokens).find(slot => slot.slotIndex === index);
    assert(targetSlot, 'fixture target is unresolved');
    const state = h.getHumanPlaytestPublicState(targetSlot);
    return { state, targetSlot, snapshot: h.buildEttinPublicSnapshot(state),
      boardKey: e.boardKey(state), opportunity: null, ordinaryCap: 112, ordinary: [] };
  }
  const positives = [
    ['two subject conjuncts', ['Who', 'helps', hidden('_____?'), 'Alice', 'and', 'Bruno', 'help', 'Clara.'], 2, 'Clara', 'subject', 'direct-object'],
    ['do question', ['What', 'does', hidden('____'), 'carry?', 'Nora', 'carries', 'water.'], 2, 'Nora', 'direct-object', 'subject'],
    ['answer object', ['Who', 'visits', 'Kyoto?', 'Elena', 'visits', hidden('_____.')], 5, 'Kyoto', 'subject', 'direct-object'],
    ['answer subject', ['What', 'does', 'Clara', 'collect?', hidden('_____'), 'collects', 'stamps.'], 4, 'Clara', 'direct-object', 'subject'],
    ['Puzzle 5', ['Who', 'loves', hidden('_____?'), 'Tom', 'and', 'Seymour', 'love', 'Susan.'], 2, 'Susan', 'subject', 'direct-object'],
    ['later question', ['Birds', 'sing.', 'Who', 'helps', hidden('_____?'), 'Alice', 'helps', 'Clara.'], 4, 'Clara', 'subject', 'direct-object'],
  ];
  for (const [name, tokens, index, nominee, wh, role] of positives) await check(name, () => {
    const result = h.recognizeAdjacentQaNomination(setup(tokens, index).state);
    assert.equal(result.reason, 'role-aligned');
    assert.equal(result.nominee, nominee);
    assert.equal(result.whRequestedRole, wh);
    assert.equal(result.targetRole, role);
    assert.equal(result.sourceRole, role);
    assert(result.predicateLemma);
    assert.equal(result.sourceMention.surface, nominee);
  });
  const negatives = [
    ['no public WH filler', ['Who', 'visits', 'Kyoto?', hidden('_____'), 'visits', 'Kyoto.'], 3, 'no-public-role-filler'],
    ['known conflict', ['Who', hidden('_____'), 'cats?', 'Mary', 'likes', 'dogs.'], 1, 'known-argument-conflict'],
    ['object coordination', ['Who', 'helps', hidden('_____?'), 'Alice', 'helps', 'Clara', 'and', 'Bruno.'], 2, 'multiple-role-fillers'],
    ['three subjects', ['Who', 'helps', hidden('_____?'), 'Alice', 'and', 'Tom', 'and', 'Bruno', 'help', 'Clara.'], 2, 'unsupported-clause-structure'],
    ['target in coordination', ['Who', 'helps', 'Clara?', 'Alice', 'and', hidden('_____'), 'help', 'Clara.'], 5, 'target-role-ambiguous'],
    ['predicate mismatch', ['Who', 'helps', hidden('_____?'), 'Alice', 'visits', 'Clara.'], 2, 'predicate-alignment-unclear'],
    ['indirect relation', ['Who', 'likes', hidden('_____?'), 'Alice', 'collects', 'stamps.'], 2, 'predicate-alignment-unclear'],
    ['unrelated neighbor', ['Who', 'helps', hidden('_____?'), 'Birds', 'sing.'], 2, 'unsupported-clause-structure'],
    ['pronoun', ['Who', 'helps', hidden('_____?'), 'She', 'helps', 'Clara.'], 2, 'reference-resolution-required'],
    ['negation', ['Who', 'helps', hidden('_____?'), 'Alice', 'does', 'not', 'help', 'Clara.'], 2, 'unsupported-predicate-construction'],
    ['unsolved evidence', ['Who', 'helps', hidden('_____?'), 'Alice', 'helps', hidden('_____.')], 2, 'incomplete-public-evidence'],
    ['answer first', ['Alice', 'helps', 'Clara.', 'Who', 'helps', hidden('_____?')], 5, 'no-supported-adjacent-qa'],
    ['passive', ['Who', 'helps', hidden('_____?'), 'Clara', 'is', 'helped', 'by', 'Alice.'], 2, 'unsupported-predicate-construction'],
    ['past tense', ['Who', 'helps', hidden('_____?'), 'Alice', 'helped', 'Clara.'], 2, 'unsupported-predicate-construction'],
    ['progressive', ['Who', 'helps', hidden('_____?'), 'Alice', 'is', 'helping', 'Clara.'], 2, 'unsupported-predicate-construction'],
    ['unresolved nominal type', ['Who', 'helps', hidden('_____?'), 'Quickly', 'helps', 'Clara.'], 2, 'type-compatibility-unresolved'],
    ['nonadjacent', ['Who', 'helps', hidden('_____?'), 'Birds', 'sing.', 'Alice', 'helps', 'Clara.'], 2, 'unsupported-clause-structure'],
    ['coordinated predicates', ['Who', 'helps', hidden('_____?'), 'Alice', 'helps', 'and', 'visits', 'Clara.'], 2, 'unsupported-clause-structure'],
    ['singular base answer', ['Who', 'helps', hidden('_____?'), 'Alice', 'help', 'Clara.'], 2, 'unsupported-predicate-construction'],
    ['past do question', ['What', 'did', hidden('____'), 'carry?', 'Nora', 'carries', 'water.'], 2, 'unsupported-clause-structure'],
    ['exclamation answer', ['Who', 'helps', hidden('_____?'), 'Alice', 'helps', 'Clara!'], 2, 'no-supported-adjacent-qa'],
  ];
  for (const [name, tokens, index, reason] of negatives) await check(name, () => {
    const result = h.recognizeAdjacentQaNomination(setup(tokens, index).state);
    assert.equal(result.reason, reason);
    assert.equal(result.nominee, undefined);
  });
  await check('all positive nominees survive real authorization and admission', async () => {
    for (const [name, tokens, index, nominee] of positives) {
      const input = setup(tokens, index);
      input.lexicalPool = await h.buildHumanPlaytestPool(input.targetSlot, [], input.state, true);
      const result = h.admitAdjacentQaNomination(input);
      assert.equal(result.diagnostic.reason, 'admitted', name);
      assert.equal(result.candidates[0].submissionSurface, nominee, name);
    }
  });
  await check('multiple shared lexical lemmas abstain', () => {
    const original = h.getHumanPlaytestAnalysis;
    h.getHumanPlaytestAnalysis = word => {
      const analysis = original(word);
      return /^(help|helps)$/.test(word.toLowerCase()) ? { ...analysis, lemmas: [...analysis.lemmas, 'visit'] } : analysis;
    };
    try { assert.equal(h.recognizeAdjacentQaNomination(setup(positives[0][1], 2).state).reason, 'predicate-alignment-unclear'); }
    finally { h.getHumanPlaytestAnalysis = original; }
  });
  async function prepared() {
    const input = setup(positives[4][1], 2);
    input.lexicalPool = await h.buildHumanPlaytestPool(input.targetSlot, [], input.state, true);
    const record = input.lexicalPool.contextualAccess.classData.enriched.find(c => c.normalized === 'susan');
    assert(record, 'Susan is independently authorized in real preparation');
    input.ordinary = input.lexicalPool.candidates.filter(c => c.normalized !== 'susan').slice(0, 3);
    return { input, record };
  }
  await check('absent authorized nominee: one append, metadata isolation, normal submission safety', async () => {
    const { input, record } = await prepared();
    const before = plain(input);
    const result = h.admitAdjacentQaNomination(input);
    assert.equal(result.diagnostic.reason, 'admitted');
    assert.equal(result.candidates.length, input.ordinary.length + 1);
    const added = result.candidates.at(-1);
    assert.equal(added.submissionSurface, 'Susan');
    for (const key of Object.keys(record)) assert.deepEqual(plain(added[key]), plain(record[key]), key);
    assert.deepEqual(plain(input), before, 'no mutation of preparation or ordinary candidates');
    assert.equal(result.diagnostic.evidenceAdditionCount, 1);
    assert.equal(h.humanPlaytestCandidateProblem({ ...input.lexicalPool, predictionMode: 'ettin-pilot',
      candidates: result.candidates }, { ...added, word: added.submissionSurface, publicBoardKey: input.boardKey }), null);
  });
  await check('already present: no move, no duplicate, no capacity consumed', async () => {
    const { input, record } = await prepared();
    input.ordinary.splice(1, 0, record);
    input.evidenceBudget = 0;
    const result = h.admitAdjacentQaNomination(input);
    assert.equal(result.diagnostic.reason, 'already-present');
    assert.equal(result.diagnostic.evidenceAdditionCount, 0);
    assert.deepEqual(plain(result.candidates), plain(input.ordinary));
  });
  const admissionControls = [
    ['missing authorization', x => { x.lexicalPool.hardCandidates = []; x.lexicalPool.universe = []; }, 'no-authorized-candidate-record'],
    ['preparation exclusion', x => { x.lexicalPool.contextualAccess.classData.enriched = []; }, 'existing-preparation-excluded'],
    ['blocked metadata', x => { x.lexicalPool.contextualAccess.classData.enriched.find(c => c.normalized === 'susan').properNounAuthorizationSource = 'invented'; }, 'proper-name-admission-invalid'],
    ['stale bank metadata', x => { x.lexicalPool.contextualAccess.classData.enriched.find(c => c.normalized === 'susan').properNounBankRevision = 'stale'; }, 'proper-name-admission-invalid'],
    ['wrong length', x => { x.state.slots[2].letters.pop(); }, 'target-length'],
    ['wrong pattern', x => { x.state.slots[2].letters[1].visible = 'x'; }, 'revealed-letter-mismatch'],
    ['wrong case', x => { x.state.slots[2].letters[0].capital = false; }, 'case-pattern-mismatch'],
    ['rejected', x => { x.state.rejectedWordsBySlot[2] = ['susan']; }, 'public-rejection'],
    ['ordinary capacity overflow', x => { x.ordinaryCap = 1; }, 'evidence-capacity-blocked'],
    ['disabled allowance', x => { x.evidenceBudget = 0; }, 'evidence-capacity-blocked'],
    ['exhausted allowance', x => { x.evidenceUsed = 1; }, 'evidence-capacity-blocked'],
    ['stale board', x => { x.boardKey = 'old'; }, 'stale-board'],
    ['stale opportunity', x => { x.opportunity = { ticket: -1, gameId: 0, boardKey: x.boardKey }; }, 'stale-opportunity'],
  ];
  for (const [name, change, reason] of admissionControls) await check(name, async () => {
    const { input } = await prepared();
    change(input);
    if (name !== 'stale board') input.boardKey = e.boardKey(input.state);
    input.snapshot = h.buildEttinPublicSnapshot(input.state);
    const result = h.admitAdjacentQaNomination(input);
    assert.equal(result.diagnostic.reason, reason);
    assert.deepEqual(plain(result.candidates), plain(input.ordinary));
  });
  await check('computed ordinary cap plus shared single evidence allowance', async () => {
    const { input } = await prepared();
    for (const cap of [3, 64, 112]) {
      input.ordinaryCap = cap;
      input.ordinary = Array.from({ length: cap }, (_, i) => ({ word: `ordinary-${i}` }));
      input.evidenceBudget = 5; // A caller cannot allocate more than the experiment permits.
      const result = h.admitAdjacentQaNomination(input);
      assert.equal(result.candidates.length, cap + 1);
      assert.equal(result.diagnostic.evidenceAdditionCount, 1);
    }
  });
  await check('ETTIN integration: controlled availability, ordinary order, scoring and diagnostic isolation', async () => {
    const { input } = await prepared();
    const saved = Object.fromEntries(['buildHumanPlaytestPool', 'buildEttinPersonAccessExtension',
      'buildEttinContextualAccessExtension', 'buildEntityTypeAccessExtension'].map(key => [key, h[key]]));
    let scoredInput;
    try {
      h.buildHumanPlaytestPool = async () => ({ ...input.lexicalPool, candidates: input.ordinary });
      h.buildEttinPersonAccessExtension = () => [];
      h.buildEttinContextualAccessExtension = () => ({ candidates: [] });
      h.buildEntityTypeAccessExtension = () => ({ candidates: [], matchedTypes: new Map() });
      h.GGGEttinProvider.scoreCandidates = async (snapshot, candidates) => {
        scoredInput = plain(candidates);
        return { candidates: candidates.map((c, i) => ({ ...c, rank: i + 1, score: -i, probability: 1 / candidates.length })) };
      };
      const result = await h.buildEttinPilotPool(input.targetSlot);
      assert.equal(result.status, 'ready');
      assert.deepEqual(scoredInput.slice(0, -1).map(c => c.word), plain(input.ordinary.map(c => c.submissionSurface)));
      assert.equal(scoredInput.at(-1).word, 'Susan');
      assert.equal(scoredInput.filter(c => c.normalized === 'susan').length, 1);
      assert.equal(result.pool.adjacentQaNomination.reason, 'admitted');
      assert(events.some(event => event.type === 'ettin-adjacent-qa-nomination' && event.reason === 'admitted'));
      for (const candidate of scoredInput) assert(!Object.keys(candidate).some(key => /adjacentQa|sourceMention|whRequestedRole/.test(key)));
    } finally { Object.assign(h, saved); }
  });
  await check('board changes across asynchronous preparation and scoring discard the pool', async () => {
    for (const phase of ['preparation', 'scoring']) {
      const { input } = await prepared();
      const original = h.buildHumanPlaytestPool;
      const changeBoard = () => { h.groups[0].querySelectorAll()[0].textContent = 'X'; };
      try {
        h.buildHumanPlaytestPool = async () => { if (phase === 'preparation') changeBoard(); return input.lexicalPool; };
        h.GGGEttinProvider.scoreCandidates = async (snapshot, candidates) => {
          if (phase === 'scoring') changeBoard();
          return { candidates: candidates.map((c, i) => ({ ...c, rank: i + 1, score: -i, probability: 1 / candidates.length })) };
        };
        const result = await h.buildEttinPilotPool(input.targetSlot);
        assert.equal(result.status, 'stale', phase);
        assert.equal(events.at(-1).reason, 'stale-board', phase);
      } finally { h.buildHumanPlaytestPool = original; }
    }
  });
  await check('opportunity expiry during scoring discards evidence admission', async () => {
    const { input } = await prepared();
    const ownership = vm.runInContext('({ ticket: HUMAN_PLAYTEST_TURN.generation, gameId: ETTIN_ATTENTION.gameId })', h);
    ownership.boardKey = input.boardKey;
    assert(h.currentEttinOpportunity(ownership));
    h.GGGEttinProvider.scoreCandidates = async (snapshot, candidates) => {
      vm.runInContext('HUMAN_PLAYTEST_TURN.generation++', h);
      return { candidates: candidates.map((c, i) => ({ ...c, rank: i + 1, score: -i, probability: 1 / candidates.length })) };
    };
    assert.equal((await h.buildEttinPilotPool(input.targetSlot, null, ownership)).status, 'stale');
    assert.equal(events.at(-1).reason, 'stale-opportunity');
  });
  await check('existing Stage 3 pronoun rule remains separate with consistent roles', () => {
    const input = setup(['Who', 'does', hidden('_____'), 'love?', 'She', 'loves', 'Tom.'], 2);
    const construction = h.buildEttinConstructionContext(input.state, e, h.vault4Dictionary.dictionary);
    const old = h.discoursePersonCompatibilityContextForTarget(input.state, input.targetSlot, construction, e);
    const evidence = h.recognizeAdjacentQaNomination(input.state);
    assert.equal(old.active, true);
    assert.equal(old.role, 'subject');
    assert.equal(old.predicate, 'love');
    assert.equal(evidence.targetRole, old.role);
    assert.equal(evidence.reason, 'reference-resolution-required');
  });
  console.log(`${passed} passed; ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });
