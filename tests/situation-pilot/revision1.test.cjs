const assert = require('node:assert/strict');
const setup = require('./fixture.cjs');

(async () => {
  const { h, e, p, rank, board } = await setup();
  const get = (r, word) => r.ranked.find(c => c.word === word);
  const words = r => r.band.map(c => c.word);
  const pass = async (name, fn) => { await fn(); console.log('PASS', name); };

  await pass('coordinator opportunity rises for coordinated noun phrases', async () => {
    p.reset();
    const r = await rank(['His', 'mother', '___', 'his', 'cat,', 'Percy,', 'love', 'him.'], 2);
    assert(r.situations.some(s => s.situationId === 'list/coordinated-noun-phrases' && s.matchState === 'SUPPORTED'));
    assert(p.opportunity(r).relativePriority > 0.7);
    assert.equal(words(r)[0], 'and');
  });

  for (const [name, tokens, index] of [
    ['her/father/dog', ['her', 'father', '___', 'her', 'dog.'], 2],
    ['my/brother/friend', ['my', 'brother', '___', 'my', 'friend.'], 2],
    ['Tom/Susan', ['Tom', '___', 'Susan.'], 1],
  ]) await pass(`coordinator variant ${name}`, async () => {
    const r = await rank(tokens, index);
    assert(r.situations.some(s => s.situationId === 'list/coordinated-noun-phrases' && s.matchState === 'SUPPORTED'));
    assert.equal(words(r)[0], 'and');
    assert(words(r).every(w => ['and', 'or', 'nor', 'but'].includes(w)));
  });

  await pass('ordinary predicate is not mistaken for noun coordination', async () => {
    const r = await rank(['Yesterday,', 'she', '___', 'him.'], 2);
    assert(!r.situations.some(s => s.situationId === 'list/coordinated-noun-phrases' && s.matchState === 'SUPPORTED'));
  });

  await pass('coordinator band removes unrelated noun and verb classes', async () => {
    const r = await rank(['His', 'mother', 'a_d', 'his', 'cat,', 'Percy,', 'love', 'him.'], 2);
    assert.equal(words(r).join(','), 'and');
    for (const word of ['all', 'get', 'aid', 'nod', 'read', 'mother']) assert(!words(r).includes(word));
  });

  await pass('possessive band preserves HIS/THE/A and removes incompatible ALL/verbs', async () => {
    const r = await rank(['his', 'mother', 'and', '___', 'cat.'], 3);
    assert(words(r).some(w => ['his', 'the', 'a'].includes(w)));
    for (const word of ['all', 'get', 'aid', 'nod', 'read', 'mother']) assert(!words(r).includes(word));
  });

  await pass('ALL number compatibility accepts plural heads and rejects singular count heads', async () => {
    const goodStudents = await rank(['___', 'students.'], 0);
    const goodPeople = await rank(['___', 'people.'], 0);
    const badMother = await rank(['___', 'mother.'], 0);
    assert(!get(goodStudents, 'all').hardConflict);
    assert(!get(goodPeople, 'all').hardConflict);
    assert(get(badMother, 'all').hardConflict);
    assert(!words(badMother).includes('all'));
  });

  await pass('declarative direct object excludes WHO', async () => {
    const r = await rank(['She', 'loves', '___.'], 2);
    assert(get(r, 'who').hardConflict);
    assert(!words(r).includes('who'));
    assert(words(r).some(w => ['him', 'her', 'you'].includes(w)));
  });

  await pass('WHO remains possible in interrogative and embedded clauses', async () => {
    const question = await rank([{ pattern: '___', capital: true }, 'loves', 'him?'], 0);
    assert(words(question).includes('who'));
    const embedded = await rank(['I', 'know', '___', 'loves', 'him.'], 2);
    assert(!embedded.situations.some(s => s.situationId === 'list/coordinated-noun-phrases' && s.matchState === 'SUPPORTED'));
    assert(words(embedded).includes('who'));
  });

  await pass('partial short contraction slot reattends after new public evidence', async () => {
    p.reset();
    const initial = await rank([{ pattern: "___'_", capital: true }, 'worry.'], 0);
    p.noteAttempt(initial); p.noteAttempt(initial); p.noteAttempt(initial);
    const fatigued = p.opportunity(initial).relativePriority;
    const improved = await rank([{ pattern: "___'t", capital: true }, 'worry.'], 0);
    assert(p.opportunity(improved).relativePriority > fatigued);
  });

  await pass('exhausted unsupported slot is not revisited', async () => {
    const [slot] = board([{ pattern: 'Qzxqzxqzx___', capital: true }]);
    const r = h.rankHumanPlaytestPool({ predictionMode: 'human-playtest', targetSlot: slot, targetLength: slot.length, vocabulary: [], candidates: [] });
    assert.equal(p.opportunity(r).relativePriority, 0);
  });

  await pass('rejection memory stays slot-specific and random choices stay in band', async () => {
    const slots = board(['His', 'mother', '___', 'his', 'cat.']);
    h.recordWrongAiGuessForSlot(slots[0].slotIndex, 'and');
    const r = h.rankHumanPlaytestPool({ predictionMode: 'human-playtest', targetSlot: slots[0], targetLength: 3, vocabulary: [], candidates: [] });
    assert(!words(r).includes('and'));
    const fresh = await rank(['His', 'mother', '___', 'his', 'cat.'], 2);
    for (let seed = 1; seed < 32; seed++) {
      const selected = p.choose(fresh, seed, 'character1', seed);
      assert(selected && words(fresh).includes(selected.word));
      assert(!['get', 'aid', 'nod', 'read', 'mother'].includes(selected.word));
    }
  });

  await pass('casual reductions are excluded without affecting standard contractions', async () => {
    const dictionary = h.vault4Dictionary.dictionary;
    assert(!['wanna', 'gonna', 'gotta'].includes(e.lexicalClass('wanna', dictionary, 6)));
    assert(!['wanna', 'gonna', 'gotta'].includes(e.lexicalClass('gonna', dictionary, 6)));
    assert(!['wanna', 'gonna', 'gotta'].includes(e.lexicalClass('gotta', dictionary, 6)));
    assert(e.lexicalClass("don't", dictionary, 6));
    assert(e.lexicalClass("can't", dictionary, 6));
    const r = await rank(['_____.'], 0);
    assert(!r.ranked.some(c => ['wanna', 'gonna', 'gotta'].includes(c.word)));
  });

  await pass('negative auxiliaries require a base-form complement', async () => {
    for (const [aux, good, bad] of [
      ["don't", 'worry', 'worried'],
      ["doesn't", 'know', 'knows'],
      ["didn't", 'go', 'went'],
      ["can't", 'swim', 'swimming'],
      ["shouldn't", 'leave', 'left'],
      ["wouldn't", 'work', 'worked'],
    ]) {
      const r = await rank([aux, '___ .'.replace(' ', '')], 1);
      assert(get(r, bad)?.hardConflict || !get(r, bad));
      assert(!get(r, good)?.hardConflict);
    }
    const intervening = await rank(["don't", '___', 'worry.'], 1);
    assert(!get(intervening, 'you')?.hardConflict);
  });

  await pass('sentence-initial auxiliary inversion follows public punctuation', async () => {
    const question = await rank(['___', 'his', 'mother', 'happy?'], 0);
    const declarative = await rank(['___', 'his', 'mother', 'happy.'], 0);
    const normal = await rank(['His', 'mother', '___', 'happy.'], 2);
    assert(!get(question, 'was').hardConflict);
    assert(get(declarative, 'was').hardConflict);
    assert(!get(normal, 'was').hardConflict);
  });

  await pass('direct-object valency excludes unlicensed prepositional verbs', async () => {
    const direct = await rank(['Nobody', '___', 'him.'], 1);
    const directSituation = direct.situations.find(s => s.situationId === 'verb/complement' && s.frame === 'DIRECT_TRANSITIVE');
    for (const verb of ['love', 'know', 'help']) {
      const c = { word: verb, analysis: e.enrichAnalysis({word: verb, roles: ['verb', 'baseVerb'], lemmas: [verb]}) };
      assert.equal(p.assess(c, directSituation).outcome, 'SUPPORTED');
    }
    for (const verb of ['care', 'look', 'wait', 'listen']) {
      const c = { word: verb, analysis: e.enrichAnalysis({word: verb, roles: ['verb', 'baseVerb'], lemmas: [verb]}) };
      assert.equal(p.assess(c, directSituation).outcome, 'CONTRADICTED');
    }
    for (const tokens of [['Nobody', '___', 'for', 'him.'], ['Nobody', '___', 'him', 'over.']]) {
      const r = await rank(tokens, 1);
      assert(r.situations.some(s => s.situationId === 'verb/complement'));
    }
    const unrelated = await rank(['As', 'for', 'him,', '___', 'smiles.'], 3);
    assert(!unrelated.situations.some(s => s.situationId === 'verb/licensed-preposition' && s.matchState === 'SUPPORTED'));
  });

  console.log('15 bounded revision-2 checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
