const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const speed = require('../gameplay-speed.js');
const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'game.js'), 'utf8');
const element = () => ({ value: '100', checked: false, disabled: false, textContent: '', handlers: {},
  addEventListener(type, fn) { this.handlers[type] = fn; } });
(async () => {
  const form = element();
  form.elements = { percent: element(), maxTesting: element(), save: element() };
  const elements = { gameplaySpeedForm: form, resetGameplaySpeed: element(), gameplaySpeedValue: element(), gameplaySpeedStatus: element() };
  const settings = { timing: { firstGuess: [{ minSeconds: 7, maxSeconds: 20, chance: 100 }] }, rules: { unchanged: true } };
  const controller = speed.createController();
  const css = {}, requests = [];
  let ok = true, saved;
  const c = vm.createContext({
    gameplaySpeed: { ...speed, ...controller }, aiLogicSettings: settings, aiLogicSettingsLoaded: true,
    AI_LOGIC_DEFAULTS: settings, console: { error() {} },
    document: { getElementById: id => elements[id], documentElement: { style: { setProperty: (key, value) => { css[key] = value; } } } },
    cloneAiSettings: s => JSON.parse(JSON.stringify(s)), emitDiagnosticEvent() {},
    fetch: async (url, request) => {
      if (!request) return { ok: true, json: async () => saved };
      requests.push({ url, ...request }); return { ok };
    },
  });
  vm.runInContext(source.slice(source.indexOf('  function applyGameplaySpeed('), source.indexOf('  loadAiLogicSettings();')), c);
  c.renderGameplaySpeedSettings();
  assert.equal(Number(form.elements.percent.value), 100);
  form.elements.percent.value = '150'; form.handlers.input();
  assert.equal(elements.gameplaySpeedValue.textContent, '150%');
  await form.handlers.submit({ preventDefault() {} });
  assert.equal(requests[0].url, '/api/ai-logic-settings');
  assert.equal(requests[0].method, 'PUT'); assert.equal(requests[0].credentials, 'same-origin');
  const payload = JSON.parse(requests[0].body);
  assert.deepEqual(payload, { ...settings, gameplaySpeed: { mode: 'human', percent: 150 } });
  assert.equal(controller.get().percent, 150);
  assert.equal(css['--gameplay-hand-duration'], '1200ms');
  form.elements.maxTesting.checked = true; form.handlers.input();
  assert(form.elements.percent.disabled);
  await form.handlers.submit({ preventDefault() {} });
  assert.deepEqual(controller.get(), { mode: 'max-testing' });
  assert.deepEqual(JSON.parse(requests.at(-1).body).gameplaySpeed, { mode: 'max-testing' });
  elements.resetGameplaySpeed.handlers.click();
  assert.equal(Number(form.elements.percent.value), 100);
  assert(!form.elements.maxTesting.checked); assert(!form.elements.percent.disabled);
  ok = false;
  await form.handlers.submit({ preventDefault() {} });
  assert.equal(controller.get().mode, 'max-testing', 'failed/unauthorized save never applies a draft');
  assert.match(elements.gameplaySpeedStatus.textContent, /could not be saved/);
  ok = true;
  await form.handlers.submit({ preventDefault() {} });
  assert.equal(controller.get().percent, 100);
  saved = { ...settings, gameplaySpeed: { mode: 'human', percent: 10 } };
  await c.loadAiLogicSettings();
  assert.equal(controller.get().percent, 10, 'saved settings restore on next page load');
  saved = settings; await c.loadAiLogicSettings();
  assert.equal(controller.get().percent, 100, 'existing settings without speed default to 100%');
  saved = { ...settings, gameplaySpeed: null }; await c.loadAiLogicSettings();
  assert.equal(c.aiLogicSettingsLoaded, false, 'explicit malformed saved speed is rejected');
  console.log('PASS admin slider/MAX/reset, authenticated save, failed-save handling, settings preservation and reload');
})().catch(error => { console.error(error); process.exitCode = 1; });
