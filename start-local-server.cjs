// Called by the Desktop launcher. Does not open any browser.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { spawn, execFileSync } = require("node:child_process");

const SERVER_PORT = "8765";

function serverEnvironment(base) {
  return { ...base, PORT: SERVER_PORT };
}

function canReuseServer(current, { root, revision, pid }) {
  return current?.service === "guess-guess-guess" && current.root === root &&
    current.pid === Number(pid) && current.serverRevision === revision;
}

async function main(deps = {}) {
  const root = deps.root || __dirname;
  const proc = deps.process || process;
  const run = deps.execFileSync || execFileSync;
  const spawnChild = deps.spawn || spawn;
  const fetchLocal = deps.fetch || globalThis.fetch;
  const openFile = deps.openSync || fs.openSync;
  const closeFile = deps.closeSync || fs.closeSync;
  const sleep = deps.wait || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const serverFile = path.join(root, "server.js");
  const revision = createHash("sha256").update(fs.readFileSync(serverFile)).digest("hex");

  async function info() {
    try {
      const response = await fetchLocal("http://127.0.0.1:" + SERVER_PORT + "/api/server-info", {
        signal: AbortSignal.timeout(1000),
      });
      return response.ok ? await response.json() : null;
    } catch { return null; }
  }
  function listener() {
    try {
      return run("/usr/sbin/lsof", ["-nP", "-t", "-iTCP:" + SERVER_PORT, "-sTCP:LISTEN"], { encoding: "utf8" }).trim();
    } catch { return ""; }
  }
  function owned(pid) {
    if (!/^\d+$/.test(String(pid))) return false;
    const command = run("/bin/ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8" }).trim();
    const cwd = run("/usr/sbin/lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], { encoding: "utf8" });
    return cwd.split("\n").includes("n" + root) &&
      (command === proc.execPath + " server.js" || command === proc.execPath + " " + serverFile);
  }

  const current = await info();
  const pid = listener();
  if (pid) {
    if (!owned(pid)) throw new Error("Port 8765 is used by another application; it was left untouched.");
    if (canReuseServer(current, { root, revision, pid })) return;
    proc.kill(Number(pid), "SIGTERM");
    for (let i = 0; i < 40 && listener(); i++) await sleep(250);
    if (listener()) throw new Error("The previous server is still closing. Try again shortly.");
  }

  const log = openFile(path.join(root, ".guess-guess-guess-server.log"), "a");
  const child = spawnChild(proc.execPath, [serverFile], {
    cwd: root, detached: true, stdio: ["ignore", log, log],
    env: serverEnvironment(deps.env || proc.env),
  });
  child.on("error", error => { console.error(error.message); proc.exitCode = 1; });
  child.unref();
  closeFile(log);
  for (let i = 0; i < 40; i++) {
    const ready = await info();
    if (ready?.root === root && ready?.serverRevision === revision && ready?.pid === child.pid) return;
    await sleep(250);
  }
  throw new Error("The local server did not become ready.");
}

if (require.main === module) {
  main().catch(error => {
    console.error("Guess Guess Guess could not start. " + error.message);
    process.exitCode = 1;
  });
}

module.exports = { serverEnvironment, canReuseServer, main };
