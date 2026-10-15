// Bounded smoke sessions on ordinary game puzzles, never research/development data.
// Requires local server and Playwright. Timer acceleration exists in this test only.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  // Only Playwright's bundled headless Chromium. No system-browser executable,
  // channel, persistent user profile, CDP connection, or existing browser process.
  // launch() creates and owns a fresh temporary profile, cleaned up on close().
  const browser = await chromium.launch({ headless: true, timeout: 15000 });
  try {
    const page = await browser.newPage();
    const errors = [], saves = [], forbiddenRequests = [], students = new Set();
    let punctuatedGuesses = 0, completedHints = 0, functionGuesses = 0;
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && /candidate pool|TypeError|ReferenceError|playtest/i.test(message.text())) errors.push(message.text()); });
    page.on('request', request => { if (/vault-[235]\.json/.test(request.url())) forbiddenRequests.push(request.url()); });
    await page.route('**/api/human-playtest-logs', async route => {
      const body = route.request().postDataJSON();
      body.session.sessionId = 'sample-' + body.session.sessionId;
      body.session.automatedSmokeTest = true;
      saves.push(body);
      await route.continue({ postData: JSON.stringify(body) });
    });
    await page.addInitScript(() => {
      const realTimeout = window.setTimeout.bind(window);
      window.setTimeout = (fn, ms, ...args) => realTimeout(fn, Math.min(Number(ms) || 0, 30), ...args);
      window.__smokeEvents = [];
      window.__smokeCommitted = false;
      window.__smokeHintChecks = [];
      // Check inference's input shape in the running browser, too.
      document.addEventListener('DOMContentLoaded', () => {
        const logger = window.GGGGameplayLogger.observe;
        window.GGGGameplayLogger.observe = function(type, detail) {
          if (type === 'hint-display' && detail.hintVisible) {
            const g = document.querySelectorAll('.word-group')[detail.hintLocation.slot];
            const b = g.querySelectorAll('.letter-block')[detail.hintLocation.letterIndex];
            window.__smokeHintChecks.push(b.dataset.revealed === 'true' && b.textContent.length === 1 && !document.querySelector('.wrong-guess') && !document.querySelector('[data-wrong-snapshot-letter]'));
          }
          if (['start','ai-decision','ai-opportunity','guess','hint-display','complete'].includes(type)) window.__smokeEvents.push({type, detail});
          return logger.call(this, type, detail);
        };
      });
    });
    await page.goto('http://127.0.0.1:8765/?humanPlaytestMode=1');
    await page.waitForFunction(() => document.querySelectorAll('.word-group .letter-block').length > 0 && window.vault4Dictionary?.ready);
    assert((await page.locator('#runtimeBuildMarker').textContent()).includes('HUMAN PLAYTEST ON'));
    for (let game = 0; game < 3; game++) {
      const before = saves.length;
      await page.locator('#startGameBtn').click();
      await page.waitForFunction(() => document.querySelector('#startGameBtn').textContent === 'Game Started');
      // A bounded session: at least 18 committed guesses or natural completion.
      await page.waitForFunction(() => {
        const events = window.__smokeEvents, start = events.map(e => e.type).lastIndexOf('start');
        return events.slice(start).filter(e => e.type === 'guess').length >= 18 || events.slice(start).some(e => e.type === 'complete');
      }, null, { timeout: 60000 });
      await page.waitForFunction(() => {
        const ev = window.__smokeEvents, start = ev.map(e=>e.type).lastIndexOf('start'), current = ev.slice(start);
        return current.filter(e=>e.type==='guess' && e.detail.hintTriggered).every(g=>current.some(e=>e.type==='hint-display' && e.detail.hintVisible && e.detail.hintId===g.detail.hintId));
      });
      if (!await page.locator('#endGameBtn').isDisabled()) await page.locator('#endGameBtn').click();
      // Wait for the queued session save, not merely its in-memory observation.
      await page.waitForTimeout(750);
      const latest = saves.slice(before).at(-1);
      assert(latest?.finished, 'ended session persisted');
      assert(!('puzzleText' in latest.session));
      const guesses = latest.events.filter(e => e.type === 'guess' && e.isAi);
      assert(guesses.length > 0);
      const rejected = new Set();
      let wrongStreak = 0;
      for (const g of guesses) {
        assert.equal(g.wrongStreakBefore, wrongStreak);
        wrongStreak = g.result === 'incorrect' ? wrongStreak + 1 : 0;
        assert.equal(g.hintThreshold, 5);
        assert.equal(g.hintTriggered, wrongStreak === 5);
        assert.equal(g.hintTriggeredAtCommit, g.hintTriggered);
        assert.equal(g.hintPendingDisplay, g.hintTriggered);
        assert.equal(g.hintCompleted, false);
        if (g.hintTriggered) assert(latest.events.some(e=>e.event>g.event && e.type==='hint-display' && e.detail.hintId===g.hintId && e.detail.hintVisible && e.detail.wrongPreviewCleared));
        if (g.hintTriggered) { completedHints++; wrongStreak = 0; }
        assert.equal(g.wrongStreakAfter, wrongStreak);
        assert(g.decision, 'decision attached to each guess');
        assert.equal(g.decision.predictionMode, 'human-playtest');
        assert.equal(g.decision.engineVersion, 'human-playtest-upgrade-1-repair-4');
        assert(g.decision.convergence >= 0 && g.decision.convergence <= 1);
        assert(g.decision.lexicalClass);
        students.add(g.responder);
        if ('and or but at in on to of for from with his her my your our their the a an any all some not is are has have do does'.split(' ').includes(g.guessedWord.toLowerCase())) functionGuesses++;
        if (/['-]/.test(g.guessedWord)) punctuatedGuesses++;
        assert.match(g.decision.boardId, /^public-[0-9a-f]{8}$/);
        assert(g.decision.topSlotOpportunities.some(s => s.slotIndex === g.targetSlot));
        assert(g.decision.candidateCounts.allLegitimateMatches >= g.decision.candidateCounts.selectionBand);
        assert(Array.isArray(g.decision.majorEvidence));
        assert(!('isCorrect' in g.decision) && !('result' in g.decision));
        assert([...g.decision.visiblePattern].every((c,i) => c === '_' || c.toLowerCase() === g.guessedWord[i].toLowerCase()));
        assert(!('actualAnswer' in g));
        const key = g.targetSlot + ':' + g.guessedWord.toLowerCase();
        assert(!rejected.has(key), 'no repeated rejected word');
        if (g.result === 'incorrect') rejected.add(key);
        assert(g.decision.finalCandidateSelectionBand.some(c => c.normalized === g.guessedWord.toLowerCase()));
        assert.notEqual(g.decision.grammarState, 'ELIGIBLE_CONFLICT');
      }
      assert(await page.evaluate(() => window.__smokeHintChecks.every(Boolean)), 'hint visible only after temporary preview clears');
      const transitions = latest.events.filter(e => e.type === 'ai-opportunity');
      const committed = transitions.filter(e => e.detail.transition === 'guess-committed');
      assert.equal(committed.length, guesses.length, 'every real AI submission has a commit transition');
      for (const commit of committed) {
        const flow = transitions.filter(e => e.detail.opportunity === commit.detail.opportunity).map(e => e.detail.transition);
        assert.deepEqual(flow, ['candidate-ready','hand-raised','recognized','submission-attempted','guess-committed']);
      }
      for (const hand of transitions.filter(e => e.detail.transition === 'hand-raised')) {
        assert(transitions.some(e => e.event < hand.event && e.detail.opportunity === hand.detail.opportunity && e.detail.transition === 'candidate-ready'));
      }
      console.log(JSON.stringify({ sample:game+1, puzzle:latest.session.puzzleNumber,
        guesses:guesses.length, characters:[...new Set(guesses.map(e => e.responder))],
        lowerRankSelections:guesses.filter(g => g.decision.candidateRankBeforeRandomSelection > 1).length,
        wrong:guesses.filter(g => g.result === 'incorrect').length,
        log:'gameplay-logs/human-playtest/gameplay-' + latest.session.sessionId + '.json' }));
      // Verify the file actually arrived through the real server endpoint.
      const response = await page.request.get('http://127.0.0.1:8765/gameplay-logs/human-playtest/gameplay-' + latest.session.sessionId + '.json');
      assert.equal(response.status(),200);
      assert((await response.json()).finished);
      if (game < 2) {
        // Include a punctuation-bearing ordinary game in this single smoke run.
        for (let step = 0; step < (game === 1 ? 5 : 1); step++) {
          const label = await page.locator('#currentPuzzleNumber').textContent();
          await page.locator('#nextPuzzleBtn').click();
          await page.waitForFunction(old => document.querySelector('#currentPuzzleNumber').textContent !== old && !document.querySelector('#startGameBtn').disabled, label);
        }
      }
    }
    // Synthetic, unsupported public pattern: no invented fallback, no raised
    // hand loop, and a human can still take a turn. No production puzzle edits.
    await page.route('**/puzzles/puzzle-001.json', route => route.fulfill({
      contentType: 'application/json', body: JSON.stringify({text:'Qzxqzxqzxaaa.', image:null})
    }));
    await page.goto('http://127.0.0.1:8765/?humanPlaytestMode=1');
    await page.waitForFunction(() => document.querySelectorAll('.word-group .letter-block').length === 12 && window.vault4Dictionary?.ready);
    await page.evaluate(() => {
      const blocks = document.querySelectorAll('.word-group .letter-block');
      [...'Qzxqzxqzx'].forEach((letter, i) => { blocks[i].dataset.revealed = 'true'; blocks[i].textContent = letter; });
    });
    const unsupportedBefore = saves.length;
    await page.locator('#startGameBtn').click();
    await page.waitForFunction(() => window.__smokeEvents.some(e => e.type === 'ai-opportunity' && e.detail.transition === 'opportunity-cancelled' && e.detail.reason === 'no-valid-slot'));
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => window.__smokeEvents.filter(e => e.type === 'ai-opportunity' && e.detail.transition === 'hand-raised').length), 0);
    assert(!await page.locator('#humanRaiseHandBtn').isDisabled());
    await page.locator('#humanRaiseHandBtn').click();
    assert.equal(await page.locator('#humanRaiseHandBtn').textContent(), 'Hand Raised');
    await page.locator('#endGameBtn').click();
    await page.waitForTimeout(750);
    const unsupported = saves.slice(unsupportedBefore).at(-1);
    assert(unsupported?.finished);
    const persisted = await page.request.get('http://127.0.0.1:8765/gameplay-logs/human-playtest/gameplay-' + unsupported.session.sessionId + '.json');
    assert.equal(persisted.status(), 200);
    assert((await persisted.json()).events.some(e => e.type === 'ai-opportunity' && e.detail.reason === 'no-valid-slot'));
    assert(functionGuesses > 0, 'closed-class words reached real submission');
    assert(completedHints >= 2, 'multiple five-wrong hint cycles completed');
    assert.deepEqual(forbiddenRequests, []);
    assert.deepEqual(errors, []);
    assert.equal(students.size, 4);
    assert(punctuatedGuesses > 0, 'punctuated tokens reached actual submission and persisted logs');
    console.log('PASS three bounded isolated Chromium play sessions plus unsupported-pattern check: four students, exact punctuation, prepared hands, committed transitions, multiple exact five-wrong hint cycles without preview overlap, responsive human turn, persisted logs, no V2/V3/V5 requests or runtime errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
