const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function group(word, trailing = '') {
  const classes = new Set(trailing ? ['has-trailing'] : []);
  const blocks = [...word].map(letter => ({
    dataset: { letter, revealed: 'false' }, textContent: '',
    classList: { contains: name => name === 'capital-letter' && /[A-Z]/.test(letter) },
  }));
  blocks.at(-1).dataset.trailing = trailing;
  return { dataset: {}, classList: { contains: c => classes.has(c), add: c => classes.add(c), remove: c => classes.delete(c) },
    querySelectorAll: () => blocks };
}
async function harness(file = path.join(root, 'game.js')) {
  const source = fs.readFileSync(file, 'utf8');
  let seed = 20260915;
  const math = Object.create(Math);
  math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const ctx = vm.createContext({ console, Math: math, groups: ['The','cat','sat','on','the','mat'].map((w,i) => group(w,i===5?'.':'')),
    aiLogicSettings: JSON.parse(read('ai-logic-settings.json')), aiGuessNumber: 1,
    puzzleList: ['puzzles/puzzle-002.json'], currentPuzzleIndex: 0,
    wrongAiGuessesBySlot: new Map(),
    ...Object.fromEntries([1,2,3,5].map(n => [n === 1 ? 'vault1Words' : `vault${n}ByPuzzle`, JSON.parse(read(`vaults/vault-${n}.json`))[n === 1 ? 'words' : 'puzzles']])),
    fetch: async file => ({ ok: true, text: async () => read(file), json: async () => JSON.parse(read(file)) }),
  });
  ctx.window = ctx;
  ctx.document = { querySelectorAll: () => ctx.groups };
  ctx.getActualWord = g => g.querySelectorAll().map(b => b.dataset.letter).join('');
  ctx.isBlockRevealed = b => b.dataset.revealed === 'true';
  vm.runInContext(read('assets/dictionary/dictionary-manager.js') + read('vaults/vault-4.js'), ctx);
  await ctx.vault4Ready;
  vm.runInContext(source.slice(source.indexOf('  const INCORRECT_SOURCE_WEIGHTS'), source.indexOf('  // ---------- ELEMENTS ----------')), ctx);
  // Load the actual decision functions, without starting the browser lifecycle.
  const functions = [...source.matchAll(/^  (?:async )?function (\w+)\(/gm)];
  for (let i = 0; i < functions.length; i++) {
    const start = functions[i].index;
    const end = source.indexOf('\n  }', start) + 4;
    vm.runInContext(source.slice(start, end), ctx);
  }
  return ctx;
}
module.exports = { harness, group, root };
if (require.main === module) (async () => {
  const h = await harness(process.argv[2]);
  const slots = h.getEligibleAiSlots();
  const pool = await h.buildAiCandidatePool(slots[0]);
  console.log('slot weights', slots.map(s => h.getAiSlotSelectionWeight(s,true,h.groups)));
  console.log('correct', pool.correctCandidates);
  console.log('sources', Object.fromEntries(Object.entries(pool.incorrectCandidatesBySource).map(([s,c]) => [s,c.map(x=>x.word)])));
  const counts = {}, slotCounts = Array(6).fill(0);
  for(let i=0;i<30000;i++) { slotCounts[h.chooseAiTargetSlot().slotIndex]++; const w=h.chooseFinalAiCandidate(pool,1).word.toLowerCase(); counts[w]=(counts[w]||0)+1; }
  console.log('slots / 30000',slotCounts);
  console.log('words / 30000',Object.entries(counts).sort((a,b)=>b[1]-a[1]));
})().catch(e => { console.error(e); process.exitCode=1; });
