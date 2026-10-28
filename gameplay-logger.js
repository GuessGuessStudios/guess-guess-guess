(function (global) {
  "use strict";

  const names = { character1: "Misaki", character2: "Aoi", character3: "Taiga", character4: "Sho", human: "human" };
  let state = null;
  let eventNumber = 0;
  let pendingDecision = null;
  let lastPilotSubmission = null;
  let playtestSaveInFlight = null;
  const MAX_CHUNK_EVENTS = 16;
  const MAX_CHUNK_BYTES = 256 * 1024;
  const FLUSH_INTERVAL_MS = 2000;
  const RETRY_INTERVAL_MS = 5000;
  const SAVE_TIMEOUT_MS = 15000;
  const playtestSessions = [];
  let flushTimer = null;
  let retryAt = 0;
  let lastSaveError = null;
  const byteLength = text => new TextEncoder().encode(text).byteLength;

  function pendingEvents() {
    return playtestSessions.some(session => session.events.length);
  }

  function scheduleFlush() {
    if (flushTimer !== null || playtestSaveInFlight || !pendingEvents()) return;
    const delay = Math.max(FLUSH_INTERVAL_MS, retryAt - Date.now());
    flushTimer = global.setTimeout(() => {
      flushTimer = null;
      void savePlaytest();
    }, delay);
  }

  function requestPlaytestSave() {
    if (state?.session.predictionMode !== 'human-playtest') return;
    if (state.events.length >= MAX_CHUNK_EVENTS || state.bufferBytes >= MAX_CHUNK_BYTES) void savePlaytest();
    else scheduleFlush();
  }

  function recordEvent(event) {
    if (state.session.predictionMode !== 'human-playtest') { state.events.push(event); return; }
    // Encode each new event once; never re-encode the persisted history.
    const json = JSON.stringify(event);
    const bytes = byteLength(json);
    state.events.push({ event: event.event, json, bytes });
    state.bufferBytes += bytes;
  }

  function prepareChunk(owner, smallChunks) {
    if (owner.pendingChunk) return owner.pendingChunk;
    const selected = [];
    let bytes = 0;
    const limit = smallChunks ? 48 * 1024 : MAX_CHUNK_BYTES;
    for (const event of owner.events) {
      // An indivisible oversized event travels alone, without truncating evidence.
      if (selected.length && (selected.length >= MAX_CHUNK_EVENTS || bytes + event.bytes > limit)) break;
      selected.push(event);
      bytes += event.bytes;
    }
    const finished = Boolean(owner.finished && selected.length === owner.events.length);
    const metadata = JSON.stringify({ format: 'ggg-human-playtest-chunk-v1', session: owner.session,
      runtime: owner.runtime, settings: owner.settings, startedAt: owner.startedAt,
      chunkSequence: owner.chunkSequence, firstEvent: selected[0].event, lastEvent: selected.at(-1).event,
      finished, finalResult: finished ? owner.finalResult : null });
    const body = metadata.slice(0, -1) + ',"events":[' + selected.map(event => event.json).join(',') + ']}';
    owner.pendingChunk = { body, count: selected.length, bytes, firstEvent: selected[0].event,
      lastEvent: selected.at(-1).event, sequence: owner.chunkSequence };
    return owner.pendingChunk;
  }

  function savePlaytest(smallChunks = false) {
    if (playtestSaveInFlight) return playtestSaveInFlight;
    if (!pendingEvents()) return Promise.resolve();
    if (Date.now() < retryAt) { scheduleFlush(); return Promise.resolve(); }
    if (flushTimer !== null) global.clearTimeout(flushTimer);
    flushTimer = null;
    // Assign the single-flight promise before any asynchronous work starts.
    playtestSaveInFlight = Promise.resolve().then(async () => {
      while (playtestSessions.length) {
        const owner = playtestSessions[0];
        if (!owner.events.length) {
          if (owner.closed || owner.finished) { playtestSessions.shift(); continue; }
          break;
        }
        const chunk = prepareChunk(owner, smallChunks);
        const controller = new AbortController();
        const timeout = global.setTimeout(() => controller.abort(), SAVE_TIMEOUT_MS);
        try {
          const response = await fetch('/api/human-playtest-logs', { method: 'POST',
            headers: { 'Content-Type': 'application/json' }, body: chunk.body,
            signal: controller.signal, keepalive: byteLength(chunk.body) < 60000 });
          if (!response.ok) throw new Error('Playtest log save failed: ' + response.status);
          const acknowledgement = await response.json();
          if (acknowledgement.persisted !== true || acknowledgement.sessionId !== owner.session.sessionId ||
              acknowledgement.chunkSequence !== chunk.sequence || acknowledgement.firstEvent !== chunk.firstEvent ||
              acknowledgement.lastEvent !== chunk.lastEvent) throw new Error('Invalid playtest chunk acknowledgement');
          // Only release the acknowledged prefix. New events remain queued.
          owner.events.splice(0, chunk.count);
          owner.bufferBytes -= chunk.bytes;
          owner.pendingChunk = null;
          owner.chunkSequence++;
          lastSaveError = null;
          retryAt = 0;
        } finally { global.clearTimeout(timeout); }
      }
    }).catch(error => {
      // Data safety wins during an outage: the unsaved backlog may exceed the
      // normal flush threshold. Never drop events or retry on every new event.
      const message = String(error.message || error);
      if (lastSaveError !== message) console.warn('Playtest log persistence failed; unsaved events retained in memory.', message);
      lastSaveError = message;
      retryAt = Date.now() + RETRY_INTERVAL_MS;
    }).finally(() => {
      playtestSaveInFlight = null;
      scheduleFlush();
    });
    return playtestSaveInFlight;
  }

  function clone(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch { return null; }
  }

  function elapsed() {
    return state ? Math.max(0, Date.now() - state.startedAt) : null;
  }

  async function finish(detail) {
    if (!state || state.finished) return;
    state.finished = true;
    state.session.endTime = new Date().toISOString();
    state.session.elapsedMs = elapsed();
    state.finalResult = clone(detail || {});
    if (state.session.predictionMode === 'human-playtest') { await savePlaytest(); return; }
    try {
      await fetch("/api/gameplay-logs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(state) });
    } catch (error) { console.debug("Gameplay log save failed; continuing game normally.", error); }
  }

  const logger = {
    observe(type, detail) {
      try {
        if (type === "start") {
          if (state?.session.predictionMode === 'human-playtest') state.closed = true;
          state = { session: { sessionId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, startTime: new Date().toISOString(), puzzleNumber: detail.puzzleNumber, puzzleText: detail.puzzleText, puzzleIdentity: clone(detail.puzzleIdentity), modeFlags: clone(detail.modeFlags), gameplaySpeed: clone(detail.gameplaySpeed), runtimeMode: detail.runtimeMode || null }, runtime: clone(detail.runtime || global.__GGG_RUNTIME__), settings: clone(detail.settings), events: [], finalResult: null };
          state.startedAt = Date.now(); eventNumber = 0; pendingDecision = null; lastPilotSubmission = null;
          if (detail.predictionMode === 'human-playtest') {
            state.session.predictionMode = detail.predictionMode;
            delete state.session.puzzleText;
            state.bufferBytes = 0;
            state.chunkSequence = 1;
            state.pendingChunk = null;
            playtestSessions.push(state);
          }
          recordEvent({ event: ++eventNumber, type: "start", elapsedMs: 0, puzzleNumber: detail.puzzleNumber });
          recordEvent({ event: ++eventNumber, type: "session-start", elapsedMs: 0, detail: { session: clone(state.session), runtime: clone(state.runtime), modeFlags: clone(detail.modeFlags), puzzleIdentity: clone(detail.puzzleIdentity) } });
          if (pendingEvents()) void savePlaytest();
          return;
        }
        if (!state || state.finished) return;
        if (type === "ai-decision") {
          pendingDecision = clone(detail);
          recordEvent({ event: ++eventNumber, type: "ai-decision", elapsedMs: elapsed(), detail: clone(detail) });
          requestPlaytestSave();
          return;
        }
        if (type === "guess") {
          const event = { event: ++eventNumber, type: "guess", elapsedMs: elapsed(), responder: names[detail.responder] || detail.responder, isAi: detail.isAi, targetSlot: detail.targetSlot, targetLength: detail.targetLength, actualAnswer: detail.actualAnswer, revealedLettersBefore: detail.revealedLetters, neighboringWordsBefore: detail.neighboringWords, guessedWord: detail.guessedWord, result: detail.result, points: detail.points, revealedStateAfter: detail.revealedAfter };
          for (const key of ['wrongStreakBefore','wrongStreakAfter','hintThreshold','hintTriggered','hintCompleted','hintReason','hintLocation','hintId','hintTriggeredAtCommit','hintPendingDisplay'])
            if (detail[key] !== undefined) event[key] = clone(detail[key]);
          if (detail.isAi && pendingDecision) { event.decision = pendingDecision; pendingDecision = null; }
          if (state.session.predictionMode === 'human-playtest') {
            // Correctness was emitted only by the submission path. Never retain
            // unexposed answer spellings even in post-submission playtest logs.
            delete event.actualAnswer;
          }
          recordEvent(event);
          requestPlaytestSave();
          return;
        }
        if (type === 'guess-submitted' && detail.candidateProviderVersion) lastPilotSubmission = clone(detail);
        if (type === 'guess-displayed' && lastPilotSubmission && detail.actor === lastPilotSubmission.actor) detail = { ...lastPilotSubmission, ...detail };
        recordEvent({ event: ++eventNumber, type, elapsedMs: elapsed(), detail: clone(detail) });
        if (type === "complete") void finish(detail);
        else requestPlaytestSave();
      } catch (error) { console.debug("Gameplay diagnostic logger failed; continuing game normally.", error); }
    },
  };
  logger.flush = () => savePlaytest();
  logger.getStatus = () => ({ bufferedEvents: playtestSessions.reduce((n, session) => n + session.events.length, 0),
    bufferedBytes: playtestSessions.reduce((n, session) => n + session.bufferBytes, 0),
    saveInFlight: Boolean(playtestSaveInFlight), lastSaveError,
    maxChunkEvents: MAX_CHUNK_EVENTS, maxChunkBytes: MAX_CHUNK_BYTES });
  global.addEventListener?.('pagehide', () => { void savePlaytest(true); });
  global.document?.addEventListener('visibilitychange', () => {
    if (global.document.visibilityState === 'hidden') void savePlaytest(true);
  });
  global.GGGGameplayLogger = logger;
})(window);
