const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = fs.promises;
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const { createHash } = require('node:crypto');

async function get(base, route) {
  const response = await fetch(base + route);
  return { response, text: await response.text() };
}

(async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'ggg-runtime-test-'));
  let server;
  try {
    const serverSource = await fsp.readFile(path.join(__dirname, '..', 'server.js'), 'utf8');
    const index = await fsp.readFile(path.join(__dirname, '..', 'index.html'));
    const game = await fsp.readFile(path.join(__dirname, '..', 'game.js'));
    const gameSource = game.toString();
    assert(gameSource.includes('async function verifyRuntimeFreshness()'));
    assert(gameSource.includes('current.gameJsHash !== loadedRuntime.gameJsHash'));
    assert(gameSource.includes('STALE GAME BUILD'));
    assert(gameSource.includes('runtime: loadedRuntime'));
    await fsp.writeFile(path.join(root, 'server.js'), serverSource);
    await fsp.writeFile(path.join(root, 'index.html'), index);
    await fsp.writeFile(path.join(root, 'game.js'), game);
    await fsp.writeFile(path.join(root, 'data.json'), '{}\n');
    const context = {
      require: id => id === 'node:http' ? { ...http, createServer: fn => (server = http.createServer(fn)) } : require(id),
      __dirname: root, __filename: path.join(root, 'server.js'), Buffer, URL,
      process: { pid: process.pid, env: { PORT: '0' } }, console: { log() {}, error() {} },
    };
    vm.runInNewContext(serverSource, context);
    await new Promise(resolve => server.once('listening', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    const runtime = await get(base, '/api/runtime-info');
    assert.equal(runtime.response.status, 200);
    const info = JSON.parse(runtime.text);
    const expected = createHash('sha256').update(game).digest('hex');
    assert.equal(info.gameJsHash, expected);
    assert.equal(info.buildId, expected.slice(0, 12));
    const gameResponse = await get(base, '/game.js?v=' + info.buildId);
    assert.equal(gameResponse.response.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, max-age=0');
    assert.equal(gameResponse.text, game.toString());
    const jsonResponse = await get(base, '/data.json');
    assert.equal(jsonResponse.response.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, max-age=0');
    const indexResponse = await get(base, '/');
    assert.equal(indexResponse.response.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, max-age=0');
    assert(indexResponse.text.includes(`game.js?v=${info.buildId}`));
    const markerStart = indexResponse.text.indexOf('window.__GGG_RUNTIME__=');
    const markerEnd = indexResponse.text.indexOf(';</script>', markerStart);
    assert(markerStart >= 0 && markerEnd > markerStart);
    const markerJson = indexResponse.text.slice(markerStart + 'window.__GGG_RUNTIME__='.length, markerEnd);
    assert.equal(JSON.parse(markerJson).gameJsHash, expected);
    const changed = Buffer.concat([game, Buffer.from('\n// runtime test change\n')]);
    await fsp.writeFile(path.join(root, 'game.js'), changed);
    const changedRuntime = JSON.parse((await get(base, '/api/runtime-info')).text);
    assert.notEqual(changedRuntime.gameJsHash, info.gameJsHash);
    assert.equal(changedRuntime.buildId, changedRuntime.gameJsHash.slice(0, 12));
    console.log('PASS runtime endpoint hash, changed-copy hash, no-cache headers, versioned index and embedded page identity');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await fsp.rm(root, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
