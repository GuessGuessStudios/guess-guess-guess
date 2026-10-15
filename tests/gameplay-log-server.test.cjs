const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = fs.promises;
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');

(async () => {
  // Production server code, but all filesystem operations and the listening
  // socket belong to a disposable fixture, never the user's project.
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'ggg-log-test-'));
  const logs = path.join(root, 'gameplay-logs');
  let server;
  try {
    vm.runInNewContext(await fsp.readFile(path.join(__dirname, '..', 'server.js'), 'utf8'), {
      require: id => id === 'node:http' ? { ...http, createServer: fn => (server = http.createServer(fn)) } : require(id),
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
  } finally {
    if(server) await new Promise(resolve=>server.close(resolve));
    await fsp.rm(root,{recursive:true,force:true});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
