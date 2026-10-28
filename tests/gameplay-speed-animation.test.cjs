const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const speed = require('../gameplay-speed.js');
const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'student-animation.js'), 'utf8');
function fixture(setting, staticStudents) {
  let now = 0, id = 0;
  const timers = new Map(), handlers = {}, events = [], images = [];
  const elements = {};
  const context = vm.createContext({
    GGGGameplaySpeed: speed.createController(setting), location: { search: '' },
    performance: { now: () => now }, Image: class {},
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    queueMicrotask,
    setTimeout: (fn, ms) => { assert(ms > 0); timers.set(++id, { fn, ms, at: now + ms }); return id; },
    clearTimeout: key => timers.delete(key),
    document: {
      body: { dataset: { staticStudents: String(staticStudents) } },
      getElementById: name => elements[name] ||= {
        textContent: '', dataset: {}, classList: { add() {}, remove() {}, toggle() {} },
        set src(value) { images.push(value); },
      },
      addEventListener: (name, fn) => { handlers[name] = fn; },
      dispatchEvent: event => events.push(event),
    },
  });
  context.window = context;
  vm.runInContext(source, context);
  return { handlers, events, images, timers, elements, async drain() {
    for (let i = 0; i < 500; i++) {
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
      if (!timers.size) { await Promise.resolve(); if (!timers.size) return; }
      const [key, timer] = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      timers.delete(key); now = timer.at; timer.fn();
    }
    throw new Error('Animation did not settle');
  } };
}
(async () => {
  for (const setting of [speed.DEFAULT, { mode: 'human', percent: 10 }, { mode: 'human', percent: 150 }, { mode: 'max-testing' }]) {
    const timing = speed.createController(setting).snapshot();
    for (const staticStudents of [true, false]) for (const result of ['correct', 'incorrect']) {
      const f = fixture(setting, staticStudents);
      const displayDuration = timing.duration(1800, 'speech');
      f.handlers['ggg:student-guess']({ detail: { character: 'character2', guess: 'synthetic', location: 'first word', result, displayDuration, speedSetting: setting } });
      if (staticStudents) assert.equal([...f.timers.values()][0].ms, displayDuration, 'already-resolved speech is not scaled twice');
      await f.drain();
      assert.equal(f.events.filter(e => e.type === 'ggg:student-turn-complete').length, 1);
      if (!staticStudents) {
        for (const frame of ['02', '03', '04', '05']) assert(f.images.some(image => image.includes('Character02_Image' + frame + '.png')), 'guess frame retained');
        if (result === 'correct') for (const frame of ['06', '07']) assert(f.images.some(image => image.includes('Character02_Image' + frame + '.png')), 'applause frame retained');
      }
    }
  }
  const cancelled = fixture({ mode: 'max-testing' }, false);
  cancelled.handlers['ggg:student-guess']({ detail: { character: 'character1', guess: 'synthetic', result: 'correct' } });
  cancelled.handlers['ggg:student-reset'](); await cancelled.drain();
  assert.equal(cancelled.events.length, 0, 'cancelled animation emits no late completion');
  const staticRace = fixture({ mode: 'max-testing' }, true);
  staticRace.handlers['ggg:student-guess']({ detail: { character: 'character1', guess: 'first', result: 'correct' } });
  const oldHide = [...staticRace.timers.values()][0].fn;
  staticRace.handlers['ggg:student-guess']({ detail: { character: 'character1', guess: 'second', result: 'correct' } });
  oldHide();
  assert.equal(staticRace.elements.characterOneSpeech.textContent, 'second', 'old speech timer cannot hide a newer guess');
  await staticRace.drain();
  assert.equal(staticRace.events.length, 1, 'old speech microtask emits no completion');
  const animationRace = fixture({ mode: 'max-testing' }, false);
  animationRace.handlers['ggg:student-guess']({ detail: { character: 'character1', guess: 'first', result: 'correct' } });
  const oldWait = [...animationRace.timers.values()][0].fn;
  animationRace.handlers['ggg:student-reset']();
  animationRace.handlers['ggg:student-guess']({ detail: { character: 'character1', guess: 'second', result: 'incorrect' } });
  oldWait(); await animationRace.drain();
  assert.equal(animationRace.events.length, 1);
  assert.equal(animationRace.events[0].detail.guess, 'second');
  console.log('PASS static/full animation at all speeds, single scaling, retained frames and cancellation');
})().catch(error => { console.error(error); process.exitCode = 1; });
