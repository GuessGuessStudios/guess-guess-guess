const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = fs.promises;
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const { randomBytes, createHash, pbkdf2Sync } = require('node:crypto');
const sourceFile = path.join(__dirname, '..', 'server.js');
const source = fs.readFileSync(sourceFile, 'utf8');
const testPassword = `fake-test-only-${randomBytes(24).toString('hex')}`;
const testSalt = randomBytes(16);
const testHash = pbkdf2Sync(testPassword, testSalt, 310000, 32, 'sha256');
const writes = [
  ['POST', '/api/puzzles?number=2&text=A%20cat.&extension=png', Buffer.from('89504e470d0a1a0a', 'hex'), 'image/png'],
  ['PUT', '/api/puzzles?number=1&text=A%20dog.', undefined, undefined],
  ['PUT', '/api/vaults?vault=3&number=1', JSON.stringify({ words: ['fox'] }), 'application/json'],
  ['PUT', '/api/ai-logic-settings', JSON.stringify({ testSetting: true }), 'application/json'],
];

async function fixture(run, credentials = 'valid') {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'ggg-admin-'));
  let server;
  let now = Date.now();
  const logs = [];
  try {
    const initial = {
      ".ggg-admin.local.json": JSON.stringify({ iterations: 310000, salt: testSalt.toString("base64"), hash: testHash.toString("base64") }),
      'index.html': '<script src="game.js"></script>',
      'game.js': '// fixture game',
      'puzzles/puzzle-list.json': '["puzzles/puzzle-001.json"]',
      'puzzles/puzzle-001.json': JSON.stringify({ title: 'Puzzle 001', text: 'A cat.' }),
      'vaults/vault-1.json': JSON.stringify({ words: ['A'] }),
      'vaults/vault-2.json': JSON.stringify({ puzzles: { 1: ['A', 'cat'] } }),
      'vaults/vault-3.json': JSON.stringify({ puzzles: {} }),
      'vaults/vault-5.json': JSON.stringify({ puzzles: {} }),
      'ai-logic-settings.json': '{}',
    };
    if (credentials === 'missing') delete initial['.ggg-admin.local.json'];
    if (credentials === 'invalid') initial['.ggg-admin.local.json'] = '{}';
    for (const [file, bytes] of Object.entries(initial)) {
      await fsp.mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await fsp.writeFile(path.join(root, file), bytes);
    }
    await fsp.mkdir(path.join(root, 'assets/images'), { recursive: true });
    const env = { PORT: '0' };
    const context = {
      require: id => id === "./assistance-authoring.js" ? require("../assistance-authoring.js") : id === "./gameplay-speed.js" ? require("../gameplay-speed.js") : id === 'node:http' ? { ...http, createServer: fn => (server = http.createServer(fn)) } : require(id),
      __dirname: root, __filename: sourceFile, Buffer, URL,
      Date: class extends Date { static now() { return now; } },
      process: { pid: process.pid, env },
      console: { log: (...args) => logs.push(args.join(' ')), error: (...args) => logs.push(args.join(' ')) },
    };
    vm.runInNewContext(source, context);
    await new Promise(resolve => server.once('listening', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    const request = (route, method = 'GET', body, headers = {}) => fetch(base + route, {
      method, body, headers: { Origin: base, ...headers },
    });
    const login = (value = testPassword, headers = {}) => request('/api/admin/login', 'POST',
      JSON.stringify({ password: value }), { 'Content-Type': 'application/json', ...headers });
    const write = (entry, cookie, headers = {}) => request(entry[1], entry[0], entry[2], {
      ...(entry[3] ? { 'Content-Type': entry[3] } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers,
    });
    const snapshot = async () => {
      const result = {};
      for (const entry of await fsp.readdir(root, { recursive: true, withFileTypes: true })) {
        if (entry.isFile()) {
          const file = path.join(entry.parentPath || entry.path, entry.name);
          result[path.relative(root, file)] = createHash('sha256').update(await fsp.readFile(file)).digest('hex');
        }
      }
      return result;
    };
    await run({ root, base, request, login, write, snapshot, advance: ms => { now += ms; } });
    assert(!logs.join('\n').includes(testPassword), 'no credential in server logs');
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await fsp.rm(root, { recursive: true, force: true });
  }
}

async function publicAccess({ request }) {
  for (const route of ['/.ggg-admin.local.json', '/%2eggg-admin.local.json', '/.GGG-ADMIN.LOCAL.JSON']) {
    assert.equal((await request(route)).status, 404, 'private verifier is never served');
  }
  for (const route of ['/', '/game.js', '/puzzles/puzzle-list.json', '/puzzles/puzzle-001.json',
    '/vaults/vault-3.json', '/api/ai-logic-settings', '/api/runtime-info', '/api/next-puzzle-number']) {
    assert.equal((await request(route)).status, 200, route);
  }
  assert.equal(JSON.parse(await (await request('/api/server-info')).text()).service, 'guess-guess-guess');
  assert.equal((await request('/api/gameplay-logs', 'POST', JSON.stringify({
    session: { sessionId: 'admin-fixture' }, events: [],
  }))).status, 201);
  assert.equal((await request('/api/human-playtest-logs', 'POST', JSON.stringify({
    session: { sessionId: 'admin-fixture-human', predictionMode: 'human-playtest' }, events: [],
  }))).status, 201);
}

async function browserAdminFlow() {
  // Execute the live admin handlers with a small DOM stub; no inference code runs.
  const game = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
  const element = () => {
    const classes = new Set(['hidden']);
    return {
      classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) },
      handlers: {}, addEventListener(type, handler) { this.handlers[type] = handler; },
      value: '', textContent: '', disabled: false, focus() { this.focused = true; },
    };
  };
  const elements = Object.fromEntries(['adminPanel', 'adminAccessForm', 'adminAccessPassword',
    'adminAccessError', 'adminAccessTrigger', 'adminMainMenu', 'closeAdminPanelBtn'].map(id => [id, element()]));
  const body = element();
  const pending = [];
  let alerts = 0;
  let cancelled = 0;
  const context = {
    ...elements, document: { body, querySelectorAll: () => [elements.adminMainMenu] },
    fetch: (route, options) => new Promise((resolve, reject) => pending.push({ route, options, resolve, reject })),
    alert: () => { alerts++; }, cancelAiTurn: () => { cancelled++; },
    resetHandRaiseState() {}, updateStartGameButton() {}, gameStarted: true,
  };
  vm.runInNewContext(game.slice(game.indexOf('  function showAdminAccess()'), game.indexOf('  function cloneAiSettings')) +
    game.slice(game.indexOf('  if (adminAccessTrigger) {'), game.indexOf('  function readLocalPuzzles()')), context);
  elements.adminAccessTrigger.handlers.click();
  assert(!elements.adminAccessForm.classList.contains('hidden'));
  assert(elements.adminAccessPassword.focused);
  const event = { preventDefault() {} };
  elements.adminAccessPassword.value = testPassword;
  const failed = elements.adminAccessForm.handlers.submit(event);
  assert(elements.adminPanel.classList.contains('hidden'), 'panel remains hidden until server confirms');
  assert(elements.adminAccessPassword.disabled);
  pending.shift().resolve({ ok: false });
  await failed;
  assert(elements.adminPanel.classList.contains('hidden'));
  assert.equal(elements.adminAccessError.textContent, 'Administrator login failed.');
  assert.equal(elements.adminAccessPassword.value, '');
  assert.equal(cancelled, 0, 'failed login does not interrupt gameplay');
  elements.adminAccessPassword.value = testPassword;
  const success = elements.adminAccessForm.handlers.submit(event);
  const login = pending.shift();
  assert.equal(login.route, '/api/admin/login');
  assert.equal(login.options.credentials, 'same-origin');
  assert.equal(JSON.parse(login.options.body).password, testPassword);
  login.resolve({ ok: true });
  await success;
  assert(!elements.adminPanel.classList.contains('hidden'));
  assert(elements.adminAccessForm.classList.contains('hidden'));
  assert.equal(elements.adminAccessPassword.value, '');
  assert.equal(cancelled, 1);
  const failedLogout = elements.closeAdminPanelBtn.handlers.click();
  pending.shift().reject(new Error('network failure'));
  await failedLogout;
  assert.equal(alerts, 1);
  assert(!elements.adminPanel.classList.contains('hidden'), 'failed logout is visible and retryable');
  const logout = elements.closeAdminPanelBtn.handlers.click();
  const logoutRequest = pending.shift();
  assert.equal(logoutRequest.route, '/api/admin/logout');
  logoutRequest.resolve({ ok: true });
  await logout;
  assert(elements.adminPanel.classList.contains('hidden'));
  assert(!body.classList.contains('admin-open'));
  elements.adminAccessTrigger.handlers.keydown({ ...event, key: 'Enter' });
  assert(!elements.adminAccessForm.classList.contains('hidden'));
  console.log('PASS live browser handlers: title trigger, server-confirmed reveal, generic failure, password clearing and logout');
}

(async () => {
  assert(!source.includes(testPassword), 'synthetic password is absent from server source');
  assert(!fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8').includes(testPassword),
    'synthetic password is absent from browser source');
  assert(!process.argv.includes(testPassword), 'synthetic password is absent from command-line arguments');
  await browserAdminFlow();
  for (const credentials of ['missing', 'invalid']) {
    await fixture(async api => {
      assert.equal((await api.request('/game.js')).status, 200);
      assert.equal((await api.login()).status, 401);
      for (const entry of writes) assert.equal((await api.write(entry)).status, 401);
    }, credentials);
  }
  console.log('PASS missing/invalid private configuration fails closed; ordinary game assets remain available');
  await fixture(async api => {
    await publicAccess(api);
    const before = await api.snapshot();
    const response = await api.login();
    assert.equal(response.status, 200, 'correct password succeeds without environment configuration');
    const cookie = response.headers.get('set-cookie').split(';')[0];
    for (const entry of writes) assert.equal((await api.write(entry, cookie)).status, entry[0] === 'POST' ? 201 : 200);
  });
  console.log('PASS normal startup and correct server-side PBKDF2 password without environment setup');

  let previousCookie;
  await fixture(async api => {
    await publicAccess(api);
    const before = await api.snapshot();
    for (const entry of writes) assert.equal((await api.write(entry)).status, 401);
    for (const wrong of [`fake-wrong-${randomBytes(16).toString('hex')}`, '', null, {}, 12]) {
      const response = await api.login(wrong);
      assert.equal(response.status, 401);
      assert.equal(response.headers.get('set-cookie'), null);
      assert.deepEqual(await response.json(), { error: 'Administrator login failed.' });
    }
    const malformed = await api.request('/api/admin/login', 'POST', '{"password":"' + testPassword,
      { 'Content-Type': 'application/json' });
    assert.equal(malformed.status, 401);
    assert.deepEqual(await malformed.json(), { error: 'Administrator login failed.' });
    for (const headers of [{ Origin: 'https://example.invalid' }, { Origin: 'null' }, { Origin: '' },
      { Host: 'attacker.invalid', Origin: 'http://attacker.invalid' }, { 'Sec-Fetch-Site': 'cross-site' },
      { Origin: 'http://localhost:' + new URL(api.base).port }]) {
      assert.equal((await api.login(testPassword, headers)).status, 403);
    }
    assert.deepEqual(await api.snapshot(), before);
    console.log('PASS unauthenticated writes, wrong/malformed passwords, cross-origin login and invalid Host denied');

    const response = await api.login();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.match(response.headers.get('cache-control'), /no-store/);
    const setCookie = response.headers.get('set-cookie');
    assert.match(setCookie, /^ggg_admin_session=[a-f0-9]{64};/);
    for (const attribute of ['HttpOnly', 'SameSite=Strict', 'Path=/api', 'Max-Age=28800']) assert(setCookie.includes(attribute));
    let cookie = setCookie.split(';')[0];
    assert(!setCookie.includes(testPassword));
    for (const entry of writes) {
      for (const headers of [{ Origin: 'https://example.invalid' }, { Origin: '' },
        { Host: 'attacker.invalid', Origin: 'http://attacker.invalid' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
        assert.equal((await api.write(entry, cookie, headers)).status, 403);
      }
      for (const invalid of ['ggg_admin_session=invalid', 'ggg_admin_session=' + '0'.repeat(64), cookie + '; ' + cookie]) {
        assert.equal((await api.write(entry, invalid)).status, 401);
      }
    }
    assert.deepEqual(await api.snapshot(), before, 'denied requests never mutate files');
    for (const [i, entry] of writes.entries()) assert.equal((await api.write(entry, cookie)).status, i === 0 ? 201 : 200);
    assert.equal(JSON.parse(await fsp.readFile(path.join(api.root, 'puzzles/puzzle-001.json'))).text, 'A dog.');
    assert.equal(JSON.parse(await fsp.readFile(path.join(api.root, 'puzzles/puzzle-002.json'))).text, 'A cat.');
    assert.deepEqual(JSON.parse(await fsp.readFile(path.join(api.root, 'vaults/vault-3.json'))).puzzles['1'], ['fox']);
    assert.deepEqual(JSON.parse(await fsp.readFile(path.join(api.root, 'ai-logic-settings.json'))), { testSetting: true });
    console.log('PASS random HttpOnly strict cookie; all four authenticated writes persist; cross-origin/invalid sessions denied');

    // Re-login rotates the existing session and invalidates its previous ID.
    const rotated = await api.login(testPassword, { Cookie: cookie });
    const nextCookie = rotated.headers.get('set-cookie').split(';')[0];
    assert.notEqual(nextCookie, cookie);
    for (const entry of writes) assert.equal((await api.write(entry, cookie)).status, 401);
    cookie = nextCookie;
    assert.equal((await api.request('/api/admin/logout', 'POST', undefined,
      { Cookie: cookie, Origin: 'https://example.invalid' })).status, 403);
    assert.equal((await api.write(writes[3], cookie)).status, 200);
    const logout = await api.request('/api/admin/logout', 'POST', undefined, { Cookie: cookie });
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
    for (const entry of writes) assert.equal((await api.write(entry, cookie)).status, 401);
    const expiring = await api.login();
    cookie = expiring.headers.get('set-cookie').split(';')[0];
    api.advance(8 * 60 * 60 * 1000);
    for (const entry of writes) assert.equal((await api.write(entry, cookie)).status, 401);
    previousCookie = (await api.login()).headers.get('set-cookie').split(';')[0];
    console.log('PASS rotation, cross-origin logout rejection, logout invalidation and exact eight-hour expiration');
  });
  await fixture(async api => {
    for (const entry of writes) assert.equal((await api.write(entry, previousCookie)).status, 401);
  });
  console.log('PASS sessions do not survive server restart');
  await fixture(async api => {
    const cookie = (await api.login()).headers.get('set-cookie').split(';')[0];
    const save = (gameplaySpeed, auth = cookie) => api.request('/api/ai-logic-settings', 'PUT',
      JSON.stringify({ preserved: true, gameplaySpeed }),
      { 'Content-Type': 'application/json', ...(auth ? { Cookie: auth } : {}) });
    const before = await api.snapshot();
    assert.equal((await save({ mode: 'max-testing' }, null)).status, 401);
    for (const value of [null, [], {}, { mode: 'human' }, { mode: 'human', percent: '100' },
      { mode: 'human', percent: 9 }, { mode: 'human', percent: 151 },
      { mode: 'human', percent: 100, extra: true }, { mode: 'max-testing', percent: 150 }, { mode: 'unknown' }]) {
      assert.equal((await save(value)).status, 400, 'malformed speed rejected');
      assert.deepEqual(await api.snapshot(), before, 'rejected setting leaves files unchanged');
    }
    for (const gameplaySpeed of [{ mode: 'human', percent: 10 }, { mode: 'human', percent: 100 },
      { mode: 'human', percent: 150 }, { mode: 'max-testing' }]) {
      assert.equal((await save(gameplaySpeed)).status, 200);
      const persisted = await (await api.request('/api/ai-logic-settings')).json();
      assert.deepEqual(persisted, { preserved: true, gameplaySpeed });
    }
  });
  console.log('PASS protected speed persistence and rejection of malformed/out-of-range settings');
  await fixture(async api => {
    const cookie = (await api.login()).headers.get('set-cookie').split(';')[0];
    const assistance = { enabled: false, minimumOrdinaryGuesses: 3, intervals: {
      generalWrong: { min: 4, max: 8 }, generalCorrect: { min: 8, max: 12 },
      pronounWrong: { min: 3, max: 6 }, pronounCorrect: { min: 6, max: 10 },
    } };
    const save = (value, auth = cookie) => api.request('/api/ai-logic-settings', 'PUT',
      JSON.stringify({ preserved: true, assistance: value }),
      { 'Content-Type': 'application/json', ...(auth ? { Cookie: auth } : {}) });
    assert.equal((await save(assistance, null)).status, 401);
    assert.equal((await save(assistance)).status, 200);
    const before = await api.snapshot();
    for (const invalid of [null, {}, { ...assistance, enabled: 'true' },
      { ...assistance, minimumOrdinaryGuesses: 1 }, { ...assistance, minimumOrdinaryGuesses: 11 },
      ...[{ min: 0, max: 5 }, { min: 5, max: 4 }, { min: 1.5, max: 6 }].map(pair =>
        ({ ...assistance, intervals: { ...assistance.intervals, generalWrong: pair } }))]) {
      assert.equal((await save(invalid)).status, 400);
      assert.deepEqual(await api.snapshot(), before);
    }
    assert.deepEqual(await (await api.request('/api/ai-logic-settings')).json(), { preserved: true, assistance });
    assert.equal((await save({ ...assistance, enabled: true })).status, 200);
    assert.equal((await (await api.request('/api/ai-logic-settings')).json()).assistance.enabled, true);
  });
  console.log('PASS authenticated assistance persistence, explicit enabling and invalid numeric settings rejected without writes');
})().catch(error => { console.error(error); process.exitCode = 1; });
