const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = fs.promises;
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const { randomBytes, createHash } = require('node:crypto');
const sourceFile = path.join(__dirname, '..', 'server.js');
const source = fs.readFileSync(sourceFile, 'utf8');
const testPassword = `fake-test-only-${randomBytes(24).toString('hex')}`;
const writes = [
  ['POST', '/api/puzzles?number=2&text=A%20cat.&extension=png', Buffer.from('89504e470d0a1a0a', 'hex'), 'image/png'],
  ['PUT', '/api/puzzles?number=1&text=A%20dog.', undefined, undefined],
  ['PUT', '/api/vaults?vault=3&number=1', JSON.stringify({ words: ['fox'] }), 'application/json'],
  ['PUT', '/api/ai-logic-settings', JSON.stringify({ testSetting: true }), 'application/json'],
];

async function fixture(password, run) {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'ggg-admin-'));
  let server;
  let now = Date.now();
  const logs = [];
  try {
    const initial = {
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
    for (const [file, bytes] of Object.entries(initial)) {
      await fsp.mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await fsp.writeFile(path.join(root, file), bytes);
    }
    await fsp.mkdir(path.join(root, 'assets/images'), { recursive: true });
    const env = { PORT: '0' };
    if (password !== undefined) env.GGG_ADMIN_PASSWORD = password;
    const context = {
      require: id => id === 'node:http' ? { ...http, createServer: fn => (server = http.createServer(fn)) } : require(id),
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
  for (const route of ['/', '/game.js', '/puzzles/puzzle-list.json', '/puzzles/puzzle-001.json',
    '/vaults/vault-3.json', '/api/ai-logic-settings', '/api/runtime-info', '/api/next-puzzle-number']) {
    assert.equal((await request(route)).status, 200, route);
  }
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
  await browserAdminFlow();
  for (const password of [undefined, '']) {
    await fixture(password, async api => {
      await publicAccess(api);
      const before = await api.snapshot();
      const response = await api.login();
      assert.equal(response.status, 401);
      assert.equal(response.headers.get('set-cookie'), null);
      assert.deepEqual(await response.json(), { error: 'Administrator login failed.' });
      for (const entry of writes) assert.equal((await api.write(entry, 'ggg_admin_session=' + 'a'.repeat(64))).status, 401);
      assert.deepEqual(await api.snapshot(), before, 'disabled writes leave all files unchanged');
    });
  }
  console.log('PASS missing/empty environment: public reads and both logs work; login and all writes denied');

  let previousCookie;
  await fixture(testPassword, async api => {
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
  await fixture(testPassword, async api => {
    for (const entry of writes) assert.equal((await api.write(entry, previousCookie)).status, 401);
  });
  console.log('PASS sessions do not survive server restart');
})().catch(error => { console.error(error); process.exitCode = 1; });
