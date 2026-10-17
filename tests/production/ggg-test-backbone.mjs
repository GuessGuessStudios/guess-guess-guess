import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const root = fileURLToPath(new URL('../../', import.meta.url));
const defaults = { readyMs: 45000, guessMs: 15000, inferenceMs: 120000 };
const requireCondition = (condition, message) => { if (!condition) throw new Error(message); };
async function bounded(promise, ms, label) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(`${label} timed out`), { timeout: true })), ms);
  })]); } finally { clearTimeout(timer); }
}

// Runs in the page. It observes rendered public properties; never dataset.letter.
function installObserver() {
  const state = window.__gggProductionTest = { events: [], errors: [], started: performance.now() };
  state.readUi = () => [...document.querySelectorAll('.word-group')].map(group => {
    const letters = [...group.querySelectorAll('.letter-block')];
    return { solved: group.classList.contains('revealed'),
      visibleToken: [...group.children].map(child => child.classList.contains('letter-block')
        ? (child.dataset.revealed === 'true' ? child.textContent : '_') + (child.dataset.trailing || '')
        : child.classList.contains('punct') ? child.textContent : '').join(''),
      casePattern: letters.map(b => b.classList.contains('capital-letter') ? 'U' : 'l').join(''),
      revealed: letters.map(b => b.dataset.revealed === 'true') };
  });
  document.addEventListener('DOMContentLoaded', () => {
    const logger = window.GGGGameplayLogger;
    if (!logger?.observe) { state.errors.push('Production diagnostic observer unavailable'); return; }
    const original = logger.observe;
    logger.observe = function(type, detail) {
      try {
        const copy = structuredClone(detail || {});
        delete copy.actualAnswer;
        if (type === 'start') delete copy.puzzleText;
        state.events.push({ sequence: state.events.length + 1,
          elapsedMs: performance.now() - state.started, type, detail: copy });
      } catch (error) { state.errors.push(String(error)); }
      return original.apply(this, arguments);
    };
  }, { once: true });
}

function validate(input) {
  requireCondition(input && typeof input.puzzle === 'string' && input.puzzle.trim(), 'puzzle must be nonempty text');
  requireCondition(Object.keys(input).every(k => ['puzzle', 'setupGuesses', 'releaseState', 'timeouts'].includes(k)), 'Unsupported input field');
  const release = input.releaseState;
  requireCondition(Array.isArray(release?.visibleTokens) && release.visibleTokens.length > 1, 'Expected public tokens required');
  const { visibleTokens, targetSlot, targetCasePattern } = release;
  requireCondition(Number.isInteger(targetSlot) && targetSlot >= 0 && targetSlot < visibleTokens.length, 'Invalid target slot');
  requireCondition(typeof targetCasePattern === 'string' && /^[Ul]+$/.test(targetCasePattern), 'Explicit target case pattern required');
  requireCondition(visibleTokens.every((token, i) => typeof token === 'string' && token.length &&
    (i === targetSlot ? /^_+[.!?,;:]*$/.test(token) : !token.includes('_'))), 'Version 1 requires one wholly hidden target');
  requireCondition((visibleTokens[targetSlot].match(/_/g) || []).length === targetCasePattern.length, 'Target length/case mismatch');
  const guesses = input.setupGuesses;
  requireCondition(Array.isArray(guesses) && guesses.length === visibleTokens.length - 1, 'Supply one guess per prerequisite');
  requireCondition(new Set(guesses.map(g => g.slot)).size === guesses.length && guesses.every(g =>
    Number.isInteger(g.slot) && g.slot >= 0 && g.slot < visibleTokens.length && g.slot !== targetSlot &&
    typeof g.word === 'string' && /^[A-Za-z]+$/.test(g.word)), 'Invalid or duplicate setup guess');
  requireCondition(Object.keys(input.timeouts || {}).every(k => Object.hasOwn(defaults, k)), 'Unsupported timeout field');
  const timeouts = { ...defaults, ...input.timeouts };
  requireCondition(Object.values(timeouts).every(n => Number.isFinite(n) && n > 0), 'Timeouts must be positive milliseconds');
  return timeouts;
}
function matchesUi(ui, release) {
  return ui.length === release.visibleTokens.length && ui.every((slot, i) =>
    slot.visibleToken === release.visibleTokens[i] && slot.solved === (i !== release.targetSlot) &&
    slot.revealed.every(value => value === (i !== release.targetSlot))) &&
    ui[release.targetSlot].casePattern === release.targetCasePattern;
}
function matchesBoard(board, release) {
  return board?.slots?.length === release.visibleTokens.length &&
    JSON.stringify(board.visible_tokens) === JSON.stringify(release.visibleTokens) &&
    board.slots.every((slot, i) => slot.solved === (i !== release.targetSlot) && slot.public_rejections?.length === 0) &&
    board.slots[release.targetSlot].case_pattern === release.targetCasePattern;
}

/** One isolated, gated setup and one production opportunity. No semantic verdict. */
export async function runProductionTest(input) {
  const result = {
    readiness: { pageReady: false, puzzleLoaded: false, wordGroupCount: null, dictionaryReady: false },
    setupGuessResults: [], releaseStateReached: false, releaseUiEvidence: null,
    releasePublicBoard: null, releaseBoardKey: null, releaseBoundarySequence: null, opportunityId: null,
    events: [], candidateSelected: null, guessSubmitted: null, refereeResult: null,
    stopReason: null, failure: null, errors: { browser: [], runtime: [], network: [], observer: [] },
    diagnostics: { phaseTrace: [], lastWait: null, runtimeIdentity: null, serverPid: null,
      routeHits: { list: 0, puzzle: 0 }, serverOutput: '' },
    cleanup: { browserClosed: false, serverStopped: false, temporaryArtifactsRemoved: false, errors: [] }
  };
  let phase = 'environment', server, serverClosed, browser, context, page, closing = false, timeouts;
  let signalFailure;
  const fatal = new Promise(resolve => { signalFailure = resolve; });
  const failFrom = (origin, message) => {
    if (closing) return;
    result.errors[origin].push(String(message));
    signalFailure(Object.assign(new Error(String(message)), { origin }));
  };
  const checked = promise => Promise.race([promise, fatal.then(error => { throw error; })]);
  const enter = name => { phase = name; result.diagnostics.phaseTrace.push({ phase, at: new Date().toISOString() }); };
  const interrupt = () => failFrom('browser', 'Run interrupted by process signal');
  process.on('SIGINT', interrupt); process.on('SIGTERM', interrupt);
  async function capture() {
    if (!page || page.isClosed()) return;
    const observed = await bounded(page.evaluate(() => ({ events: window.__gggProductionTest?.events || [],
      errors: window.__gggProductionTest?.errors || [] })), 3000, 'Evidence collection');
    result.events = observed.events; result.errors.observer = observed.errors;
  }
  async function wait(label, predicate, arg, ms) {
    result.diagnostics.lastWait = { phase, label, timeoutMs: ms };
    const handle = await checked(page.waitForFunction(predicate, arg, { timeout: ms }));
    try { return await handle.jsonValue(); } finally { await handle.dispose(); }
  }
  try {
    enter('environment'); timeouts = validate(input);
    const port = Number(process.env.GGG_TEST_PORT || 8766), base = `http://127.0.0.1:${port}`;
    requireCondition(Number.isInteger(port) && port >= 1024 && port <= 65535, 'Invalid GGG_TEST_PORT');
    requireCondition(process.env.CHROME_EXECUTABLE, 'Set CHROME_EXECUTABLE to the isolated test browser executable');
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
    await new Promise((resolve, reject) => {
      const probe = net.createServer(); probe.once('error', reject);
      probe.listen(port, '127.0.0.1', () => probe.close(resolve));
    });
    server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'] });
    result.diagnostics.serverPid = server.pid;
    serverClosed = new Promise(resolve => server.once('close', resolve));
    server.on('error', error => failFrom('runtime', error.message));
    server.on('exit', (code, signal) => failFrom('runtime', `Owned server exited: ${code ?? signal}`));
    await checked(bounded(new Promise(resolve => {
      server.stdout.on('data', chunk => {
        result.diagnostics.serverOutput = (result.diagnostics.serverOutput + chunk).slice(-16384);
        if (result.diagnostics.serverOutput.includes(`running at ${base}`)) resolve();
      });
      server.stderr.on('data', chunk => { result.diagnostics.serverOutput = (result.diagnostics.serverOutput + chunk).slice(-16384); });
    }), 15000, 'Server readiness'));
    const identity = await checked(fetch(base + '/api/runtime-info', { signal: AbortSignal.timeout(5000) }).then(r => r.json()));
    const hash = createHash('sha256').update(await readFile(new URL('../../game.js', import.meta.url))).digest('hex');
    requireCondition(identity.pid === server.pid && identity.gameJsHash === hash, 'Server/runtime identity mismatch');
    result.diagnostics.runtimeIdentity = identity;
    browser = await checked(chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE, timeout: 15000 }));
    browser.on('disconnected', () => failFrom('browser', 'Browser disconnected'));
    context = await checked(browser.newContext()); page = await checked(context.newPage()); page.setDefaultTimeout(timeouts.guessMs);
    page.on('pageerror', error => failFrom('runtime', error.message));
    page.on('console', message => { if (message.type() === 'error') failFrom('runtime', message.text()); });
    page.on('requestfailed', request => failFrom('network', `${request.url()}: ${request.failure()?.errorText}`));
    page.on('response', response => { if (response.status() >= 400) failFrom('network', `${response.status()} ${response.url()}`); });
    await page.addInitScript(installObserver);
    await page.route('**/puzzles/puzzle-list.json', route => {
      result.diagnostics.routeHits.list++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(['/puzzles/puzzle-001.json']) });
    });
    await page.route('**/puzzles/puzzle-001.json', route => {
      result.diagnostics.routeHits.puzzle++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: input.puzzle, image: null }) });
    });
    enter('readiness');
    await checked(page.goto(base + '/?humanPlaytestMode=1&ettinPilot=1&humanPlaytestSetup=1', { waitUntil: 'load', timeout: timeouts.readyMs }));
    result.readiness.pageReady = true;
    await wait('Rendered groups and real dictionary', count => document.querySelectorAll('.word-group').length === count &&
      window.vault4Dictionary?.ready === true && window.vault4Dictionary?.dictionary?.ready === true &&
      window.vault4Dictionary.dictionary.getStats().acceptedWordCount > 0, input.releaseState.visibleTokens.length, timeouts.readyMs);
    result.readiness.puzzleLoaded = result.diagnostics.routeHits.list > 0 && result.diagnostics.routeHits.puzzle > 0;
    requireCondition(result.readiness.puzzleLoaded, 'Temporary puzzle did not use both production routes');
    await checked(page.locator('#startGameBtn').click());
    await wait('Game started with setup gate', () => document.querySelector('#startGameBtn').textContent === 'Game Started' &&
      !document.querySelector('#humanRaiseHandBtn').disabled &&
      window.__gggProductionTest.events.some(e => e.type === 'human-playtest-setup-started'), null, timeouts.readyMs);
    enter('setup');
    for (const step of input.setupGuesses) {
      const beforeSequence = await page.evaluate(() => window.__gggProductionTest.events.length);
      await wait('Raise Hand enabled', () => !document.querySelector('#humanRaiseHandBtn').disabled, null, timeouts.guessMs);
      await checked(page.locator('#humanRaiseHandBtn').click());
      await wait('Human recognized', () => document.querySelector('#humanRaiseHandBtn').textContent === 'Hand Raised' &&
        document.querySelector('#teacherMessage').textContent === 'Go ahead!', null, timeouts.guessMs);
      const group = page.locator('.word-group').nth(step.slot);
      requireCondition(!await group.evaluate(g => g.classList.contains('revealed')), `Setup slot ${step.slot} already solved`);
      await checked(group.click());
      await wait('Word selected and focused', index => { const g = document.querySelectorAll('.word-group')[index];
        return g.classList.contains('selected') && document.activeElement === g; }, step.slot, timeouts.guessMs);
      await checked(page.keyboard.type(step.word)); await checked(page.keyboard.press('Enter'));
      const guess = await wait('Human referee result', ({ slot, sequence }) => window.__gggProductionTest.events.find(e =>
        e.sequence > sequence && e.type === 'guess' && e.detail.responder === 'human' && e.detail.targetSlot === slot),
      { slot: step.slot, sequence: beforeSequence }, timeouts.guessMs);
      result.setupGuessResults.push({ ...step, event: guess, revealCompleted: false });
      requireCondition(guess.detail.result === 'correct', `Setup guess rejected: slot ${step.slot}, result ${guess.detail.result}`);
      await wait('Completed production reveal', index => { const g = document.querySelectorAll('.word-group')[index];
        return g.classList.contains('revealed') && [...g.querySelectorAll('.letter-block')].every(b => b.dataset.revealed === 'true');
      }, step.slot, timeouts.guessMs);
      result.setupGuessResults.at(-1).revealCompleted = true;
      await capture();
      requireCondition(!result.events.some(e => (e.type === 'guess' && e.detail.isAi) ||
        ['ai-hand-raised', 'stage1-candidate-prepared', 'ettin-input'].includes(e.type)), 'Autonomous activity during gated setup');
      const ui = await page.evaluate(() => window.__gggProductionTest.readUi());
      if (matchesUi(ui, input.releaseState)) { result.releaseUiEvidence = ui; result.releaseStateReached = true; break; }
    }
    requireCondition(result.releaseStateReached, 'Exact release UI state was not reached');
    const lastPublic = result.events.findLast(e => e.detail.publicBoard)?.detail.publicBoard;
    requireCondition(lastPublic?.slots?.every(slot => slot.public_rejections?.length === 0), 'Release has public rejections or lacks public evidence');
    requireCondition(result.errors.observer.length === 0, 'Diagnostic capture failed during setup');
    enter('release');
    requireCondition(await checked(page.evaluate(() => window.releaseHumanPlaytestSetupForTesting())), 'Setup gate release returned false');
    await capture();
    const boundary = result.events.filter(e => e.type === 'human-playtest-setup-released');
    requireCondition(boundary.length === 1, 'Expected exactly one setup release event');
    result.releaseBoundarySequence = boundary[0].sequence;
    enter('observation');
    const deadline = Date.now() + timeouts.inferenceMs;
    const remaining = () => Math.max(1, deadline - Date.now());
    const first = await wait('First production public board or terminal event', sequence => window.__gggProductionTest.events.find(e =>
      e.sequence > sequence && (e.detail.publicBoard || (e.type === 'ai-opportunity' && e.detail.transition === 'board-empty'))),
    result.releaseBoundarySequence, remaining());
    if (!first.detail.publicBoard) result.stopReason = 'production-terminal';
    else {
      result.releasePublicBoard = first.detail.publicBoard; result.releaseBoardKey = first.detail.publicBoardKey;
      result.opportunityId = first.detail.opportunityId;
      requireCondition(matchesBoard(result.releasePublicBoard, input.releaseState), 'First inference board differs from clean release state');
      requireCondition(result.releaseBoardKey && result.opportunityId && first.detail.targetSlot === input.releaseState.targetSlot,
        'First opportunity lacks a matching target/key/identity');
      const observed = await wait('Same-opportunity submission and referee, or termination', scope => {
        const events = window.__gggProductionTest.events.filter(e => e.sequence > scope.boundary);
        const matching = e => e.detail.publicBoardKey === scope.key && e.detail.opportunityId === scope.id && e.detail.targetSlot === scope.slot;
        const selected = events.filter(e => matching(e) && e.type === 'candidate-selected');
        const submitted = events.filter(e => matching(e) && e.type === 'guess-submitted');
        const guesses = events.filter(e => e.type === 'guess' && e.detail.isAi);
        if (guesses.length) {
          const guess = guesses[0], submission = submitted[0], selection = selected[0];
          const linked = selected.length === 1 && submitted.length === 1 && selection.sequence < submission.sequence &&
            submission.sequence < guess.sequence && selection.detail.selectedGuess === submission.detail.submittedGuess &&
            guess.detail.targetSlot === scope.slot &&
            guess.detail.responder === submission.detail.character && guess.detail.guessedWord === submission.detail.submittedGuess;
          return { kind: linked ? 'referee' : 'ambiguous', selection, submission, guess };
        }
        const terminal = events.find(e => e.type === 'complete' || e.detail.discarded ||
          (e.type === 'ai-opportunity' && ['board-empty', 'opportunity-cancelled', 'submission-rejected-before-commit'].includes(e.detail.transition)) ||
          (e.detail.opportunityId && e.detail.opportunityId !== scope.id));
        return terminal ? { kind: 'production-terminal', terminal } : false;
      }, { boundary: result.releaseBoundarySequence, key: result.releaseBoardKey, id: result.opportunityId,
        slot: input.releaseState.targetSlot }, remaining());
      result.candidateSelected = observed.selection || null; result.guessSubmitted = observed.submission || null;
      result.refereeResult = observed.guess || null;
      requireCondition(observed.kind !== 'ambiguous', 'Cannot link referee result to exactly one selected/submitted candidate');
      result.stopReason = observed.kind;
    }
  } catch (error) {
    result.stopReason = error.timeout || error.name === 'TimeoutError' ? 'timeout' : 'error';
    result.failure = { category: phase, phase, message: error.message, details: { origin: error.origin || 'undetermined', stack: error.stack } };
  } finally {
    // Preserve evidence before closing anything; no persistence/network-drain wait.
    try { await capture(); } catch (error) { result.errors.observer.push(error.message); }
    if (page && !page.isClosed()) {
      try { Object.assign(result.readiness, await bounded(page.evaluate(() => ({
        wordGroupCount: document.querySelectorAll('.word-group').length,
        dictionaryReady: window.vault4Dictionary?.ready === true && window.vault4Dictionary?.dictionary?.ready === true &&
          window.vault4Dictionary.dictionary.getStats().acceptedWordCount > 0 })), 3000, 'Final readiness evidence')); }
      catch (error) { result.errors.observer.push(error.message); }
    }
    closing = true; enter('cleanup');
    const clean = async (label, action) => { try { await bounded(action(), 5000, label); return true; }
      catch (error) { result.cleanup.errors.push(`${label}: ${error.message}`); return false; } };
    if (context) await clean('Context close', () => context.close());
    result.cleanup.browserClosed = !browser || await clean('Browser close', () => browser.close());
    result.cleanup.temporaryArtifactsRemoved = result.cleanup.browserClosed; // Only Playwright-owned temporary browser state.
    if (server?.pid && server.exitCode === null && server.signalCode === null) {
      server.kill('SIGTERM');
      if (!await clean('Server exit', () => serverClosed)) {
        server.kill('SIGKILL'); await clean('Owned server forced exit', () => serverClosed);
      }
    }
    result.cleanup.serverStopped = !server?.pid || server.exitCode !== null || server.signalCode !== null;
    process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
    if (!result.failure && (result.cleanup.errors.length || result.errors.observer.length)) {
      result.failure = { category: result.cleanup.errors.length ? 'cleanup' : 'observation', phase,
        message: 'Cleanup or evidence collection was incomplete', details: {} }; result.stopReason = 'error';
    }
  }
  return result;
}
