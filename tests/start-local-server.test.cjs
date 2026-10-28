const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { serverEnvironment, canReuseServer, main } = require("../start-local-server.cjs");

const root = path.join(__dirname, "..");
const serverFile = path.join(root, "server.js");
const revision = createHash("sha256").update(fs.readFileSync(serverFile)).digest("hex");

function fakeProcess() {
  return {
    execPath: process.execPath,
    env: { USER: "synthetic-user", PATH: "/synthetic/bin" },
    kill() { throw new Error("No process should be killed in normal startup"); },
  };
}

function ready(pid) { return { service: "guess-guess-guess", root, pid, serverRevision: revision }; }

async function startup(existing = null) {
  const proc = fakeProcess();
  const spawnCalls = [];
  const killed = [];
  let fetchCount = 0;
  let listenerCount = 0;
  const run = (file, args) => {
    if (file === "/usr/sbin/lsof" && args[0] === "-nP") {
      listenerCount++;
      if (existing && listenerCount === 1) return String(existing.pid);
      return "";
    }
    if (file === "/bin/ps") return process.execPath + " server.js\n";
    if (file === "/usr/sbin/lsof" && args[0] === "-a") return "p123\nfcwd\nn" + root + "\n";
    throw new Error("Unexpected process inspection command");
  };
  proc.kill = (pid, signal) => killed.push([pid, signal]);
  const child = { pid: 9876, on() {}, unref() {} };
  await main({
    root, process: proc, execFileSync: run,
    spawn: (...args) => { spawnCalls.push(args); return child; },
    fetch: async () => {
      fetchCount++;
      const value = fetchCount === 1 ? existing : ready(child.pid);
      return { ok: Boolean(value), json: async () => value };
    },
    openSync: () => 9, closeSync() {}, wait: async () => {},
  });
  return { proc, spawnCalls, killed };
}

async function mainTest() {
  const inherited = { USER: "synthetic-user", PATH: "/synthetic/bin" };
  const environment = serverEnvironment(inherited);
  assert.equal(environment.PORT, "8765");
  assert.equal(inherited.PORT, undefined, "base environment is not mutated");
  assert.equal(canReuseServer(ready(123), { root, revision, pid: "123" }), true);
  assert.equal(canReuseServer({ ...ready(123), serverRevision: "old-server" }, { root, revision, pid: 123 }), false,
    "old server revision is restarted");

  const fresh = await startup();
  assert.equal(fresh.spawnCalls.length, 1);
  const [executable, args, options] = fresh.spawnCalls[0];
  assert.equal(executable, process.execPath);
  assert.deepEqual(args, [serverFile]);
  assert.equal(options.env.PORT, "8765");
  assert(!JSON.stringify([executable, args]).toLowerCase().includes("password"),
    "normal game startup takes no password command-line argument");

  const stale = await startup({ ...ready(123), serverRevision: "old-server" });
  assert.deepEqual(stale.killed, [[123, "SIGTERM"]]);
  assert.equal(stale.spawnCalls.length, 1, "old credential-less server is replaced");
  console.log("PASS normal startup without password setup; stale owned server is replaced safely");
}

mainTest().catch(error => { console.error(error); process.exitCode = 1; });
