const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { harness, group, root } = require('./ai-harness.cjs');
const source = fs.readFileSync(path.join(root, 'hints.js'), 'utf8');
function word(text, exposed = []) {
  const g = group(text);
  g.querySelectorAll().forEach((b, i) => {
    b.classList.remove = () => {};
    if (exposed.includes(i)) { b.dataset.revealed = 'true'; b.textContent = b.dataset.letter; }
  });
  return g;
}
function choose(groups, random = () => 0) {
  const math = Object.create(Math); math.random = random;
  const context = vm.createContext({ window: {}, Math: math, console: { log() {} } });
  vm.runInContext(source, context);
  return JSON.parse(JSON.stringify(context.window.Hints.evaluate({ allGroups: groups })))?.letters || [];
}
const blocks = groups => groups.flatMap(g => g.querySelectorAll());
const exposedCount = groups => blocks(groups).filter(b => b.dataset.revealed === 'true').length;

for (const [hidden, count] of [[45, 3], [44, 2], [21, 2], [20, 1]]) {
  test(`${hidden} unrevealed letters select ${count} distinct interior hints`, () => {
    const lengths = [Math.floor(hidden / 3), Math.floor(hidden / 3), hidden - 2 * Math.floor(hidden / 3)];
    const groups = lengths.map(n => word('b'.repeat(n)));
    const picks = choose(groups);
    assert.equal(picks.length, count);
    assert.equal(new Set(picks.map(p => p.groupIndex)).size, count);
    picks.forEach(p => assert(p.letterIndex > 0 && p.letterIndex < lengths[p.groupIndex] - 1));
    assert.equal(exposedCount(groups), 0, 'selection must not mutate the board');
  });
}

test('consonants (including Y) precede vowels; random selection respects punctuation and exposed blocks', () => {
  const g = word("'abYcd!'", [2]); // First/last alphabetic blocks are a/d, not punctuation.
  g.querySelectorAll().filter(b => b.dataset.revealed !== 'true').forEach(b => b.textContent = 'x');
  const first = choose([g], () => 0)[0];
  const last = choose([g], () => 0.99)[0];
  assert.equal(first.letterIndex, 3); // Y, after already-exposed b
  assert.equal(last.letterIndex, 4); // c: selection is not always the first consonant
  assert.equal(choose([word('bead')])[0].letterIndex, 1, 'interior vowel fallback');
  assert.deepEqual(choose([word('abcd', [1, 2])]), [], 'hidden endpoints cannot make a word eligible');
});

test('short words are excluded below 75% and a three-letter middle is eligible at exactly 75%', () => {
  const filler = word('b'.repeat(14), Array.from({ length: 14 }, (_, i) => i));
  const groups = [word('a'), word('to'), word('cat'), filler]; // 14/20 exposed
  assert.deepEqual(choose(groups), []);
  groups[2].querySelectorAll()[0].dataset.revealed = 'true'; // 15/20 exposed
  assert.deepEqual(choose(groups), [{ groupIndex: 2, letterIndex: 1 }]);
  groups[2].querySelectorAll()[1].dataset.revealed = 'true';
  assert.deepEqual(choose(groups), [], 'one/two-letter words and endpoints remain protected above 75%');
});

test('even median uses current hidden size, including hidden endpoints, for both probability branches', () => {
  const groups = [word('abcdefghij', [0, 2, 3, 4, 5, 6, 8, 9]), word('abcd'), word('abcde'), word('abcdef')];
  // Current sizes 2,4,5,6: mathematical median 4.5, irrespective of original lengths.
  for (const [branch, expected] of [[0.79, 2], [0.8, 0]]) {
    let calls = 0;
    const picks = choose(groups, () => calls++ === 0 ? branch : 0);
    assert.equal(picks[0].groupIndex, expected);
    assert.equal(calls, 3, 'one preference decision, one word choice, one letter choice');
  }
  // Hidden endpoints matter: sizes 3,2,1 put the first two words in HIGHER.
  const endpoints = [word('abcd', [2]), word('efgh', [0, 3]), word('ijkl', [0, 2, 3])];
  assert.equal(choose(endpoints, () => 0)[0].groupIndex, 0);
  let calls = 0;
  assert.equal(choose(endpoints, () => calls++ === 0 ? 0.9 : 0)[0].groupIndex, 2);
});

test('odd median includes equality; preferred pools fill from the other pool without replacement', () => {
  const groups = [word('b'.repeat(14)), word('b'.repeat(15)), word('b'.repeat(16))];
  for (const [branch, expected] of [[0, [1, 2, 0]], [0.9, [0, 1, 2]]]) {
    let calls = 0;
    assert.deepEqual(choose(groups, () => calls++ === 0 ? branch : 0).map(p => p.groupIndex), expected);
    assert.equal(calls, 7, 'only one preference decision for three hints');
  }
  const identical = [word('b'.repeat(15)), word('b'.repeat(15)), word('b'.repeat(15))];
  assert.deepEqual(choose(identical, () => 0.99).map(p => p.groupIndex), [2, 1, 0], 'empty LOWER pool falls back; identical words are distinct instances');
  assert.equal(choose([word('b'.repeat(45))]).length, 1, 'too few eligible instances means fewer hints');
});

test('later selection recalculates current sizes and median from newly exposed blocks', () => {
  const groups = [word('abcd'), word('bcdef'), word('cdefgh')];
  assert.equal(choose(groups)[0].groupIndex, 1); // sizes 4,5,6, median 5
  [0, 1, 4].forEach(i => { groups[1].querySelectorAll()[i].dataset.revealed = 'true'; });
  assert.equal(choose(groups)[0].groupIndex, 0); // sizes 4,2,6, median 4
});

test('production trigger queues the entire snapshot, reveals once after preview, then recalculates', async () => {
  const h = await harness(); vm.runInContext(source, h);
  // The shared harness omits the browser's playtest module; supply only its diagnostic key.
  h.GGGHumanPlaytest = { boardKey: () => String(exposedCount(h.groups)) };
  h.isEttinPilotMode = () => false;
  Object.assign(h, { MAX_STRIKES: 5, strikeCount: 0, hintRevealCount: 0, wrongFeedback: {}, updateAllPartialUnderlines() {} });
  h.groups = Array.from({ length: 3 }, () => word('b'.repeat(15)));
  const events = []; h.emitDiagnosticEvent = (type, detail) => { if (type === 'hint-display') events.push(detail); };
  for (let i = 1; i <= 5; i++) {
    const a = {}, d = h.applyCommittedHintResult(a, 'incorrect');
    assert.equal(d.hintTriggered, i === 5);
    assert.equal(h.applyCommittedHintResult(a, 'incorrect'), d, 'duplicate commit is neutral');
    if (i === 5) { assert.equal(d.hintLocations.length, 3); assert(d.hintPendingDisplay); }
  }
  assert.equal(h.strikeCount, 0);
  assert.equal(exposedCount(h.groups), 0);
  assert.equal(h.finishPendingHintDisplay(), false);
  h.wrongFeedback = null;
  assert.equal(h.finishPendingHintDisplay(), true);
  assert.equal(exposedCount(h.groups), 3, '45 at snapshot start still reveals all three');
  assert.equal(h.finishPendingHintDisplay(), false);
  assert.equal(events.length, 1);
  assert.equal(events[0].hintLocations.length, 3);
  assert.equal(events[0].revealedLetters.length, 3);
  for (let i = 1; i <= 5; i++) {
    const d = h.applyCommittedHintResult({}, 'incorrect');
    assert.equal(d.hintTriggered, i === 5);
    if (i === 5) assert.equal(d.hintLocations.length, 2, '42 remaining means two at the next event');
  }
  assert.equal(exposedCount(h.groups), 5);
  assert.equal(events.length, 2);
  h.wrongFeedback = {}; h.strikeCount = 4;
  h.applyCommittedHintResult({}, 'incorrect');
  assert.equal(h.finishPendingHintDisplay('changed-puzzle'), false);
  assert.equal(exposedCount(h.groups), 5, 'cancellation reveals none of the queued set');
});
