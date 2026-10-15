(function (global) {
  "use strict";

  const names = { character1: "Misaki", character2: "Aoi", character3: "Taiga", character4: "Sho", human: "human" };
  let state = null;
  let eventNumber = 0;
  let pendingDecision = null;
  let lastPilotSubmission = null;
  let playtestSaveInFlight = null;
  let playtestSaveNeeded = false;

  function savePlaytest() {
    if (!state || state.session.predictionMode !== 'human-playtest') return Promise.resolve();
    playtestSaveNeeded = true;
    if (playtestSaveInFlight) return playtestSaveInFlight;
    playtestSaveInFlight = (async () => {
      while (playtestSaveNeeded) {
        playtestSaveNeeded = false;
        const snapshot = JSON.stringify(state);
        // Also retain the latest snapshot locally if the localhost service drops.
        try { global.localStorage?.setItem('ggg-human-playtest-latest', snapshot); } catch {}
        try {
          const response = await fetch('/api/human-playtest-logs', { method: 'POST',
            headers: { 'Content-Type': 'application/json' }, body: snapshot, keepalive: snapshot.length < 60000 });
          if (!response.ok) throw new Error('Playtest log save failed: ' + response.status);
        } catch (error) {
          console.debug('Playtest log remains in localStorage: ggg-human-playtest-latest', error);
        }
      }
    })().finally(() => {
      playtestSaveInFlight = null;
      if (playtestSaveNeeded) void savePlaytest();
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
          state = { session: { sessionId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, startTime: new Date().toISOString(), puzzleNumber: detail.puzzleNumber, puzzleText: detail.puzzleText, puzzleIdentity: clone(detail.puzzleIdentity), modeFlags: clone(detail.modeFlags), runtimeMode: detail.runtimeMode || null }, runtime: clone(detail.runtime || global.__GGG_RUNTIME__), settings: clone(detail.settings), events: [], finalResult: null };
          state.startedAt = Date.now(); eventNumber = 0; pendingDecision = null; lastPilotSubmission = null;
          if (detail.predictionMode === 'human-playtest') {
            state.session.predictionMode = detail.predictionMode;
            delete state.session.puzzleText;
          }
          state.events.push({ event: ++eventNumber, type: "start", elapsedMs: 0, puzzleNumber: detail.puzzleNumber });
          state.events.push({ event: ++eventNumber, type: "session-start", elapsedMs: 0, detail: { session: clone(state.session), runtime: clone(state.runtime), modeFlags: clone(detail.modeFlags), puzzleIdentity: clone(detail.puzzleIdentity) } });
          if (state.session.predictionMode === 'human-playtest') void savePlaytest();
          return;
        }
        if (!state || state.finished) return;
        if (type === "ai-decision") {
          pendingDecision = clone(detail);
          state.events.push({ event: ++eventNumber, type: "ai-decision", elapsedMs: elapsed(), detail: clone(detail) });
          if (state.session.predictionMode === 'human-playtest') void savePlaytest();
          return;
        }
        if (type === "guess") {
          const event = { event: ++eventNumber, type: "guess", elapsedMs: elapsed(), responder: names[detail.responder] || detail.responder, isAi: detail.isAi, targetSlot: detail.targetSlot, targetLength: detail.targetLength, actualAnswer: detail.actualAnswer, revealedLettersBefore: detail.revealedLetters, neighboringWordsBefore: detail.neighboringWords, guessedWord: detail.guessedWord, result: detail.result, points: detail.points, revealedStateAfter: detail.revealedAfter };
          for (const key of ['wrongStreakBefore','wrongStreakAfter','hintThreshold','hintTriggered','hintCompleted','hintReason','hintLocation','hintId','hintTriggeredAtCommit','hintPendingDisplay'])
            if (detail[key] !== undefined) event[key] = clone(detail[key]);
          if (detail.isAi && pendingDecision) { event.decision = pendingDecision; pendingDecision = null; }
          state.events.push(event);
          if (state.session.predictionMode === 'human-playtest') {
            // Correctness was emitted only by the submission path. Never retain
            // unexposed answer spellings even in post-submission playtest logs.
            delete event.actualAnswer;
            void savePlaytest();
          }
          return;
        }
        if (type === 'guess-submitted' && detail.candidateProviderVersion) lastPilotSubmission = clone(detail);
        if (type === 'guess-displayed' && lastPilotSubmission && detail.actor === lastPilotSubmission.actor) detail = { ...lastPilotSubmission, ...detail };
        state.events.push({ event: ++eventNumber, type, elapsedMs: elapsed(), detail: clone(detail) });
        if (state.session.predictionMode === 'human-playtest') void savePlaytest();
        if (type === 'hint-display' && state.session.predictionMode === 'human-playtest') void savePlaytest();
        if (type === 'ai-opportunity' && state.session.predictionMode === 'human-playtest' &&
            ['opportunity-cancelled','submission-rejected-before-commit','guess-committed'].includes(detail.transition)) void savePlaytest();
        if (type === "complete") void finish(detail);
      } catch (error) { console.debug("Gameplay diagnostic logger failed; continuing game normally.", error); }
    },
  };
  global.GGGGameplayLogger = logger;
})(window);
