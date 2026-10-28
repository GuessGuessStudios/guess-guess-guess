const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'gameplay-logger.js'), 'utf8');
let savedPayload = null;
const context = { console: { debug() {} }, fetch: async (_url, request) => { savedPayload = JSON.parse(request.body); return { ok: true }; }, Date, Math, JSON };
context.window = context;
(async () => {
  vm.runInNewContext(source, context);
  const runtime = { gameJsHash: 'abc123', buildId: 'abc123', serverRevisionAtLoad: 'server', pageLoadedAt: '2026-09-15T00:00:00.000Z' };
  context.GGGGameplayLogger.observe('start', { puzzleNumber: 2, puzzleText: 'The cat sat on the mat.', settings: {}, runtime, gameplaySpeed: { mode: 'max-testing' } });
  context.GGGGameplayLogger.observe('complete', { winner: 'human' });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(savedPayload.runtime, runtime);
  assert.deepEqual(savedPayload.session.gameplaySpeed, { mode: "max-testing" });
  console.log('PASS gameplay logs preserve the page-loaded runtime identity');

  const failureContext = { console: { debug() {} }, fetch: async () => { throw new Error('simulated unavailable server'); }, Date, Math, JSON };
  failureContext.window = failureContext;
  vm.runInNewContext(source, failureContext);
  failureContext.GGGGameplayLogger.observe('start', { puzzleNumber: 2, puzzleText: 'The cat sat on the mat.', settings: {}, runtime });
  failureContext.GGGGameplayLogger.observe('complete', { winner: 'human' });
  console.log('PASS logging failure is swallowed without throwing');
})().catch(error => { console.error(error); process.exitCode = 1; });
