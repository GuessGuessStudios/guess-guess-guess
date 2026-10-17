const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { fixture } = require('./human-playtest-fixture.cjs');
const { root } = require('./ai-harness.cjs');

(async () => {
  const { h, e, board, turns } = await fixture();
  const source = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
  vm.runInContext(source.slice(source.indexOf('  const ENTITY_TYPE_ORDER'), source.indexOf('  function candidateEntityTypes')), h);
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
  const hidden = (pattern = '_____', capital = true) => ({ pattern, capital });
  function state(tokens, targetIndex) {
    const target = board(tokens).find(slot => slot.slotIndex === targetIndex);
    return h.getHumanPlaytestPublicState(target);
  }
  const positives = [
    ['Maria buys bread. Maria buys blank.', ['Maria', 'buys', 'bread.', 'Maria', 'buys', hidden('_____.')], 5, 'bread'],
    ['reverse direction', ['Maria', 'buys', hidden('_____.'), 'Maria', 'buys', 'bread.'], 2, 'bread'],
    ['Nora carries water', ['Nora', 'carries', 'water.', 'Nora', 'carries', hidden('_____.')], 5, 'water'],
    ['Clara collects stamps', ['Clara', 'collects', 'stamps.', 'Clara', 'collects', hidden('_____.')], 5, 'stamps'],
    ['plural base predicate', ['Robots', 'carry', 'water.', 'Robots', 'carry', hidden('_____.')], 5, 'water'],
  ];
  let passed = 0, failed = 0;
  async function check(name, run) {
    try { await run(); passed++; console.log('PASS', name); }
    catch (error) { failed++; console.error('FAIL', name, error.stack || error.message); }
  }
  for (const [name, tokens, index, nominee] of positives) {
    try {
      const result = h.recognizeAdjacentDeclarativeNomination(state(tokens, index));
      assert.equal(result.reason, 'role-aligned');
      assert.equal(result.nominee, nominee);
      assert.equal(result.targetRole, 'direct-object');
      assert.equal(result.sourceRole, 'direct-object');
      assert(result.predicateLemma);
      passed++; console.log('PASS', name);
    } catch (error) { failed++; console.error('FAIL', name, error.message); }
  }
  const negatives = [
    ['different subject', ['Maria', 'buys', 'bread.', 'Nora', 'buys', hidden('_____.')], 5],
    ['hidden subject', [hidden('_____'), 'buys', 'bread.', 'Maria', 'buys', hidden('_____.')], 5],
    ['hidden predicate', ['Maria', hidden('_____'), 'bread.', 'Maria', 'buys', hidden('_____.')], 5],
    ['pronoun', ['She', 'buys', 'bread.', 'She', 'buys', hidden('_____.')], 5],
    ['past tense', ['Maria', 'bought', 'bread.', 'Maria', 'bought', hidden('_____.')], 5],
    ['progressive', ['Maria', 'is', 'buying', 'bread.', 'Maria', 'is', 'buying', hidden('_____')], 7],
    ['modal', ['Maria', 'can', 'buy', 'bread.', 'Maria', 'can', 'buy', hidden('_____')], 7],
    ['negation', ['Maria', 'does', 'not', 'buy', 'bread.', 'Maria', 'does', 'not', 'buy', hidden('_____')], 9],
    ['nonadjacent', ['Maria', 'buys', 'bread.', 'Birds', 'sing.', 'Maria', 'buys', hidden('_____.')], 7],
    ['agreement mismatch', ['Maria', 'buys', 'bread.', 'Maria', 'buy', hidden('_____.')], 5],
    ['multiple predicates', ['Maria', 'buys', 'and', 'eats', 'bread.', 'Maria', 'buys', hidden('_____.')], 7],
    ['passive', ['Bread', 'is', 'bought', 'by', 'Maria.', 'Bread', 'is', 'bought', hidden('_____.')], 8],
    ['perfect', ['Maria', 'has', 'bought', 'bread.', 'Maria', 'has', 'bought', hidden('_____')], 7],
    ['incomplete public source', ['Maria', 'buys', hidden('_____.'), 'Maria', 'buys', hidden('_____.')], 5],
    ['coordinated object', ['Maria', 'buys', 'bread', 'and', 'milk.', 'Maria', 'buys', hidden('_____.')], 7],
    ['synonym rather than shared lemma', ['Maria', 'purchases', 'bread.', 'Maria', 'buys', hidden('_____.')], 5],
    ['Q/A target belongs to mechanism one', ['What', 'does', 'Maria', 'buy?', 'Maria', 'buys', hidden('_____.')], 6],
  ];
  for (const [name, tokens, index] of negatives) {
    try {
      const result = h.recognizeAdjacentDeclarativeNomination(state(tokens, index));
      assert.notEqual(result.reason, 'role-aligned');
      assert.equal(result.nominee, undefined);
      passed++; console.log('PASS', name);
    } catch (error) { failed++; console.error('FAIL', name, error.message); }
  }
  const declarativeTokens = ['Maria', 'visits', 'Tokyo.', 'Maria', 'visits', hidden('_____.')];
  async function prepared(tokens = declarativeTokens, targetIndex = 5) {
    const targetSlot = board(tokens).find(slot => slot.slotIndex === targetIndex);
    const publicState = h.getHumanPlaytestPublicState(targetSlot);
    const input = { state: publicState, targetSlot, snapshot: h.buildEttinPublicSnapshot(publicState),
      boardKey: e.boardKey(publicState), opportunity: null, ordinaryCap: 112, ordinary: [] };
    input.lexicalPool = await h.buildHumanPlaytestPool(targetSlot, [], publicState, true);
    return input;
  }
  function admit(input) { return h.admitAdjacentDeclarativeNomination(input); }
  await check('authorized declarative nominee: exactly one append with candidate metadata preserved', async () => {
    const input = await prepared();
    const record = input.lexicalPool.contextualAccess.classData.enriched.find(c => c.normalized === 'tokyo');
    assert(record && input.lexicalPool.hardCandidates.some(c => c.normalized === 'tokyo'));
    input.ordinary = input.lexicalPool.candidates.filter(c => c.normalized !== 'tokyo').slice(0, 4);
    const order = input.ordinary.map(c => c.word), before = JSON.stringify(input.ordinary);
    const result = admit(input);
    assert.equal(result.diagnostic.reason, 'admitted');
    assert.equal(result.diagnostic.mechanismVersion, 'adjacent-declarative-nomination-v1');
    assert.equal(result.diagnostic.evidenceAdditionCount, 1);
    assert.deepEqual(result.candidates.slice(0, -1).map(c => c.word), order);
    assert.equal(result.candidates.at(-1).submissionSurface, 'Tokyo');
    for (const key of Object.keys(record)) assert.deepEqual(JSON.parse(JSON.stringify(result.candidates.at(-1)[key])), JSON.parse(JSON.stringify(record[key])), key);
    assert.equal(JSON.stringify(input.ordinary), before);
    assert(!Object.keys(result.candidates.at(-1)).some(key => /adjacent|predicateLemma|subjectComparison/.test(key)));
  });
  await check('already present: no movement, duplication, or capacity use', async () => {
    const input = await prepared();
    const record = input.lexicalPool.contextualAccess.classData.enriched.find(c => c.normalized === 'tokyo');
    input.ordinary = [{ word: 'first' }, record, { word: 'last' }]; input.evidenceBudget = 0;
    const before = JSON.stringify(input.ordinary), result = admit(input);
    assert.equal(result.diagnostic.reason, 'already-present');
    assert.equal(result.diagnostic.evidenceAdditionCount, 0);
    assert.equal(JSON.stringify(result.candidates), before);
  });
  const admissionControls = [
    ['authorization failure', x => { x.lexicalPool.hardCandidates = []; x.lexicalPool.universe = []; }, 'no-authorized-candidate-record'],
    ['wrong length', x => { x.state.slots[5].letters.pop(); }, 'target-length'],
    ['revealed pattern mismatch', x => { x.state.slots[5].letters[1].visible = 'x'; }, 'revealed-letter-mismatch'],
    ['case mismatch', x => { x.state.slots[5].letters[0].capital = false; }, 'case-pattern-mismatch'],
    ['public rejection', x => { x.state.rejectedWordsBySlot[5] = ['tokyo']; }, 'public-rejection'],
    ['disabled allowance', x => { x.evidenceBudget = 0; }, 'evidence-capacity-blocked'],
    ['exhausted allowance', x => { x.evidenceUsed = 1; }, 'evidence-capacity-blocked'],
    ['stale board', x => { x.boardKey = 'stale'; }, 'stale-board'],
    ['stale opportunity', x => { x.opportunity = { ticket: -1, gameId: -1, boardKey: x.boardKey }; }, 'stale-opportunity'],
  ];
  for (const [name, change, reason] of admissionControls) await check(name, async () => {
    const input = await prepared(); change(input);
    if (name !== 'stale board') input.boardKey = e.boardKey(input.state);
    input.snapshot = h.buildEttinPublicSnapshot(input.state);
    const result = admit(input);
    assert.equal(result.diagnostic.reason, reason);
    assert.equal(result.diagnostic.evidenceAdditionCount, 0);
    assert.deepEqual(JSON.parse(JSON.stringify(result.candidates)), JSON.parse(JSON.stringify(input.ordinary)));
  });
  await check('proper-name nominee is recognized only with existing authorization', async () => {
    const input = await prepared(['Maria', 'visits', 'Tokyo.', 'Maria', 'visits', hidden('_____.')]);
    assert.equal(h.recognizeAdjacentDeclarativeNomination(input.state).nominee, 'Tokyo');
  });
  await check('qualifying pair within a longer puzzle and revealed letters remain public evidence', () => {
    const input = state(['Birds', 'sing.', 'Maria', 'buys', 'bread.', 'Maria', 'buys', hidden('b____.')], 7);
    assert.equal(h.recognizeAdjacentDeclarativeNomination(input).nominee, 'bread');
  });
  await check('extra clause material, coordination, PP and determiner structures abstain', () => {
    const cases = [
      [['Maria', 'buys', 'bread', 'today.', 'Maria', 'buys', hidden('_____.')], 6],
      [['Maria', 'buys', 'bread', 'and', 'milk.', 'Maria', 'buys', hidden('_____.')], 7],
      [['Maria', 'buys', 'bread', 'in', 'Tokyo.', 'Maria', 'buys', hidden('_____.')], 7],
      [['Maria', 'buys', 'the', 'bread.', 'Maria', 'buys', hidden('_____.')], 6],
    ];
    for (const [tokens, index] of cases) assert.notEqual(h.recognizeAdjacentDeclarativeNomination(state(tokens, index)).reason, 'role-aligned');
  });
  await check('multiple supported lexical bases for one predicate reading abstain', () => {
    const original = h.getHumanPlaytestAnalysis;
    h.getHumanPlaytestAnalysis = word => {
      const result = original(word);
      return /^(buy|buys)$/.test(word.toLowerCase()) ? { ...result, lemmas: [...result.lemmas, 'visit'] } : result;
    };
    try { assert.notEqual(h.recognizeAdjacentDeclarativeNomination(state(
      ['Maria', 'buys', 'bread.', 'Maria', 'buys', hidden('_____.')], 5)).reason, 'role-aligned'); }
    finally { h.getHumanPlaytestAnalysis = original; }
  });
  await check('shared global evidence allowance and duplicate provider nominee', async () => {
    const input = await prepared();
    const candidate = h.recognizeAdjacentDeclarativeNomination(input.state);
    const saved = [h.recognizeAdjacentQaNomination, h.recognizeAdjacentDeclarativeNomination];
    try {
      h.recognizeAdjacentQaNomination = () => ({ ...candidate, mechanismVersion: 'adjacent-qa-nomination-v1' });
      h.recognizeAdjacentDeclarativeNomination = () => candidate;
      const ordinary = input.lexicalPool.candidates.filter(c => c.normalized !== 'tokyo').slice(0, 4);
      h.buildHumanPlaytestPool = async () => ({ ...input.lexicalPool, candidates: ordinary });
      h.buildEttinPersonAccessExtension = () => [];
      h.buildEttinContextualAccessExtension = () => ({ candidates: [] });
      h.buildEntityTypeAccessExtension = () => ({ candidates: [], matchedTypes: new Map() });
      let scoredInput;
      h.GGGEttinProvider.scoreCandidates = async (snapshot, candidates) => {
        scoredInput = JSON.parse(JSON.stringify(candidates));
        return { candidates: candidates.map((c, i) => ({ ...c, rank: i + 1, score: -i, probability: 1 / candidates.length })) };
      };
      const result = await h.buildEttinPilotPool(input.targetSlot);
      assert.equal(result.status, 'ready');
      const d = result.pool.adjacentQaNomination;
      assert.equal(d.reason, 'admitted');
      assert.equal(d.evidenceAdditionCount, 1);
      assert.deepEqual(Array.from(d.contributingProviders), ['adjacent-qa-nomination-v1', 'adjacent-declarative-nomination-v1']);
      assert.equal(result.pool.candidates.filter(c => c.normalized === 'tokyo').length, 1);
      const rankedNominee = result.pool.candidates.find(c => c.normalized === 'tokyo');
      assert.equal(rankedNominee.rank, result.pool.candidates.length);
      assert.equal(rankedNominee.score, -(result.pool.candidates.length - 1), 'nominee uses ordinary scorer output');
      assert(result.pool.candidates.length <= ordinary.length + 1, 'shared providers consume at most one evidence slot');
      assert.deepEqual(scoredInput.slice(0, -1).map(c => c.word), Array.from(ordinary, c => c.submissionSurface));
      assert.equal(scoredInput.at(-1).word, 'Tokyo');
      assert(!Object.keys(scoredInput.at(-1)).some(key => /adjacent|predicateLemma|contributingProvider/.test(key)));
      for (let i = 0; i < ordinary.length; i++) {
        for (const key of ['supportTier', 'proposalReasons', 'frequency', 'properNounBankCategories']) {
          assert.equal(JSON.stringify(scoredInput[i][key]), JSON.stringify(ordinary[i][key]), `${key} stays unchanged at ${i}`);
        }
      }
      assert(events.some(event => event.type === 'ettin-adjacent-qa-nomination' && event.contributingProviders?.length === 2));
    } finally { h.recognizeAdjacentQaNomination = saved[0]; h.recognizeAdjacentDeclarativeNomination = saved[1]; }
  });
  await check('conflicting Q/A and declarative nominees add nothing', async () => {
    const input = await prepared();
    const declarative = h.recognizeAdjacentDeclarativeNomination(input.state);
    const ordinary = input.lexicalPool.candidates.filter(c => !['tokyo', 'kyoto'].includes(c.normalized)).slice(0, 4);
    const qa = { ...declarative, nominee: 'Kyoto', mechanismVersion: 'adjacent-qa-nomination-v1' };
    const saved = [h.recognizeAdjacentQaNomination, h.recognizeAdjacentDeclarativeNomination];
    try {
      h.recognizeAdjacentQaNomination = () => qa;
      h.recognizeAdjacentDeclarativeNomination = () => declarative;
      h.buildHumanPlaytestPool = async () => ({ ...input.lexicalPool, candidates: ordinary });
      h.buildEttinPersonAccessExtension = () => [];
      h.buildEttinContextualAccessExtension = () => ({ candidates: [] });
      h.buildEntityTypeAccessExtension = () => ({ candidates: [], matchedTypes: new Map() });
      h.GGGEttinProvider.scoreCandidates = async (snapshot, candidates) => ({ candidates: candidates.map((c, i) => ({ ...c, rank: i + 1, score: -i, probability: 1 / candidates.length })) });
      const result = await h.buildEttinPilotPool(input.targetSlot);
      assert.equal(result.status, 'ready');
      assert.equal(result.pool.adjacentQaNomination.reason, 'conflicting-provider-nominations');
      assert.deepEqual(Array.from(result.pool.adjacentQaNomination.contributingProviders),
        ['adjacent-qa-nomination-v1', 'adjacent-declarative-nomination-v1']);
      assert.equal(result.pool.adjacentQaNomination.evidenceAdditionCount, 0);
      assert.deepEqual(result.pool.candidates.map(c => c.word), ordinary.map(c => c.submissionSurface));
      assert(!result.pool.candidates.some(c => ['tokyo', 'kyoto'].includes(c.normalized)));
    } finally { h.recognizeAdjacentQaNomination = saved[0]; h.recognizeAdjacentDeclarativeNomination = saved[1]; }
  });
  try {
    const tokens = ['Maria', 'visits', 'Tokyo.', 'Maria', 'visits', hidden('_____.')];
    board(tokens);
    h.groups[5].querySelectorAll().forEach((block, i) => { block.dataset.letter = 'Tokyo'[i]; });
    const a = h.getHumanPlaytestPublicState({ slotIndex: 5 });
    h.groups[5].querySelectorAll().forEach((block, i) => { block.dataset.letter = 'Kyoto'[i]; });
    const b = h.getHumanPlaytestPublicState({ slotIndex: 5 });
    assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), 'public states are identical');
    assert.deepEqual(h.recognizeAdjacentDeclarativeNomination(a), h.recognizeAdjacentDeclarativeNomination(b));
    passed++; console.log('PASS hidden-answer independence');
  } catch (error) { failed++; console.error('FAIL hidden-answer independence', error.message); }
  console.log(`${passed} passed; ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });
