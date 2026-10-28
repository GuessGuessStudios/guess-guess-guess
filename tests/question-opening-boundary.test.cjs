const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { harness, root } = require('./ai-harness.cjs');

(async () => {
  const context = await harness();
  for (const file of ['human-playtest-eligibility.js', 'human-playtest.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  }
  const questionOpening = context.GGGHumanPlaytest.questionOpening;
  function board(tokens, targetSlotIndex) {
    return {
      targetSlotIndex,
      slots: tokens.map((token, slotIndex) => {
        const value = typeof token === 'string' ? token : token.text;
        const punctuation = value.match(/[.!?;:]+$/)?.[0] || '';
        return {
          letters: [...value.replace(/[.!?;:]+$/, '')].map(character => ({
            visible: character === '_' ? null : character,
            capital: slotIndex === 0 && character === character.toUpperCase(),
          })),
          trailing: punctuation,
        };
      }),
    };
  }

  assert.equal(questionOpening(board(['Who', 'left?'], 0)), true,
    'a question at the beginning of the puzzle is a question opening');
  assert.equal(questionOpening(board(['The', 'cat', 'slept.', 'Who', 'left?'], 3)), true,
    'a question that starts a later sentence is recognized');
  assert.equal(questionOpening(board(['The', 'cat', 'slept.', 'Who', 'left?'], 0)), false,
    'an earlier declarative sentence stays non-question despite a later question mark');
  assert.equal(questionOpening(board(['The', 'cat', 'sleeps.', 'Who', 'left?'], 1)), false,
    'a target inside a declarative sentence stays non-question');

  console.log('PASS target-sentence question-opening boundaries (4 cases)');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
