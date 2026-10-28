const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '..', 'gameplay-logger.js'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture(send) {
  let now = 1000, nextTimer = 0, active = 0, maxActive = 0;
  const timers = new Map(), listeners = {}, requests = [], warnings = [];
  const acknowledge = payload => ({ ok: true, json: async () => ({ persisted: true,
    sessionId: payload.session.sessionId, chunkSequence: payload.chunkSequence,
    firstEvent: payload.firstEvent, lastEvent: payload.lastEvent }) });
  const document = { visibilityState: 'visible', addEventListener: (name, callback) => { listeners[name] = callback; } };
  const context = { TextEncoder, AbortController, Math, JSON, document,
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } },
    console: { debug() {}, warn: (...args) => warnings.push(args) },
    localStorage: { setItem() { throw new Error('Full-session localStorage writes are forbidden'); } },
    addEventListener: (name, callback) => { listeners[name] = callback; },
    setTimeout: (callback, delay) => { timers.set(++nextTimer, { callback, due: now + delay }); return nextTimer; },
    clearTimeout: timer => timers.delete(timer),
    fetch: async (url, options) => {
      const payload = JSON.parse(options.body);
      requests.push({ url, payload, options });
      active++; maxActive = Math.max(maxActive, active);
      try { return send ? await send(payload, options, acknowledge) : acknowledge(payload); }
      finally { active--; }
    },
  };
  context.window = context;
  vm.runInNewContext(source, context);
  const logger = context.GGGGameplayLogger;
  const start = puzzleNumber => logger.observe('start', { predictionMode: 'human-playtest', puzzleNumber,
    puzzleText: 'Hidden answer must not be logged', runtime: { buildId: 'fixture' }, settings: { diagnostic: true } });
  const advance = async milliseconds => {
    now += milliseconds;
    const ready = [...timers].filter(([, timer]) => timer.due <= now);
    for (const [id, timer] of ready) if (timers.delete(id)) timer.callback();
    await tick();
  };
  return { logger, start, requests, acknowledge, advance, listeners, document, warnings, timers,
    maxActive: () => maxActive };
}

test('successful chunks release events and subsequent saves contain only new evidence', async () => {
  const f = fixture(); f.start(25); await f.logger.flush();
  assert.equal(f.logger.getStatus().bufferedEvents, 0);
  assert.equal(f.requests[0].payload.session.puzzleText, undefined);
  for (let i = 0; i < 16; i++) f.logger.observe('diagnostic', { i });
  await f.logger.flush();
  assert.equal(f.requests.length, 2);
  assert.deepEqual(f.requests[1].payload.events.map(event => event.event), Array.from({ length: 16 }, (_, i) => i + 3));
  assert.equal(f.requests[1].payload.chunkSequence, 2);
  assert.equal(f.logger.getStatus().bufferedBytes, 0);
  assert.equal(f.maxActive(), 1);
});

test('periodic flush persists a small buffer; hidden/pagehide flushes are best effort', async () => {
  const f = fixture(); f.start(1); await f.logger.flush();
  f.logger.observe('small', {});
  await f.advance(1999); assert.equal(f.requests.length, 1);
  await f.advance(1); assert.equal(f.requests.length, 2);
  f.logger.observe('hidden', {}); f.document.visibilityState = 'hidden'; f.listeners.visibilitychange();
  await f.logger.flush(); assert.equal(f.requests.length, 3);
  f.logger.observe('unload', {}); f.listeners.pagehide(); await f.logger.flush();
  assert.equal(f.requests.length, 4);
  assert.equal(f.requests.at(-1).options.keepalive, true);
});

test('failed persistence retains immutable events, backs off, and retries the same sequence', async () => {
  let fail = true;
  const f = fixture((payload, options, ack) => {
    if (fail) throw new Error('offline');
    return ack(payload);
  });
  f.start(1); await f.logger.flush();
  assert.equal(f.logger.getStatus().bufferedEvents, 2);
  const original = f.requests[0].options.body;
  const detail = { value: 'original' };
  f.logger.observe('diagnostic', detail); detail.value = 'mutated';
  for (let i = 0; i < 40; i++) f.logger.observe('diagnostic', { i });
  await f.logger.flush(); assert.equal(f.requests.length, 1, 'new events do not cause a retry storm');
  assert.equal(f.logger.getStatus().bufferedEvents, 43, 'outage safety retains the entire unsaved backlog');
  fail = false; await f.advance(5000); await f.logger.flush();
  assert.equal(f.requests[1].options.body, original);
  const persisted = f.requests.slice(1).flatMap(request => request.payload.events);
  assert.equal(persisted.length, 43);
  assert.equal(persisted[2].detail.value, 'original');
  assert.equal(f.logger.getStatus().bufferedEvents, 0);
  assert.equal(f.logger.getStatus().lastSaveError, null);
});

test('HTTP success without a matching persistence acknowledgement never releases events', async () => {
  const f = fixture(() => ({ ok: true, json: async () => ({ persisted: true, chunkSequence: 999 }) }));
  f.start(1); await f.logger.flush();
  assert.equal(f.logger.getStatus().bufferedEvents, 2);
  assert.match(f.logger.getStatus().lastSaveError, /acknowledgement/);
});

test('events and completion arriving during a save retain chronological order', async () => {
  let release;
  const f = fixture((payload, options, ack) => payload.chunkSequence === 1
    ? new Promise(resolve => { release = () => resolve(ack(payload)); }) : ack(payload));
  f.start(25); await tick();
  f.logger.observe('ai-decision', { provider: 'ETTIN', score: -2 });
  f.logger.observe('guess', { responder: 'character1', isAi: true, guessedWord: 'example', actualAnswer: 'secret', result: 'incorrect' });
  f.logger.observe('complete', { winner: 'human' });
  assert.equal(f.requests.length, 1);
  assert.equal(f.logger.getStatus().bufferedEvents, 5);
  release(); await f.logger.flush();
  const reconstructed = f.requests.flatMap(request => request.payload.events);
  assert.deepEqual(reconstructed.map(event => event.event), [1, 2, 3, 4, 5]);
  assert.equal(reconstructed[3].actualAnswer, undefined);
  assert.equal(reconstructed[3].decision.provider, 'ETTIN');
  assert.equal(f.requests[0].payload.finished, false);
  assert.equal(f.requests.at(-1).payload.finished, true);
  assert.deepEqual(f.requests.at(-1).payload.finalResult, { winner: 'human' });
  assert(f.requests.at(-1).payload.session.endTime);
  assert.equal(f.logger.getStatus().bufferedEvents, 0);
  assert.equal(f.maxActive(), 1);
});

test('starting another puzzle does not discard an older in-flight session', async () => {
  let release;
  const f = fixture((payload, options, ack) => payload.session.puzzleNumber === 1 && payload.chunkSequence === 1
    ? new Promise(resolve => { release = () => resolve(ack(payload)); }) : ack(payload));
  f.start(1); await tick(); f.logger.observe('old-session-event', {});
  f.start(2); f.logger.observe('complete', { winner: 'second' });
  release(); await f.logger.flush();
  assert.deepEqual(f.requests.map(request => request.payload.session.puzzleNumber), [1, 1, 2]);
  assert.deepEqual(f.requests[1].payload.events.map(event => event.type), ['old-session-event']);
  assert.equal(f.requests[2].payload.chunkSequence, 1);
  assert.equal(f.logger.getStatus().bufferedEvents, 0);
});

test('a stalled request times out without clearing events or overlapping retries', async () => {
  const f = fixture((payload, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('timeout')));
  }));
  f.start(1); await tick(); await f.advance(15000);
  assert.equal(f.logger.getStatus().bufferedEvents, 2);
  assert.match(f.logger.getStatus().lastSaveError, /timeout/);
  await f.advance(4999); assert.equal(f.requests.length, 1);
  await f.advance(1); assert.equal(f.requests.length, 2);
  assert.equal(f.maxActive(), 1);
  await f.advance(15000);
});

test('byte threshold splits chunks and an oversized event remains intact', async () => {
  const f = fixture(); f.start(1); await f.logger.flush();
  const detail = { text: 'x'.repeat(100 * 1024) };
  for (let i = 0; i < 3; i++) f.logger.observe('large', detail);
  await f.logger.flush();
  assert.deepEqual(f.requests.slice(1).map(request => request.payload.events.length), [2, 1]);
  f.logger.observe('oversized', { text: 'z'.repeat(300 * 1024) }); await f.logger.flush();
  assert.equal(f.requests.at(-1).payload.events.length, 1);
  assert.equal(f.requests.at(-1).payload.events[0].detail.text.length, 300 * 1024);
  assert.equal(f.requests.at(-1).options.keepalive, false);
});

test('2,200-event diagnostic session retains only the unacknowledged working buffer', async () => {
  const f = fixture(); f.start(25); await f.logger.flush();
  let maxEvents = 0, maxBytes = 0;
  const detail = { publicBoard: 'b'.repeat(16 * 1024) };
  for (let i = 0; i < 2200; i++) {
    f.logger.observe('diagnostic', { ...detail, i });
    const status = f.logger.getStatus();
    maxEvents = Math.max(maxEvents, status.bufferedEvents);
    maxBytes = Math.max(maxBytes, status.bufferedBytes);
    await tick();
  }
  f.logger.observe('complete', { winner: 'human' }); await f.logger.flush();
  const events = f.requests.flatMap(request => request.payload.events);
  assert.equal(events.length, 2203);
  assert.deepEqual(events.map(event => event.event), Array.from({ length: 2203 }, (_, i) => i + 1));
  assert(maxEvents <= 16);
  assert(maxBytes < 272 * 1024);
  assert.equal(f.logger.getStatus().bufferedEvents, 0);
  assert(f.requests.every(request => request.payload.events.length <= 16));
  assert.equal(f.maxActive(), 1);
  console.log(`Long session: 2,200 diagnostics, peak ${maxEvents} buffered events / ${maxBytes} event bytes; ${f.requests.length} ordered chunks; zero retained events after completion.`);
});
