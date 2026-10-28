const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
const functionNames = ['isGameplayInputEvent', 'removeFeedbackInputBlocker', 'clearWrongSnapshot',
  'cancelWrongFeedback', 'showWrongGuessFeedback', 'createAttempt', 'cancelSubmissionTimer',
  'cancelAttemptTimers', 'resetHandRaiseState', 'renderPuzzle', 'loadPuzzleAtIndex', 'lockGame'];
const productionFunctions = functionNames.map(name => {
  const match = new RegExp(`^  (?:async )?function ${name}\\(`, 'm').exec(source);
  assert(match, `Production function ${name} exists`);
  return source.slice(match.index, source.indexOf('\n  }', match.index) + 4);
}).join('\n');

function fixture() {
  const listeners = [], timers = new Map();
  let nextTimer = 0, normalKeyEvents = 0, processed = 0, completed = 0, renders = 0;
  const document = {
    addEventListener(type, callback, capture = false) {
      if (!listeners.some(l => l.type === type && l.callback === callback && l.capture === capture))
        listeners.push({ type, callback, capture });
    },
    removeEventListener(type, callback, capture = false) {
      const index = listeners.findIndex(l => l.type === type && l.callback === callback && l.capture === capture);
      if (index !== -1) listeners.splice(index, 1);
    },
    querySelectorAll: () => [],
  };
  document.addEventListener('keydown', () => normalKeyEvents++);
  document.addEventListener('keyup', () => normalKeyEvents++);
  const baseline = listeners.length;
  const c = vm.createContext({ document, console, performance: { now: () => 100 },
    gameStarted: true, gameEnded: false, isGameOver: false,
    HAND_RAISE_STATES: { ANSWER_LOCKED: 'locked', OPEN: 'open' }, handRaiseState: 'locked', recognizedResponder: 'human',
    wrongFeedback: null, opportunityGeneration: 0, aiCompletionTimer: null, WRONG_GUESS_DISPLAY_MS: 900,
    turnTiming: { duration: ms => ms }, humanPlaytestIncorrectGuessDisplayDelay: () => 900,
    isHumanPlaytestMode: () => false, usesPreparedAiRoute: () => false, getHiddenBlocks: group => group.blocks,
    setTimeout: (callback, delay) => { timers.set(++nextTimer, { callback, delay }); return nextTimer; },
    clearTimeout: id => timers.delete(id),
    processWrongGuess: () => processed++, finishAiGuessOpportunity: () => completed++,
    finishHumanGuessOpportunity: () => completed++,
    puzzleList: [{ number: 1, text: '' }, { number: 2, text: '' }], currentPuzzleNumber: null,
    previousPuzzleBtn: null, puzzleImageDataUrl: null, holdImageBtn: null, imageOverlay: null, endGameBtn: null,
    getWordLocations: () => [],
  });
  c.window = c;
  for (const name of ['clearCapitalizationEditing', 'renderAttemptPreview', 'setMessage', 'finishPendingHintDisplay',
    'clearTemporaryPreviewBlocks', 'clearRaisedAiHand', 'setTeacherMessage', 'updateHumanRaiseHandButton',
    'cancelAiTurn', 'clearAiWrongGuessMemory', 'resetAssistanceRound', 'updateStartGameButton', 'emitStudentEvent', 'clearPreview',
    'clearEnding', 'setActiveManualGuesser', 'updateMyPoints', 'resetPlayerScores', 'applyPuzzleBlockScale', 'showEnding'])
    c[name] = () => {};
  c.puzzleArea = { set innerHTML(value) {
    assert.equal(value, '');
    assert.equal(listeners.length, baseline, 'cleanup precedes replacement of board DOM');
    renders++;
  } };
  vm.runInContext(productionFunctions, c);
  const start = (actor = 'human') => {
    c.gameStarted = true; c.handRaiseState = 'locked'; c.recognizedResponder = actor;
    const classes = new Set();
    const group = { blocks: [{ dataset: {} }, { dataset: {} }], classList: {
      add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name),
    } };
    const attempt = c.createAttempt(group, 'click');
    attempt.typedCharacters = 'xx';
    if (actor !== 'human') attempt.aiGuessContext = { slotIndex: 0 };
    c.currentAttempt = attempt;
    c.showWrongGuessFeedback(attempt, actor);
    return c.wrongFeedback;
  };
  const fire = feedback => {
    const timer = timers.get(feedback.timer);
    assert(timer); assert.equal(timer.delay, 900, 'existing feedback duration preserved');
    timers.delete(feedback.timer); timer.callback();
  };
  const dispatch = (type, properties = {}) => {
    const event = { key: 'a', code: 'KeyA', timeStamp: 150, target: { tagName: 'DIV' }, prevented: false, stopped: false,
      preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...properties };
    for (const capture of [true, false]) for (const listener of [...listeners]) {
      if (listener.type !== type || listener.capture !== capture) continue;
      listener.callback(event);
      if (event.stopped) return event;
    }
    return event;
  };
  return { c, start, fire, dispatch, timers, listeners, baseline,
    normalKeyEvents: () => normalKeyEvents, processed: () => processed, completed: () => completed, renders: () => renders };
}

test('active feedback installs two capture listeners and preserves keyboard blocking/release', () => {
  const f = fixture(), feedback = f.start();
  assert.equal(f.listeners.length, f.baseline + 2);
  assert.deepEqual(f.listeners.filter(l => l.capture).map(l => l.type), ['keydown', 'keyup']);
  for (const key of ['a', 'Backspace', 'Enter', 'Escape']) {
    const event = f.dispatch('keydown', { key, code: key });
    assert(event.prevented && event.stopped);
    assert(feedback.pressedGameplayKeys.has(key));
    f.dispatch('keyup', { key, code: key });
    assert(!feedback.pressedGameplayKeys.has(key));
  }
  for (const properties of [{ ctrlKey: true }, { metaKey: true }, { altKey: true },
    { target: { tagName: 'INPUT' } }, { target: { tagName: 'TEXTAREA' } },
    { target: { isContentEditable: true } }, { key: 'Tab' }])
    assert.equal(f.dispatch('keydown', properties).prevented, false);
  f.fire(feedback);
  const before = f.normalKeyEvents();
  assert.equal(f.dispatch('keydown').prevented, false);
  assert.equal(f.normalKeyEvents(), before + 1, 'ordinary input resumes after completion');
  assert.equal(f.listeners.length, f.baseline);
});

test('normal completion cleans up even when a gameplay key remains held', () => {
  const f = fixture(), feedback = f.start();
  f.dispatch('keydown');
  f.fire(feedback);
  assert.equal(f.listeners.length, f.baseline);
  assert.equal(feedback.pressedGameplayKeys.size, 0);
  assert.equal(f.c.wrongFeedback, null);
  assert.equal(f.processed(), 1); assert.equal(f.completed(), 1);
  assert(!feedback.group.classList.contains('wrong-guess'));
  assert(feedback.blocks.every(block => block.dataset.wrongSnapshotLetter === undefined));
});

test('mouse-only human and AI completion remove listeners without a keypress', () => {
  const f = fixture();
  for (const actor of ['human', 'character1']) {
    f.fire(f.start(actor));
    assert.equal(f.listeners.length, f.baseline);
  }
  assert.equal(f.normalKeyEvents(), 0);
  assert.equal(f.completed(), 2);
});

test('cancellation and repeated cleanup are safe, including a queued stale callback', () => {
  const f = fixture(), feedback = f.start(), callback = f.timers.get(feedback.timer).callback;
  f.dispatch('keydown');
  f.c.cancelWrongFeedback(); f.c.cancelWrongFeedback();
  f.c.removeFeedbackInputBlocker(feedback); f.c.removeFeedbackInputBlocker(feedback);
  callback();
  assert.equal(f.listeners.length, f.baseline);
  assert.equal(f.timers.size, 0);
  assert.equal(feedback.pressedGameplayKeys.size, 0);
  assert.equal(f.processed(), 0);
});

test('replacement cancels previous feedback without letting its stale callback remove new listeners', () => {
  const f = fixture(), old = f.start(), oldCallback = f.timers.get(old.timer).callback;
  const next = f.start();
  assert.equal(f.listeners.length, f.baseline + 2);
  assert.equal(f.timers.size, 1);
  assert(!old.group.classList.contains('wrong-guess'));
  oldCallback();
  assert.equal(f.c.wrongFeedback, next);
  assert.equal(f.listeners.length, f.baseline + 2);
  assert(f.dispatch('keydown').prevented);
  f.fire(next);
  assert.equal(f.listeners.length, f.baseline);
});

test('real reset, board replacement, puzzle change and game-end paths clean up', async () => {
  const f = fixture();
  f.start(); f.c.resetHandRaiseState(); assert.equal(f.listeners.length, f.baseline);
  f.start(); f.c.renderPuzzle(''); assert.equal(f.listeners.length, f.baseline);
  f.start(); await f.c.loadPuzzleAtIndex(1);
  assert.equal(f.c.currentPuzzleIndex, 1); assert.equal(f.renders(), 2);
  assert.equal(f.listeners.length, f.baseline);
  for (const type of ['complete', 'answer']) {
    f.start(); f.c.lockGame(type);
    assert.equal(f.listeners.length, f.baseline); assert(f.c.gameEnded);
  }
  assert.equal(f.timers.size, 0);
});

test('a callback with an obsolete opportunity still releases its own input listeners', () => {
  const f = fixture(), feedback = f.start();
  f.c.opportunityGeneration++;
  f.fire(feedback);
  assert.equal(f.listeners.length, f.baseline);
  assert.equal(f.processed(), 0);
  f.c.cancelWrongFeedback();
});

test('2,000 mouse-only completed/cancelled/reset cycles return to baseline each time', () => {
  const f = fixture(); let peak = f.baseline;
  for (let i = 0; i < 2000; i++) {
    const feedback = f.start(i % 2 ? 'human' : 'character1');
    peak = Math.max(peak, f.listeners.length);
    if (i % 3 === 0) f.fire(feedback);
    else if (i % 3 === 1) f.c.cancelWrongFeedback();
    else f.c.resetHandRaiseState();
    assert.equal(f.listeners.length, f.baseline, `cycle ${i}`);
    assert.equal(f.timers.size, 0);
  }
  assert.equal(peak, f.baseline + 2);
  assert.equal(f.normalKeyEvents(), 0);
  console.log('2,000 cycles: peak 2 temporary keyboard listeners; 0 retained after every cycle.');
});
