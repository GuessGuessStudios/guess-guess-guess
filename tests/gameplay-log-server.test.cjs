const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = fs.promises;
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const serverRequire = require('node:module').createRequire(path.join(__dirname, '..', 'server.js'));

(async () => {
  // Production server code, but all filesystem operations and the listening
  // socket belong to a disposable fixture, never the user's project.
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'ggg-log-test-'));
  const logs = path.join(root, 'gameplay-logs');
  let server;
  try {
    vm.runInNewContext(await fsp.readFile(path.join(__dirname, '..', 'server.js'), 'utf8'), {
      require: id => id === 'node:http' ? { ...http, createServer: fn => (server = http.createServer(fn)) } : serverRequire(id),
      __dirname: root, __filename: path.join(__dirname, '..', 'server.js'), Buffer, URL,
      process: { pid: process.pid, env: { PORT: '0' } },
      console: { log() {}, error() {} },
    });
    await new Promise(resolve => server.once('listening', resolve));
    const request = body => fetch('http://127.0.0.1:' + server.address().port + '/api/gameplay-logs', {
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),
    });
    assert(!fs.existsSync(logs));
    for (const sessionId of ['test-session-one', 'second-session']) {
      const payload={session:{sessionId},settings:{},events:[{type:'complete'}],finalResult:{winner:'human'}};
      assert.equal((await request(payload)).status,201);
      assert.deepEqual(JSON.parse(await fsp.readFile(path.join(logs,'latest.json'),'utf8')),payload);
    }
    const files=(await fsp.readdir(logs)).filter(n=>n!=='latest.json');
    assert.equal(files.length,2,'distinct timestamped reports');
    for(const file of files) assert(JSON.parse(await fsp.readFile(path.join(logs,file),'utf8')).session);
    assert.equal((await request({events:[]})).status,400);
    console.log('PASS isolated log directory creation, two reports, latest update, JSON and validation');

    const chunkRequest = payload => fetch('http://127.0.0.1:' + server.address().port + '/api/human-playtest-logs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const chunk = (sequence, events, finished = false) => ({
      format: 'ggg-human-playtest-chunk-v1',
      session: { sessionId: 'chunk-session', predictionMode: 'human-playtest', puzzleNumber: 25, startTime: '2026-10-27T00:00:00Z' },
      runtime: { buildId: 'fixture' }, settings: {}, startedAt: 100,
      chunkSequence: sequence, firstEvent: events[0].event, lastEvent: events.at(-1).event,
      events, finished, finalResult: finished ? { winner: 'human' } : null,
    });
    const first = chunk(1, [{ event: 1, type: 'start', elapsedMs: 0 }, { event: 2, type: 'session-start', elapsedMs: 0 }]);
    const final = chunk(2, [{ event: 3, type: 'guess', elapsedMs: 10 }, { event: 4, type: 'complete', elapsedMs: 20 }], true);
    assert.equal((await chunkRequest(final)).status, 400, 'out-of-order chunks rejected');
    const ack = await (await chunkRequest(first)).json();
    assert.equal(ack.persisted, true);
    assert.equal(ack.lastEvent, 2);
    assert.equal(ack.chunkSequence, 1);
    const firstPath = path.join(logs, 'human-playtest', 'gameplay-chunk-session.chunks', 'chunk-00000001.json');
    const firstStat = await fsp.stat(firstPath);
    assert.equal((await chunkRequest(first)).status, 201, 'lost acknowledgement can be retried');
    assert.equal((await fsp.stat(firstPath)).mtimeMs, firstStat.mtimeMs, 'retry does not rewrite persisted data');
    assert.equal((await chunkRequest({ ...first, settings: { conflict: true } })).status, 400);
    assert.equal((await chunkRequest({ ...final, firstEvent: 4 })).status, 400);
    assert.equal((await chunkRequest(final)).status, 201);
    const chunkDirectory = path.dirname(firstPath);
    const chunkFiles = (await fsp.readdir(chunkDirectory)).sort();
    assert.deepEqual(chunkFiles, ['chunk-00000001.json', 'chunk-00000002.json']);
    const chunks = await Promise.all(chunkFiles.map(file => fsp.readFile(path.join(chunkDirectory, file), 'utf8').then(JSON.parse)));
    const reconstructed = { ...chunks.at(-1), events: chunks.flatMap(part => part.events) };
    assert.deepEqual(reconstructed.events.map(event => event.event), [1, 2, 3, 4]);
    assert.deepEqual(reconstructed.events.map(event => event.elapsedMs), [0, 0, 10, 20]);
    assert.deepEqual(reconstructed.finalResult, { winner: 'human' });
    assert.equal(reconstructed.finished, true);
    assert.equal(reconstructed.session.puzzleNumber, 25);
    assert.equal((await chunkRequest(chunk(3, [{ event: 5, type: 'guess' }]))).status, 400, 'completed sessions cannot be extended');
    console.log('PASS ordered chunks, durable acknowledgements, idempotent retries, conflict rejection and complete reconstruction');
  } finally {
    if(server) await new Promise(resolve=>server.close(resolve));
    await fsp.rm(root,{recursive:true,force:true});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
