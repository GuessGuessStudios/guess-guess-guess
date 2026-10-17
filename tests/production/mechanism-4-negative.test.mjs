import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { runProductionTest } from './ggg-test-backbone.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const words = ['The', 'teacher', 'owns', 'the', 'dog', 'The', 'cat', 'belongs', 'to', 'the'];
const fixture = {
  puzzle: 'The teacher owns the dog. The cat belongs to the teacher.',
  setupGuesses: words.map((word, slot) => ({ slot, word })),
  releaseState: { visibleTokens: ['The', 'teacher', 'owns', 'the', 'dog.', 'The', 'cat', 'belongs', 'to', 'the', '_______.'],
    targetSlot: 10, targetCasePattern: 'lllllll' }
};
const protectedFiles = ['game.js', 'human-playtest.js', 'public-board.js', 'gameplay-logger.js', 'server.js',
  'ai-logic-settings.json', 'assets/ettin/ettin-provider.js', 'assets/language/human-playtest-language.json',
  'assets/dictionary/en_US-size-60.txt'];
const hashes = async () => Object.fromEntries(await Promise.all(protectedFiles.map(async file =>
  [file, createHash('sha256').update(await readFile(root + file)).digest('hex')])));
function cleaned(result) {
  assert.equal(result.cleanup.browserClosed, true);
  assert.equal(result.cleanup.serverStopped, true);
  assert.equal(result.cleanup.temporaryArtifactsRemoved, true);
  assert.deepEqual(result.cleanup.errors, []);
}
function verifyNegative(result) {
  assert.equal(result.failure, null, JSON.stringify(result.failure));
  assert.equal(result.stopReason, 'referee'); cleaned(result);
  assert.deepEqual(result.readiness, { pageReady: true, puzzleLoaded: true, wordGroupCount: 11, dictionaryReady: true });
  assert.equal(result.releaseStateReached, true);
  assert.deepEqual(result.releasePublicBoard.visible_tokens, fixture.releaseState.visibleTokens);
  assert.equal(result.releasePublicBoard.target_slot_id, 'slot-10');
  result.releasePublicBoard.slots.forEach((slot, i) => {
    assert.equal(slot.solved, i !== 10); assert.deepEqual(slot.public_rejections, []);
    if (i === 10) { assert.equal(slot.pattern, '_______'); assert.equal(slot.case_pattern, 'lllllll'); }
  });
  assert.equal(result.setupGuessResults.length, 10);
  result.setupGuessResults.forEach((guess, i) => {
    assert.equal(guess.slot, i); assert.equal(guess.word, words[i]); assert.equal(guess.revealCompleted, true);
    assert.equal(guess.event.detail.responder, 'human'); assert.equal(guess.event.detail.result, 'correct');
  });
  const setup = result.events.filter(e => e.sequence < result.releaseBoundarySequence);
  assert.equal(setup.some(e => (e.type === 'guess' && e.detail.isAi) ||
    ['ai-hand-raised', 'stage1-candidate-prepared', 'ettin-input'].includes(e.type)), false);
  const scoped = result.events.filter(e => e.sequence > result.releaseBoundarySequence &&
    e.detail.publicBoardKey === result.releaseBoardKey && e.detail.opportunityId === result.opportunityId && e.detail.targetSlot === 10);
  const event = type => { const found = scoped.find(e => e.type === type); assert(found, `Missing ${type}`); return found.detail; };
  const recognition = event('ettin-adjacent-ownership-recognition');
  assert.equal(recognition.mechanismVersion, 'adjacent-ownership-nomination-v1');
  assert.equal(recognition.reason, 'owned-animal-mismatch'); assert.equal(recognition.nominee, undefined);
  const admissions = scoped.filter(e => e.type.endsWith('-nomination'));
  assert(admissions.length > 0, 'Shared admission evidence required');
  admissions.forEach(({ detail }) => {
    assert.equal(detail.evidenceAdditionCount, 0);
    assert.equal(detail.finalCandidateCount, detail.ordinaryCandidateCount);
    assert(!detail.contributingProviders?.includes('adjacent-ownership-nomination-v1'));
  });
  const input = event('ettin-input'), scored = event('ettin-scored'); event('ettin-stage3-ranked');
  const selected = event('candidate-selected'); event('guess-submitted');
  assert.equal(result.candidateSelected.detail.selectedGuess, selected.selectedGuess);
  assert.equal(result.refereeResult.detail.isAi, true);
  assert.equal(result.refereeResult.detail.guessedWord, selected.selectedGuess);
  assert(['correct', 'incorrect'].includes(result.refereeResult.detail.result)); // Either result is valid.
  assert.equal(scoped.some(e => e.detail.discarded || String(e.detail.reason || '').startsWith('stale')), false);
  Object.values(result.errors).forEach(errors => assert.deepEqual(errors, []));
  console.log('PASS mechanism-4 negative', JSON.stringify({ board: result.releasePublicBoard.visible_tokens.join(' '),
    reason: recognition.reason, nominee: null, ordinaryCount: admissions[0].detail.ordinaryCandidateCount,
    finalCount: admissions[0].detail.finalCandidateCount, evidenceAdditionCount: 0,
    teacherInOrdinaryPool: input.ettinCandidates.includes('teacher'),
    teacherEttin: scored.rankedCandidates.find(c => c.word === 'teacher') || null,
    selected: selected.selectedGuess, referee: result.refereeResult.detail.result, eventCount: result.events.length }));
}
async function environmentCheck(name, key, value) {
  const previous = process.env[key];
  try {
    process.env[key] = value;
    const result = await runProductionTest(fixture);
    assert.equal(result.failure?.category, 'environment'); cleaned(result);
    console.log('PASS failure path', name);
  } finally { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; }
}
async function failureChecks() {
  await environmentCheck('missing Playwright module', 'PLAYWRIGHT_MODULE', 'file:///__ggg_missing_playwright__.mjs');
  await environmentCheck('missing browser executable', 'CHROME_EXECUTABLE', '/__ggg_missing_chrome__');
  const holder = net.createServer();
  await new Promise((resolve, reject) => { holder.once('error', reject); holder.listen(Number(process.env.GGG_TEST_PORT || 8766), '127.0.0.1', resolve); });
  try {
    const result = await runProductionTest(fixture);
    assert.equal(result.failure?.category, 'environment'); assert(holder.listening); cleaned(result);
    console.log('PASS failure path occupied port; unrelated listener preserved');
  } finally { await new Promise(resolve => holder.close(resolve)); }
  for (const [name, input, category] of [
    ['readiness mismatch', { ...fixture, puzzle: 'The dog.', timeouts: { readyMs: 2000 } }, 'readiness'],
    ['setup referee rejection', { ...fixture, setupGuesses: [{ slot: 0, word: 'She' }, ...fixture.setupGuesses.slice(1)] }, 'setup'],
    ['inference deadline', { ...fixture, timeouts: { inferenceMs: 1 } }, 'observation']
  ]) {
    const result = await runProductionTest(input);
    assert.equal(result.failure?.category, category, JSON.stringify(result.failure)); cleaned(result);
    if (category === 'setup') assert.equal(result.setupGuessResults[0]?.event.detail.result, 'incorrect');
    if (category === 'observation') { assert.equal(result.stopReason, 'timeout'); assert(result.releaseBoundarySequence); }
    console.log('PASS failure path', name);
  }
}

// Separate real-browser probes: the backbone itself always uses its fixed setup mode.
async function gateIsolationChecks() {
  const port = Number(process.env.GGG_TEST_PORT || 8766), base = `http://127.0.0.1:${port}`;
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = new Promise(resolve => server.once('close', resolve));
  let browser, output = '';
  async function bounded(promise, ms) {
    let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Gate probe timeout')), ms); })]); }
    finally { clearTimeout(timer); }
  }
  try {
    await bounded(new Promise((resolve, reject) => {
      server.once('error', reject); server.once('exit', code => reject(new Error(`Gate probe server exited ${code}`)));
      server.stdout.on('data', chunk => { output += chunk; if (output.includes(`running at ${base}`)) resolve(); });
    }), 15000);
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE, timeout: 15000 });
    for (const query of ['?humanPlaytestMode=1&ettinPilot=1', '?humanPlaytestSetup=1']) {
      const context = await browser.newContext();
      try {
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => { window.__gateProbe = []; document.addEventListener('DOMContentLoaded', () => {
          const original = window.GGGGameplayLogger.observe;
          window.GGGGameplayLogger.observe = function(type, detail) { window.__gateProbe.push(type); return original.call(this, type, detail); };
        }); });
        await page.route('**/puzzles/puzzle-list.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(['/puzzles/puzzle-001.json']) }));
        await page.route('**/puzzles/puzzle-001.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: fixture.puzzle, image: null }) }));
        await page.goto(base + '/' + query, { waitUntil: 'load' });
        await page.waitForFunction(() => document.querySelectorAll('.word-group').length === 11 && window.vault4Dictionary?.ready && window.vault4Dictionary.dictionary?.ready);
        await page.locator('#startGameBtn').click();
        await page.waitForFunction(() => document.querySelector('#startGameBtn').textContent === 'Game Started');
        assert.equal(await page.evaluate(() => window.releaseHumanPlaytestSetupForTesting()), false);
        await page.waitForFunction(() => window.__gateProbe.includes('ai-hand-raised'), null, { timeout: 45000 });
        assert.equal(await page.evaluate(() => window.__gateProbe.includes('human-playtest-setup-started')), false);
        assert.deepEqual(errors, []); console.log('PASS gate inactive', query);
      } finally { await context.close(); }
    }
  } finally {
    try { if (browser) await bounded(browser.close(), 5000); }
    finally { if (server.exitCode === null && server.signalCode === null) server.kill('SIGTERM');
      try { await bounded(exited, 5000); } catch { server.kill('SIGKILL'); await bounded(exited, 5000); } }
  }
}

let result;
const before = await hashes();
try {
  result = await runProductionTest(fixture); verifyNegative(result);
  if (process.argv.includes('--failure-checks')) await failureChecks();
  if (process.argv.includes('--gate-checks')) await gateIsolationChecks();
} catch (error) {
  console.error('FAIL', error.stack);
  if (result) console.error('BACKBONE DIAGNOSTICS', JSON.stringify({ failure: result.failure,
    diagnostics: result.diagnostics, errors: result.errors, cleanup: result.cleanup,
    lastEvents: result.events.slice(-12).map(e => ({ sequence: e.sequence, type: e.type, reason: e.detail.reason })) }));
  process.exitCode = 1;
} finally {
  try { assert.deepEqual(await hashes(), before); console.log('PASS production/settings hashes unchanged'); }
  catch (error) { console.error(error); process.exitCode = 1; }
}
