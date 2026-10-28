const fs = require("node:fs");
const fsp = fs.promises;
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const http = require("node:http");
const { randomBytes, pbkdf2Sync } = require("node:crypto");
const assert = require("node:assert/strict");
const sourceFile = path.join(__dirname, "..", "server.js");
const source = fs.readFileSync(sourceFile, "utf8");
const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const jpg = Buffer.from("ffd8ffe000104a464946", "hex");
const text = "Don't worry, Tom!";
const changedText = "‘Don't’ worry, Tom! Tom! café 日本語.";
const assistance = { version: 1, sourceText: text, slots: [
  { slotIndex: 1, answerToken: 'worry', wrong: ['carry', 'hurry'], pronoun: false },
] };
async function scenario(name, options = {}) {
  const testPassword = `fake-test-only-${randomBytes(24).toString("hex")}`;
  const testSalt = randomBytes(16);
  const testHash = pbkdf2Sync(testPassword, testSalt, 310000, 32, "sha256");
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "ggg-edit-"));
  let server;
  let renames = 0;
  const imageRenames = [];
  try {
    for (const dir of ["puzzles", "assets/images", "vaults"]) await fsp.mkdir(path.join(root, dir), { recursive: true });
    const image = "assets/images/puzzle-001.jpg";
    const puzzle = { title: "Puzzle 001", text, image };
    if (options.metadata) puzzle.assistance = assistance;
    const v2 = { scope: "puzzle-specific", puzzles: { 1: ["Don't", "worry", "Tom"], 2: ["Other"] } };
    const v3 = { scope: "puzzle-specific", puzzles: { 1: ["dog"], 2: ["cat"] } };
    const initial = {
      ".ggg-admin.local.json": JSON.stringify({ iterations: 310000, salt: testSalt.toString("base64"), hash: testHash.toString("base64") }),
      "puzzles/puzzle-001.json": JSON.stringify(puzzle),
      "puzzles/puzzle-002.json": JSON.stringify({ title: "Puzzle 002", text: "Other", image: options.shared ? image : "" }),
      "puzzles/puzzle-list.json": '["puzzles/puzzle-001.json","puzzles/puzzle-002.json"]',
      "vaults/vault-2.json": JSON.stringify(v2),
      "vaults/vault-3.json": JSON.stringify(v3),
      [image]: jpg,
    };
    for (const [file, bytes] of Object.entries(initial)) await fsp.writeFile(path.join(root, file), bytes);
    const wrapped = Object.create(fsp);
    wrapped.rename = async (from, to) => {
      assert.equal(typeof from, "string", "never rename null temp image");
      assert.equal(typeof to, "string");
      if (to.includes("/assets/images/")) imageRenames.push(to);
      if (++renames === options.failAt) throw new Error("Injected commit failure");
      return fsp.rename(from, to);
    };
    wrapped.rm = async (target, opts) => {
      if (target === path.join(root, image) && !options.failAt) {
        const saved = JSON.parse(await fsp.readFile(path.join(root, "puzzles/puzzle-001.json")));
        assert.notEqual(saved.image, image, "old-image deletion follows JSON commit");
        const vault = JSON.parse(await fsp.readFile(path.join(root, "vaults/vault-3.json")));
        assert.equal(vault.puzzles["1"], undefined, "cleanup follows vault commit");
      }
      return fsp.rm(target, opts);
    };
    const context = {
      require: id => id === "./assistance-authoring.js" ? require("../assistance-authoring.js") : id === "./gameplay-speed.js" ? require("../gameplay-speed.js") : id === "node:fs" ? { ...fs, promises: wrapped } :
        id === "node:http" ? { ...http, createServer: handler => (server = http.createServer(handler)) } : require(id),
      __dirname: root, __filename: sourceFile, Buffer, URL,
      process: { pid: process.pid, env: { PORT: "0" } },
      console: { log() {}, error() {} },
    };
    vm.runInNewContext(source, context);
    await new Promise(resolve => server.once("listening", resolve));
    const base = "http://127.0.0.1:" + server.address().port;
    const login = await fetch(base + "/api/admin/login", {
      method: "POST", headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({ password: testPassword }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const params = new URLSearchParams({
      number: "1", text: options.text ? changedText : text,
      extension: options.extension || "", removeImage: options.remove ? "1" : "0",
    });
    const payload = { ...(options.assistance !== undefined ? { assistance: options.assistance } : {}),
      ...(options.extension ? { imageData: `data:image/${options.extension === 'png' ? 'png' : 'jpeg'};base64,${(options.extension === 'png' ? png : jpg).toString('base64')}` } : {}) };
    const response = await fetch("http://127.0.0.1:" + server.address().port + "/api/puzzles?" + params, {
      method: "PUT", headers: { Origin: base, Cookie: cookie, ...(options.json ? { 'Content-Type': 'application/json' } : options.extension ? { "Content-Type": options.invalid ? "text/plain" : options.extension === "png" ? "image/png" : "image/jpeg" } : {}) },
      body: options.json ? JSON.stringify(payload) : options.extension ? options.invalid ? Buffer.from("not an image") : options.extension === "png" ? png : jpg : undefined,
    });
    const result = await response.json();
    const failed = Boolean(options.failAt || options.invalid || options.invalidAssistance);
    assert.equal(response.status, failed ? 500 : 200, JSON.stringify(result));
    if (failed || (!options.text && !options.extension && !options.remove && options.assistance === undefined)) {
      for (const [file, bytes] of Object.entries(initial)) {
        assert.deepEqual(await fsp.readFile(path.join(root, file)), Buffer.from(bytes), "original bytes: " + file);
      }
    } else {
      const saved = JSON.parse(await fsp.readFile(path.join(root, "puzzles/puzzle-001.json")));
      assert.equal(saved.title, puzzle.title);
      assert.equal(saved.text, options.text ? changedText : text);
      assert.deepEqual(saved.assistance, options.assistance !== undefined ? options.assistance : options.text ? undefined : puzzle.assistance);
      if (options.extension) {
        assert.match(saved.image, /puzzle-001/);
        assert.deepEqual(await fsp.readFile(path.join(root, saved.image)), options.extension === "png" ? png : jpg);
      } else if (options.remove) assert.equal(saved.image, undefined);
      else assert.equal(saved.image, image);
      if (options.shared) assert.deepEqual(await fsp.readFile(path.join(root, image)), jpg);
      else if (options.remove || options.extension === "png") assert.equal(fs.existsSync(path.join(root, image)), false);
      const after2 = JSON.parse(await fsp.readFile(path.join(root, "vaults/vault-2.json")));
      if (options.text) assert.deepEqual(after2.puzzles["1"], ["Don't", "worry", "Tom", "Tom", "café", "日本語"]);
      else assert.equal(await fsp.readFile(path.join(root, "vaults/vault-2.json"), "utf8"), initial["vaults/vault-2.json"]);
      assert.deepEqual(after2.puzzles["2"], v2.puzzles["2"]);
      const after3 = JSON.parse(await fsp.readFile(path.join(root, "vaults/vault-3.json")));
      assert.deepEqual(after3.puzzles["1"], options.text || options.extension || options.remove ? undefined : v3.puzzles["1"]);
      assert.deepEqual(after3.puzzles["2"], v3.puzzles["2"]);
    }
    if (!options.extension) assert.equal(imageRenames.length, 0, "no replacement commit for removal/text only");
    assert.equal(await fsp.readFile(path.join(root, "puzzles/puzzle-list.json"), "utf8"), initial["puzzles/puzzle-list.json"]);
    assert.equal(await fsp.readFile(path.join(root, "puzzles/puzzle-002.json"), "utf8"), initial["puzzles/puzzle-002.json"]);
    for (const dir of ["puzzles", "vaults", "assets/images"]) {
      const files = await fsp.readdir(path.join(root, dir));
      assert(!files.some(f => /\.edit-/.test(f)), "no staging files remain");
    }
    console.log("PASS " + name);
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await fsp.rm(root, { recursive: true, force: true });
  }
}
(async () => {
  await scenario("text only", { text: true });
  await scenario("replace image only / extension change", { extension: "png" });
  await scenario("text and replace image", { text: true, extension: "png" });
  await scenario("remove only", { remove: true });
  await scenario("text and remove", { text: true, remove: true });
  await scenario("no-op preserves exact bytes");
  await scenario("invalid image rejected", { extension: "png", invalid: true });
  await scenario("shared removal preserves original", { shared: true, remove: true });
  await scenario("shared same-extension replacement", { shared: true, extension: "jpeg" });
  await scenario("same-extension replacement", { extension: "jpg" });
  await scenario("replacement wins after remove", { extension: "png", remove: true });
  await scenario('metadata-only save preserves sentence, image and vaults', { json: true, assistance });
  await scenario('remove prepared alternatives and pronoun marks', { json: true, metadata: true, assistance: { ...assistance, slots: [] } });
  await scenario('JSON image replacement and metadata save together', { json: true, extension: 'png', assistance });
  await scenario('image-only update preserves existing metadata', { json: true, extension: 'png', metadata: true });
  await scenario('sentence update invalidates existing metadata', { json: true, text: true, metadata: true });
  await scenario('stale metadata is rejected without changing files', { json: true, text: true, assistance, invalidAssistance: true });
  await scenario('wrong-slot metadata is rejected without changing files', { json: true, assistance: { ...assistance, slots: [{ ...assistance.slots[0], slotIndex: 0 }] }, invalidAssistance: true });
  for (let failAt = 1; failAt <= 4; failAt++) {
    await scenario("rollback at replacement commit " + failAt, { text: true, extension: "jpg", failAt });
  }
  for (let failAt = 1; failAt <= 3; failAt++) {
    await scenario("rollback at removal commit " + failAt, { text: true, remove: true, failAt });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
