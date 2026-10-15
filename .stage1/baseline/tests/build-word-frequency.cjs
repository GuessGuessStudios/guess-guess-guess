// Offline deterministic data preparation. No packages, network or puzzle inputs.
// node tests/build-word-frequency.cjs [--check]
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const sourceDir = path.join(root, '.stage1/wordfreq-3.1.1');

// Read only the MessagePack types used by this pinned cBpack file. This is
// preparation tooling, not a parser or dependency shipped into the browser.
function decodeCBpack(bytes) {
  let offset = 0;
  const uint = size => { assert(offset + size <= bytes.length); const n = bytes.readUIntBE(offset, size); offset += size; return n; };
  const string = size => { assert(offset + size <= bytes.length); const s = bytes.toString('utf8', offset, offset + size); offset += size; return s; };
  const array = size => Array.from({ length: size }, () => value());
  const map = size => Object.fromEntries(Array.from({ length: size }, () => [value(), value()]));
  function value() {
    const tag = uint(1);
    if (tag < 0x80) return tag;
    if (tag >= 0xa0 && tag <= 0xbf) return string(tag & 31);
    if (tag >= 0x90 && tag <= 0x9f) return array(tag & 15);
    if (tag >= 0x80 && tag <= 0x8f) return map(tag & 15);
    if (tag === 0xdc) return array(uint(2));
    if (tag === 0xdd) return array(uint(4));
    if (tag === 0xd9) return string(uint(1));
    if (tag === 0xda) return string(uint(2));
    if (tag === 0xdb) return string(uint(4));
    throw new Error('Unexpected MessagePack type: ' + tag);
  }
  const result = value();
  assert.equal(offset, bytes.length);
  assert.deepEqual(result[0], { format: 'cB', version: 1 });
  return result.slice(1);
}

function build() {
  const source = fs.readFileSync(path.join(sourceDir, 'small_en.msgpack.gz'));
  const provenance = JSON.parse(fs.readFileSync(path.join(sourceDir, 'provenance.json')));
  const hash = crypto.createHash('sha256').update(source).digest('hex');
  assert.equal(hash, 'f94a80cba6a3857b260d0666b5432bb7ea9b85315574dee9c306e87f61298247');
  assert.equal(hash, provenance.files['small_en.msgpack.gz'].sha256);
  const pack = decodeCBpack(zlib.gunzipSync(source));
  const seen = new Set(), bins = [];
  pack.forEach((words, index) => {
    assert(Array.isArray(words) && words.every(w => typeof w === 'string'));
    const selected = words.filter(w => /^[a-z]+$/.test(w)).sort();
    for (const word of selected) { assert(!seen.has(word)); seen.add(word); }
    if (selected.length) bins.push([900 - index, selected.join(' ')]);
  });
  assert(bins.every(([zipf100]) => zipf100 >= 300 && zipf100 <= 800));
  const payload = { format: 'ggg-frequency-v1', source: 'wordfreq-3.1.1-small-en',
    commit: provenance.commit, sourceSha256: hash, license: 'CC-BY-SA-4.0',
    attribution: 'Robyn Speer; SUBTLEX authors; see wordfreq-NOTICE.md and README.md',
    modifications: 'Only lowercase ASCII alphabetic tokens; Zipf hundredths grouped into space-separated bins.',
    wordCount: seen.size, bins };
  const bytes = Buffer.from(JSON.stringify(payload) + '\n');
  const destination = path.join(root, 'assets/language');
  if (process.argv.includes('--check')) {
    assert.deepEqual(fs.readFileSync(path.join(destination, 'english-frequency.json')), bytes);
  } else {
    fs.mkdirSync(destination, { recursive: true });
    fs.writeFileSync(path.join(destination, 'english-frequency.json'), bytes);
    for (const name of ['NOTICE.md', 'LICENSE.txt']) fs.copyFileSync(path.join(sourceDir, name), path.join(destination, 'wordfreq-' + name));
  }
  console.log(JSON.stringify({ words: seen.size, bytes: bytes.length, gzipBytes: zlib.gzipSync(bytes).length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex') }));
  return payload;
}
if (require.main === module) build();
module.exports = { build, decodeCBpack };
