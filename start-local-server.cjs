// Called by the Desktop launcher. Does not open any browser.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { spawn, execFileSync } = require("node:child_process");
const root = __dirname;
const serverFile = path.join(root, "server.js");
const revision = createHash("sha256").update(fs.readFileSync(serverFile)).digest("hex");
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function info() {
  try {
    const response = await fetch("http://127.0.0.1:8765/api/server-info", { signal: AbortSignal.timeout(1000) });
    return response.ok ? await response.json() : null;
  } catch { return null; }
}
function listener() {
  try { return execFileSync("/usr/sbin/lsof", ["-nP", "-t", "-iTCP:8765", "-sTCP:LISTEN"], { encoding: "utf8" }).trim(); }
  catch { return ""; }
}
function owned(pid) {
  if (!/^\d+$/.test(String(pid))) return false;
  const command = execFileSync("/bin/ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8" }).trim();
  const cwd = execFileSync("/usr/sbin/lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], { encoding: "utf8" });
  return cwd.split("\n").includes("n" + root) &&
    (command === process.execPath + " server.js" || command === process.execPath + " " + serverFile);
}
async function main() {
  const current = await info();
  const pid = listener();
  if (pid) {
    if (!owned(pid)) throw new Error("Port 8765 is used by another application; it was left untouched.");
    if (current?.service === "guess-guess-guess" && current.root === root &&
        current.pid === Number(pid) && current.revision === revision) return;
    process.kill(Number(pid), "SIGTERM");
    for (let i = 0; i < 40 && listener(); i++) await wait(250);
    if (listener()) throw new Error("The previous server is still closing. Try again shortly.");
  }
  const log = fs.openSync(path.join(root, ".guess-guess-guess-server.log"), "a");
  const child = spawn(process.execPath, [serverFile], {
    cwd: root, detached: true, stdio: ["ignore", log, log],
    env: { ...process.env, PORT: "8765" },
  });
  child.on("error", error => { console.error(error.message); process.exitCode = 1; });
  child.unref();
  fs.closeSync(log);
  for (let i = 0; i < 40; i++) {
    const ready = await info();
    if (ready?.root === root && ready?.revision === revision && ready?.pid === child.pid) return;
    await wait(250);
  }
  throw new Error("The local server did not become ready.");
}
main().catch(error => {
  console.error("Guess Guess Guess could not start. " + error.message);
  process.exitCode = 1;
});
