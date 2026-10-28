const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const speed = require('../gameplay-speed.js');
const source = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
function load(context, names) {
  for (const name of names) {
    const match = new RegExp('^  (?:async )?function ' + name + '\\(', 'm').exec(source);
    assert(match, name);
    vm.runInContext(source.slice(match.index, source.indexOf('\n  }', match.index) + 4), context);
  }
}
function fixture(setting = speed.DEFAULT) {
  let now = 100, draws = 0;
  const timers = [];
  const controller = speed.createController(setting);
  const math = Object.create(Math);
  math.random = () => { draws++; return 0.25; };
  const c = vm.createContext({
    Math: math, console, performance: { now: () => now },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimeout() {},
    gameplaySpeed: controller, turnTiming: controller.snapshot(),
    GAMEPLAY_DELAY_MULTIPLIER: 1.2, HUMAN_PLAYTEST_AI_CYCLE_SCALE: 0.2,
    AI_GUESS_DISPLAY_MS: 1500, HUMAN_PLAYTEST_INCORRECT_GUESS_DISPLAY_MS: 1500,
    WRONG_GUESS_DISPLAY_MS: 750, SUBMISSION_GRACE_PERIOD: 250,
    isHumanPlaytestMode: () => false, usesPreparedAiRoute: () => false, aiScheduleGeneration: 0, recognitionGeneration: 0,
    opportunityGeneration: 0, aiCompletionTimer: null, aiTurnTimer: null, recognitionTimer: null, wrongFeedback: null, aiGuessNumber: 1,
    gameStarted: true, isGameOver: false, gameEnded: false, humanHandRaised: false,
    raisedHandCharacter: null, recognizedResponder: null, aiTurnState: 'idle',
    aiLogicSettingsLoaded: true, aiLogicSettings: { timing: {
      firstGuess: [{ minSeconds: 7, maxSeconds: 20, chance: 100 }],
      betweenGuesses: [{ minSeconds: 2, maxSeconds: 5, chance: 100 }],
    } },
    HAND_RAISE_STATES: { OPEN: 'open', ANSWER_LOCKED: 'locked' }, handRaiseState: 'open',
    clearRaisedAiHand() {}, setTeacherMessage() {}, updateHumanRaiseHandButton() {},
    clearWrongSnapshot() {}, finishPendingHintDisplay() {},
    document: { addEventListener() {}, removeEventListener() {} },
    cancelAttemptTimers() {}, clearCapitalizationEditing() {}, renderAttemptPreview() {},
    createAttempt: () => ({}), setMessage() {}, clearTemporaryPreviewBlocks() {},
    getHiddenBlocks: () => [], finishHumanGuessOpportunity() {},
  });
  load(c, ['gameplayDelayWithMultiplier', 'humanPlaytestDelay', 'gameplayPacingDelay',
    'humanPlaytestGuessDisplayDelay', 'humanPlaytestIncorrectGuessDisplayDelay',
    'chooseAiTimingRange', 'timingSettingsAreUsable', 'scheduleAiTurn', 'cancelAiTurn',
    'scheduleAiGuessCompletion', 'removeFeedbackInputBlocker', 'cancelWrongFeedback', 'resetHandRaiseState',
    'scheduleCurrentGuessSubmission', 'showWrongGuessFeedback']);
  return { c, timers, controller, draws: () => draws, setNow: n => { now = n; } };
}

(async () => {
  for (const bad of [null, [], {}, { mode: 'human' }, { mode: 'human', percent: 9 },
    { mode: 'human', percent: 151 }, { mode: 'human', percent: '100' },
    { mode: 'human', percent: NaN }, { mode: 'human', percent: Infinity },
    { mode: 'human', percent: 100, extra: true }, { mode: 'max-testing', percent: 100 }, { mode: 'max' }]) {
    assert.throws(() => speed.validateSetting(bad));
  }
  for (const percent of [10, 100, 150]) {
    const { c, timers, draws } = fixture({ mode: 'human', percent });
    for (const playtest of [false, true]) {
      c.isHumanPlaytestMode = () => playtest;
      assert.equal(c.gameplayPacingDelay(1000), playtest ? 240 : 1200);
      assert.equal(c.humanPlaytestGuessDisplayDelay(), playtest ? 1080 : 1800);
      assert.equal(c.humanPlaytestIncorrectGuessDisplayDelay(), 1800);
      assert.equal(c.turnTiming.duration(c.humanPlaytestDelay(750), 'recognition'), (playtest ? 180 : 750) * (100 / percent));
    }
    c.isHumanPlaytestMode = () => false;
    c.runAutomaticStudentTurn = () => {};
    c.scheduleAiTurn(true);
    assert.equal(timers.at(-1).ms, 12000 * (100 / percent));
    assert.equal(draws(), 2, 'timing uses the same random draws at every speed');
    for (const phase of Object.keys(speed.MAX_MINIMUM_MS)) {
      assert.equal(c.turnTiming.duration(1800, phase), 1800 * (100 / percent));
    }
  }
  {
    const { c, timers, controller, draws } = fixture({ mode: 'max-testing' });
    c.scheduleAiTurn(true);
    assert.equal(timers.at(-1).ms, speed.MAX_MINIMUM_MS.pacing);
    assert.equal(draws(), 2, 'MAX still samples timing before compressing it');
    for (const [phase, minimum] of Object.entries(speed.MAX_MINIMUM_MS)) {
      assert(minimum > 0);
      assert.equal(c.turnTiming.duration(0, phase), minimum);
      assert.equal(c.turnTiming.duration(50000, phase), minimum);
    }
    assert.throws(() => c.turnTiming.duration(100, 'inference'));
    const attempt = {};
    c.currentAttempt = attempt;
    c.cancelSubmissionTimer = () => {};
    let submitted = 0;
    c.submitCurrentGuess = () => submitted++;
    c.scheduleCurrentGuessSubmission(attempt);
    assert.equal(timers.at(-1).ms, 250, 'typing grace is never speed-scaled');
    timers.at(-1).fn();
    assert.equal(submitted, 1);
    const active = c.turnTiming;
    controller.set({ mode: 'human', percent: 10 });
    assert.equal(active.duration(1800, 'feedback'), 160, 'active phase retains its captured speed');
    c.cancelAiTurn(); c.scheduleAiTurn(false);
    assert.equal(c.turnTiming.setting.percent, 10, 'next opportunity captures the saved speed');
  }
  {
    const { c, timers } = fixture();
    let finished = 0, started = 0;
    c.finishAiGuessOpportunity = () => finished++;
    c.runAutomaticStudentTurn = () => started++;
    c.handRaiseState = 'locked'; c.recognizedResponder = 'character1';
    c.scheduleAiGuessCompletion(1800, 'character1');
    const stale = timers.at(-1).fn;
    c.resetHandRaiseState(); // same reset used for puzzle change/admin cancellation
    c.handRaiseState = 'locked'; c.recognizedResponder = 'character1';
    stale();
    assert.equal(finished, 0, 'old completion cannot release a later same-character turn');
    c.scheduleAiGuessCompletion(1800, 'character1'); timers.at(-1).fn();
    assert.equal(finished, 1);
    c.resetHandRaiseState(); c.aiTurnState = 'idle';
    c.scheduleAiTurn(false); const oldWait = timers.at(-1).fn;
    c.cancelAiTurn(); c.resetHandRaiseState(); c.scheduleAiTurn(false);
    const newTimer = c.aiTurnTimer;
    oldWait();
    assert.equal(started, 0); assert.equal(c.aiTurnTimer, newTimer);
    timers.at(-1).fn(); assert.equal(started, 1);
  }
  {
    const { c, timers } = fixture({ mode: 'max-testing' });
    load(c, ['cancelTeacherRecognition', 'clearRaisedAiHand', 'raiseAiHand']);
    c.HAND_RAISE_STATES.AI_HAND_PENDING = 'pending';
    c.aiHandIndicators = { character1: { hidden: true, classList: { add() {}, remove() {} }, setAttribute() {} } };
    c.emitDiagnosticEvent = () => {};
    let recognized = 0;
    c.recognizeAiResponder = () => recognized++;
    c.raiseAiHand('character1'); const oldRecognition = timers.at(-1).fn;
    assert.equal(timers.at(-1).ms, speed.MAX_MINIMUM_MS.recognition);
    c.resetHandRaiseState(); c.raiseAiHand('character1');
    oldRecognition(); assert.equal(recognized, 0);
    timers.at(-1).fn(); assert.equal(recognized, 1);
  }
  for (const setting of [speed.DEFAULT, { mode: 'human', percent: 10 }, { mode: 'human', percent: 150 }, { mode: 'max-testing' }]) {
    const { c, timers, controller } = fixture(setting);
    let cleaned = 0, released = 0;
    c.processWrongGuess = () => cleaned++;
    c.finishAiGuessOpportunity = () => released++;
    const attempt = { group: { classList: { add() {} } }, aiGuessContext: {}, typedCharacters: '' };
    c.currentAttempt = attempt;
    c.showWrongGuessFeedback(attempt, 'character1');
    const feedback = c.wrongFeedback, timer = timers.at(-1);
    assert.equal(feedback.displayDuration, timer.ms);
    assert.equal(feedback.endsAt, 100 + timer.ms);
    controller.set({ mode: 'human', percent: 10 });
    timer.fn(); timer.fn();
    assert.equal(cleaned, 1); assert.equal(released, 1, 'duplicate feedback callback is inert');
    c.showWrongGuessFeedback(attempt, 'character1'); const cancelled = timers.at(-1).fn;
    c.resetHandRaiseState(); cancelled();
    assert.equal(cleaned, 1); assert.equal(released, 1, 'puzzle reset invalidates feedback cleanup');
  }
  {
    const { c, timers } = fixture();
    load(c, ['recognizeAiResponder']);
    c.HAND_RAISE_STATES.AI_HAND_PENDING = 'pending';
    c.handRaiseState = 'pending'; c.raisedHandCharacter = 'character1';
    c.AI_CHARACTER_NAMES = { character1: 'Fixture' };
    c.chooseAiTargetSlot = () => ({ slotIndex: 0, length: 3 });
    c.isAiMaximumAccuracyMode = () => false;
    let complete, submitted = 0;
    c.buildAiCandidatePool = () => new Promise(resolve => { complete = resolve; });
    c.submitSelectedAiGuess = () => submitted++;
    c.emitDiagnosticEvent = () => {};
    const pending = c.recognizeAiResponder('character1');
    assert.equal(timers.length, 0, 'inference completion is awaited, never timed');
    c.resetHandRaiseState();
    c.handRaiseState = 'locked'; c.recognizedResponder = 'character1';
    complete({ candidates: [{ word: 'cat' }] }); await pending;
    assert.equal(submitted, 0, 'late inference cannot submit into a later same-character turn');
  }
  console.log('PASS baseline/10%/150%/MAX timing, RNG draws, phase snapshots, typing grace, stale timers, feedback deadlines, and inference ownership');
})().catch(error => { console.error(error); process.exitCode = 1; });
