const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { fixture } = require('./human-playtest-fixture.cjs');
const { root } = require('./ai-harness.cjs');
const plain = value => JSON.parse(JSON.stringify(value));
const version = 'adjacent-water-freezing-nomination-v1';

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
  const hidden = (pattern = '___.', capital = false) => ({ pattern, capital });
  const tokens = (container = 'cup') => `The water in the ${container} has just frozen. The ${container} now contains`.split(' ').concat([hidden()]);
  function input(words = tokens(), index = words.length - 1) {
    const targetSlot = board(words).find(slot => slot.slotIndex === index) ||
      { slotIndex: index, group: h.groups[index], length: h.groups[index].querySelectorAll().length };
    // The shared fixture omits leading punctuation; retain the rendered public span here.
    words.forEach((token, slot) => {
      const prefix = (typeof token === 'string' ? token : token.pattern).match(/^[^A-Za-z_]+/)?.[0];
      if (prefix) h.groups[slot].children.unshift({ textContent: prefix, classList: { contains: c => c === 'punct' } });
    });
    const state = h.getHumanPlaytestPublicState(targetSlot);
    return { state, targetSlot, snapshot: h.buildEttinPublicSnapshot(state), boardKey: e.boardKey(state),
      opportunity: null, ordinaryCap: 112, ordinary: [] };
  }
  const recognize = x => h.recognizeAdjacentWaterFreezingNomination(x.state);
  const replace = (index, value) => { const words = tokens(); words[index] = value; return words; };
  const text = sentence => sentence.split(' ').map(word => word.includes('_') ? hidden(word) : word);
  for (const container of ['cup', 'bowl', 'bucket', 'bottle', 'tray']) {
    await check(`recent freezing in ${container}`, () => {
      const x = input(tokens(container)), evidence = recognize(x);
      assert.equal(evidence.reason, 'role-aligned'); assert.equal(evidence.nominee, 'ice');
      assert.equal(evidence.mechanismVersion, version); assert.equal(evidence.relation, 'water-freezing-produces-ice');
      assert.deepEqual(plain(evidence.sourceSpan), { start: 0, end: 7 });
      assert.deepEqual(plain(evidence.targetSpan), { start: 8, end: 12 });
      assert.equal(evidence.materialSlot, 1); assert.equal(evidence.material, 'water');
      assert.equal(evidence.container, container); assert.equal(evidence.sourceContainerSlot, 4);
      assert.equal(evidence.targetContainerSlot, 9); assert.equal(evidence.targetSlot, 12);
      assert.deepEqual(plain(evidence.eventSlots), [5, 6, 7]);
      assert.equal(evidence.completedEvent, 'has just frozen'); assert.equal(evidence.temporalMarker, 'just');
      assert.equal(evidence.targetTemporalMarker, 'now'); assert.equal(evidence.targetPattern, '___');
      assert(e.matchesToken('ice', x.state.slots[12])); assert(e.matchesCasePattern('ice', x.state.slots[12]));
      for (const name of ['Qa', 'Declarative', 'ItSubject', 'Ownership', 'DialogueGrounding']) {
        assert.notEqual(h[`recognizeAdjacent${name}Nomination`](x.state).reason, 'role-aligned');
      }
    });
  }
  const negatives = [
    ['not frozen', replace(6, 'not')], ['almost frozen', replace(6, 'almost')],
    ['may soon freeze', text('The water in the cup may soon freeze. The cup now contains ___.')],
    ['very cold', text('The water in the cup is very cold. The cup now contains ___.')],
    ['thawed', replace(7, 'thawed.')], ['juice', replace(1, 'juice')],
    ['around', replace(2, 'around')], ['container mismatch', replace(9, 'bowl')],
    ['previously contained', text('The water in the cup has just frozen. The cup previously contained ___.')],
    ['It', text('The water in the cup has just frozen. It now contains ___.')],
    ['contains no', text('The water in the cup has just frozen. The cup now contains no ___.')],
    ['intervening sentence', text('The water in the cup has just frozen. Birds sing. The cup now contains ___.')],
    ['preceding sentence', ['Birds', 'sing.', ...tokens()]],
    ['following sentence', [...tokens(), 'Birds', 'sing.'], 12],
    ['hypothetical', text('If the water in the cup has just frozen. The cup now contains ___.')],
    ['dream context', ['This', 'is', 'a', 'dream.', ...tokens()]],
    ['quotation', replace(0, '"The')], ['closing quotation', replace(7, 'frozen."')],
    ['incompatible letters', replace(12, hidden('a__.'))], ['wrong length', replace(12, hidden('____.'))],
    ['uppercase target', replace(12, hidden('___.', true))], ['solved target', replace(12, 'ice.')],
    ['tank', tokens('tank')], ['glass', tokens('glass')],
    ['coordination', text('The water in the cup and bowl has just frozen. The cup now contains ___.')],
    ['modifier', text('The cold water in the cup has just frozen. The cup now contains ___.')],
    ['extra clause', text('The water in the cup has just frozen, but it melted. The cup now contains ___.')],
    ['internal punctuation', replace(4, "c'up")], ['comma', replace(4, 'cup,')],
    ['question boundary', replace(7, 'frozen?')], ['exclamation target', replace(12, hidden('___!'))],
    ['no period', replace(7, 'frozen')], ['double period', replace(7, 'frozen..')],
    ['approximate event', replace(6, 'recently')], ['paraphrased containment', replace(11, 'holds')],
    ['alternate tense', replace(5, 'had')], ['alternate event', replace(7, 'freezing.')],
    ['source capitalization', replace(1, 'Water')], ['target clause capitalization', replace(8, 'the')],
    ['container capitalization', tokens('Cup')],
  ];
  for (let index = 0; index < 12; index++) {
    const token = tokens()[index];
    negatives.push([`hidden licensing slot ${index}`, replace(index, hidden(token.replace(/[A-Za-z]/g, '_'), index === 0 || index === 8))]);
  }
  for (const [name, words, index] of negatives) await check(`abstains: ${name}`, () => {
    const evidence = recognize(input(words, index));
    assert.notEqual(evidence.reason, 'role-aligned'); assert.equal(evidence.nominee, undefined);
  });
  await check('compatible partial target', () => {
    for (const pattern of ['i__.', '_c_.', '__e.', 'i_e.']) {
      assert.equal(recognize(input(replace(12, hidden(pattern)))).nominee, 'ice');
    }
  });
  await check('target must be slot 12', () => {
    const words = tokens(); words[12] = 'ice.'; words[1] = hidden('_____');
    assert.equal(recognize(input(words, 1)).reason, 'unsupported-board-shape');
  });
  await check('public board unavailable', () => {
    const x = input(), saved = h.GGGPublicBoard;
    try { h.GGGPublicBoard = undefined; assert.equal(recognize(x).reason, 'public-board-unavailable'); }
    finally { h.GGGPublicBoard = saved; }
  });
  for (const word of ['cup', 'water', 'ice']) {
    for (const [name, mutate] of [
      ['missing noun evidence', a => ({ ...a, primaryNoun: false })],
      ['plural', a => ({ ...a, pluralNoun: true })],
      ['pronoun reading', a => ({ ...a, roles: [...a.roles, 'pronoun'] })],
    ]) await check(`lexical refusal: ${word} ${name}`, () => {
      const original = h.getHumanPlaytestAnalysis;
      h.getHumanPlaytestAnalysis = surface => surface === word ? mutate(original(surface)) : original(surface);
      try { assert.equal(recognize(input()).nominee, undefined); }
      finally { h.getHumanPlaytestAnalysis = original; }
    });
  }
  await check('hidden-answer independence through preparation and admission with zero hidden reads', async () => {
    const x = input(); let reads = 0;
    const originalActual = h.getActualWord;
    h.getActualWord = () => { throw Error('Forbidden answer lookup'); };
    const privateNames = ['vault2ByPuzzle', 'vault3ByPuzzle', 'vault5ByPuzzle', 'puzzleList', 'currentPuzzleText'];
    const privateDescriptors = privateNames.map(name => Object.getOwnPropertyDescriptor(h, name));
    for (const name of privateNames) Object.defineProperty(h, name, { configurable: true,
      get() { throw Error(`Forbidden private source: ${name}`); } });
    const observe = async answer => {
      h.groups[12].querySelectorAll().forEach((block, index) => {
        const dataset = { revealed: 'false', trailing: index === 2 ? '.' : '' };
        Object.defineProperty(dataset, 'letter', { get() { reads++; return answer[index]; } });
        block.dataset = dataset;
      });
      const state = h.getHumanPlaytestPublicState(x.targetSlot);
      const lexicalPool = await h.buildHumanPlaytestPool(x.targetSlot, [], state, true);
      const evidence = h.recognizeAdjacentWaterFreezingNomination(state);
      const admission = h.admitCrossSentenceNomination({ ...x, state, lexicalPool,
        ordinary: lexicalPool.candidates, evidence, mechanismVersion: version });
      return { state, evidence, admission };
    };
    try {
      const first = await observe('ice'), second = await observe('air');
      assert.deepEqual(plain(first), plain(second)); assert.equal(first.evidence.nominee, 'ice');
      assert.equal(first.admission.diagnostic.reason, 'admitted'); assert.equal(reads, 0);
    } finally {
      h.getActualWord = originalActual;
      privateNames.forEach((name, index) => {
        if (privateDescriptors[index]) Object.defineProperty(h, name, privateDescriptors[index]);
        else delete h[name];
      });
    }
  });
  async function prepared(words = tokens()) {
    const x = input(words);
    x.lexicalPool = await h.buildHumanPlaytestPool(x.targetSlot, [], x.state, true);
    const record = x.lexicalPool.contextualAccess.classData.enriched.find(c => c.normalized === 'ice');
    assert(record); assert(x.lexicalPool.hardCandidates.some(c => c.normalized === 'ice'));
    x.ordinary = x.lexicalPool.candidates.slice();
    return { x, record };
  }
  const admit = (x, evidence = recognize(x)) => h.admitCrossSentenceNomination({ ...x, evidence, mechanismVersion: version });
  await check('new admission appends exactly one prepared record without evidence metadata', async () => {
    const { x, record } = await prepared(), before = plain(x), result = admit(x);
    assert.equal(result.diagnostic.reason, 'admitted'); assert.equal(result.diagnostic.evidenceAdditionCount, 1);
    assert.equal(result.diagnostic.finalCandidateCount, x.ordinary.length + 1);
    assert.deepEqual(plain(result.candidates.slice(0, -1)), before.ordinary);
    for (const key of Object.keys(record)) assert.deepEqual(plain(result.candidates.at(-1)[key]), plain(record[key]), key);
    assert(!Object.keys(result.candidates.at(-1)).some(key => /waterFreezing|relation|container|temporalMarker|completedEvent/.test(key)));
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
    ['public rejection', x => { x.state.rejectedWordsBySlot[12] = ['ice']; }, 'public-rejection'],
    ['nonfinite allowance', x => { x.evidenceBudget = NaN; }, 'evidence-capacity-blocked'],
    ['invalid used allowance', x => { x.evidenceUsed = -1; }, 'evidence-capacity-blocked'],
    ['disabled allowance', x => { x.evidenceBudget = 0; }, 'evidence-capacity-blocked'],
    ['exhausted allowance', x => { x.evidenceUsed = 1; }, 'evidence-capacity-blocked'],
    ['unsafe submission', x => { x.targetSlot.length = 4; }, 'unsafe-submission'],
    ['ordinary overflow', x => { x.ordinaryCap = 1; }, 'evidence-capacity-blocked'],
    ['stale board', x => { x.boardKey = 'old'; }, 'stale-board'],
    ['stale opportunity', x => { x.opportunity = { ticket: -1, gameId: -1, boardKey: x.boardKey }; }, 'stale-opportunity'],
    ['hard length', x => { x.state.slots[12].letters.pop(); }, 'target-length'],
    ['hard letters', x => { x.state.slots[12].letters[0].visible = 'd'; }, 'revealed-letter-mismatch'],
    ['hard case', x => { x.state.slots[12].letters[0].capital = true; }, 'case-pattern-mismatch'],
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
    const { x } = await prepared(); h.vault4Dictionary.absoluteBlockedWords.add('ice');
    try { const result = admit(x); assert.equal(result.diagnostic.reason, 'absolute-block');
      assert.equal(result.diagnostic.evidenceAdditionCount, 0); }
    finally { h.vault4Dictionary.absoluteBlockedWords.delete('ice'); }
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
    assert.equal(result.pool.adjacentWaterFreezingNomination.reason, 'admitted');
    assert.equal(scored.at(-1).word, 'ice');
    for (const key of Object.keys(record)) assert.deepEqual(scored.at(-1)[key], plain(record[key]), key);
    assert.equal(result.pool.candidates.find(c => c.normalized === 'ice').rank, scored.length);
    assert(!Object.keys(scored.at(-1)).some(key => /waterFreezing|relation|container|temporalMarker|completedEvent/.test(key)));
    assert.equal(result.pool.candidateCap, result.pool.ordinaryCandidateCap + 1);
    assert(events.some(e => e.type === 'ettin-adjacent-water-freezing-recognition' && e.reason === 'role-aligned'));
    assert(events.some(e => e.type === 'ettin-adjacent-water-freezing-nomination' && e.reason === 'admitted'));
  });
  for (const conflict of [false, true]) await check(conflict ? 'provider conflict adds nothing' : 'same nominee deduplicates with provenance', async () => {
    const { x } = await prepared(), evidence = recognize(x);
    const { result } = await integrated(x, { ...evidence, nominee: conflict ? 'air' : 'ice', mechanismVersion: 'adjacent-qa-nomination-v1' });
    const d = result.pool.crossSentenceNomination;
    assert.equal(d.reason, conflict ? 'conflicting-provider-nominations' : 'admitted');
    assert.equal(d.evidenceAdditionCount, conflict ? 0 : 1);
    assert.deepEqual(Array.from(d.contributingProviders), ['adjacent-qa-nomination-v1', version]);
    assert.equal(result.pool.candidates.filter(c => c.normalized === 'ice').length, conflict ? 0 : 1);
    assert.equal(d.providerNominees.find(p => p.provider === version).waterFreezing.relation, 'water-freezing-produces-ice');
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
    const { x } = await prepared(replace(6, 'not')); await integrated(x);
    assert(events.some(e => e.type === 'ettin-adjacent-water-freezing-recognition' &&
      e.reason === 'unsupported-fixed-token' && e.nominee === undefined));
  });
  await check('board changes during scoring discard the admitted result', async () => {
    const { x } = await prepared();
    const { result } = await integrated(x, null, () => board(replace(12, hidden('i__.'))));
    assert.equal(result.status, 'stale');
    assert(events.some(e => e.type === 'ettin-adjacent-water-freezing-nomination' && e.discarded));
  });
  await check('diagnostic provenance cannot change Stage 3 distribution or selection', async () => {
    vm.runInContext(source.slice(source.indexOf('  const ETTIN_CONTEXT_PRIOR_VERSION'),
      source.indexOf('  function evaluateEntitySlotCompatibility')), h);
    const { x, record } = await prepared();
    const candidates = [...x.ordinary, record].map((c, i, all) => ({ ...c, word: c.submissionSurface,
      rank: i + 1, score: -i, probability: 1 / all.length }));
    const publicBoard = h.GGGPublicBoard.snapshot(x.state);
    const pool = { predictionMode: 'ettin-pilot', candidates, targetSlot: x.targetSlot, targetLength: 3,
      publicBoardKey: x.boardKey, snapshot: x.snapshot, attentionPlan: { boardKey: x.boardKey,
        considered: [{ slotIndex: 12, band: 'WEAK' }], publicBoard: { slots: publicBoard.slots } } };
    const one = h.buildEttinStage3Distribution({ ...pool, adjacentWaterFreezingNomination: recognize(x) });
    const two = h.buildEttinStage3Distribution({ ...pool, adjacentWaterFreezingNomination: { reason: 'unsupported-fixed-token' } });
    assert.equal(one.ok, true, one.reason); assert.deepEqual(plain(one), plain(two));
    assert.equal(h.chooseEttinStage3Candidate({ ...pool, stage3Distribution: one }, () => 0.5).candidate.word,
      h.chooseEttinStage3Candidate({ ...pool, stage3Distribution: two }, () => 0.5).candidate.word);
  });
  console.log(`${passed} passed; ${failed} failed`); process.exitCode = failed ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });
