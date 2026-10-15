const assert = require('node:assert/strict');
const { harness, group } = require('./ai-harness.cjs');

function solved(groupNode) {
  groupNode.classList.add('revealed');
  groupNode.querySelectorAll().forEach(block => { block.dataset.revealed = 'true'; block.textContent = block.dataset.letter; });
}
function state(h, words, targetIndex, solvedIndexes = [], punctuation = '.') {
  h.groups = words.map((word, index) => group(word, index === words.length - 1 ? punctuation : ''));
  solvedIndexes.forEach(index => solved(h.groups[index]));
  const target = { group: h.groups[targetIndex], slotIndex: targetIndex, length: h.groups[targetIndex].querySelectorAll().length };
  const context = { ...h.getAiGrammarContext(target), targetLength: target.length };
  context.targetRoles = h.inferAiTargetRoles(target);
  return { target, context };
}
function scores(h, words, context) {
  return Object.fromEntries(words.map(word => [word, h.scoreAiCandidateForGrammar({ word, sources: [1] }, context)]));
}

(async () => {
  const h = await harness();
  let checks = 0;
  const check = (name, fn) => { fn(); checks++; console.log('PASS', name); };

  let s = state(h, ['The', 'cat', 'sat', 'on', 'the', 'mat'], 0);
  let r = scores(h, ['the', 'she', 'his', 'zoo', 'shy', 'why'], s.context);
  check('sentence initial favors article over weak starters', () => assert(r.the > r.she && r.she > r.shy && r.the > r.zoo));

  r = scores(h, ['the', 'her', 'our', 'who', 'why', 'how', 'sun', 'you'], s.context);
  check('declarative punctuation suppresses question words', () => {
    assert(r.the > r.who * 2);
    assert(r.the > r.why * 5);
    assert(r.the > r.how * 5);
  });

  s = state(h, ['Why', 'did', 'the', 'cat', 'sit'], 0, [1, 2, 3, 4], '?');
  r = scores(h, ['why', 'how', 'where', 'the', 'her', 'our'], s.context);
  check('question punctuation makes question words plausible', () => {
    assert(r.why > r.the && r.how > r.the && r.where > r.the);
  });

  s = state(h, ['The', 'cat', 'sat', 'on', 'the', 'mat'], 1, [0, 2, 3, 4, 5]);
  r = scores(h, ['cat', 'dog', 'pet', 'big', 'red', 'who', 'why', 'his'], s.context);
  check('non-adjacent visible clause context favors noun roles', () => {
    assert(s.context.previousWord === 'the');
    assert(r.cat > r.big && r.cat > r.who && r.cat > r.his);
    assert(s.context.visibleAfter.some(entry => entry.word === 'sat'));
  });

  s = state(h, ['The', 'cat', 'sat', 'on', 'the', 'mat'], 2, [0, 1, 4, 5]);
  r = scores(h, ['sat', 'ran', 'run', 'was', 'pet', 'rat', 'art', 'old', 'yet'], s.context);
  check('one-gap subject and complement context favors verbs', () => {
    assert(s.context.visibleAfter.some(entry => entry.word === 'the'));
    assert(r.sat > r.rat && r.sat > r.art && r.sat > r.yet);
  });

  const littleEvidence = state(h, ['The', 'cat', 'sat', 'on', 'the', 'mat'], 2).context.targetRoles;
  const subjectEvidence = state(h, ['The', 'cat', 'sat', 'on', 'the', 'mat'], 2, [1]).context.targetRoles;
  check('role confidence grows as visible evidence accumulates', () => {
    assert.equal(littleEvidence.confidence, 1);
    assert(subjectEvidence.confidence > littleEvidence.confidence);
  });

  s = state(h, ['The', 'cat', 'sat', 'on', 'the', 'mat'], 1, [0, 3, 4, 5]);
  r = scores(h, ['cat', 'dog', 'pet', 'big', 'red', 'she', 'his'], s.context);
  check('article context favors noun-like candidates while allowing adjectives', () => {
    assert(r.cat > r.big && r.dog > r.she && r.pet > r.his && r.big > r.his);
  });

  s = state(h, ['The', 'cat', 'sat', 'on', 'the', 'mat'], 2, [0, 1, 3, 4, 5]);
  r = scores(h, ['sat', 'ran', 'run', 'was', 'big', 'old', 'his', 'red'], s.context);
  check('subject context favors finite and auxiliary verbs', () => {
    assert(r.sat > r.big && r.run > r.old && r.was > r.his && r.sat > r.was);
  });

  s = state(h, ['The', 'cat', 'sat', 'on', 'the', 'mat'], 3, [0, 1, 2, 4, 5]);
  r = scores(h, ['on', 'in', 'at', 'to', 'hi', 'go'], s.context);
  check('verb context favors prepositions over unrelated words', () => {
    assert(r.on > r.in * 0.9 && r.in > r.at && r.at > r.hi && r.on > r.go * 2);
  });

  s = state(h, ['The', 'cat', 'can', 'run'], 3, [0, 1, 2]);
  r = scores(h, ['run', 'runs', 'red', 'his'], s.context);
  check('modal context favors base verbs', () => assert(r.run > r.runs && r.run > r.red && r.run > r.his));

  s = state(h, ['The', 'cat', 'wants', 'to', 'run'], 4, [0, 1, 2, 3]);
  r = scores(h, ['run', 'ran', 'big', 'his'], s.context);
  check('to context favors base verbs over past verbs and nonverbs', () => assert(r.run > r.ran && r.run > r.big && r.run > r.his));

  s = state(h, ['The', 'big', 'dog'], 1, [0, 2]);
  r = scores(h, ['big', 'cat', 'dog', 'his'], s.context);
  check('article plus visible noun allows adjective and noun readings', () => assert(r.big > r.his && r.cat > r.his && r.dog > r.his));

  const runRoles = h.classifyAiCandidateWord({ word: 'run' });
  const petRoles = h.classifyAiCandidateWord({ word: 'pet' });
  check('ambiguous words retain multiple roles', () => {
    assert(runRoles.has('noun') && runRoles.has('baseVerb'));
    assert(petRoles.has('noun') && petRoles.has('baseVerb'));
  });

  const hiddenA = state(h, ['The', 'cat', 'sat', 'on', 'the', 'mat'], 2, [0, 1, 3, 4, 5]);
  const visibleSnapshot = JSON.stringify(hiddenA.context.targetRoles);
  hiddenA.target.answer = 'different-hidden-answer';
  const hiddenB = state(h, ['The', 'cat', 'sat', 'on', 'the', 'mat'], 2, [0, 1, 3, 4, 5]);
  check('role inference depends only on visible state', () => assert.equal(JSON.stringify(hiddenB.context.targetRoles), visibleSnapshot));

  s = state(h, ['The', 'cat', 'sat', 'on', 'the', 'mat'], 1, [0, 3, 4, 5]);
  const partialBlock = h.groups[1].querySelectorAll()[1];
  partialBlock.dataset.revealed = 'true'; partialBlock.textContent = 'a';
  const partialContext = { ...h.getAiGrammarContext(s.target), targetLength: 3, targetRoles: h.inferAiTargetRoles(s.target) };
  check('partial spelling does not create hidden grammatical evidence', () => {
    assert.equal(partialContext.previousWord, 'the');
    assert.equal(partialContext.nextWord, '');
    assert.equal(partialContext.targetRoles.context.nextWord, '');
  });

  s = state(h, ['The', 'cat', 'sat', 'on', 'the', 'mat'], 3, [0, 1, 2, 4, 5]);
  r = scores(h, ['on', 'in', 'an'], s.context);
  check('partial preposition patterns retain grammatical separation', () => {
    assert(r.on > r.an && r.in > r.an);
  });

  s = state(h, ['The', 'cat', 'sat', 'on', 'the', 'mat'], 2, [0, 1, 3, 4, 5]);
  r = scores(h, ['sit', 'sat', 'pet', 'rat', 'art', 'yet'], s.context);
  check('partial verb patterns retain verb preference', () => {
    assert(r.sit > r.rat && r.sat > r.art && r.sit > r.yet);
  });

  console.log(`${checks} grammar architecture checks passed.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
