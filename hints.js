console.log("hints.js LOADED");

/*
HINTS.JS — SINGLE SOURCE OF TRUTH FOR HINT LOGIC
Hints.evaluate({ allGroups }) returns { action: "revealMany", letters: [...] }
or null. All selections use one public board snapshot, without revealing it.
*/
window.Hints = {
  config: { triggerStrikeCount: 5 },

  evaluate(state) {
    if (!state?.allGroups) return null;

    let total = 0;
    let unrevealed = 0;
    const words = Array.from(state.allGroups, (group, groupIndex) => {
      const letters = Array.from(group.querySelectorAll(".letter-block"), (block, letterIndex) => ({
        letter: (block.dataset.letter || "").toUpperCase(),
        hidden: block.dataset.revealed !== "true",
        letterIndex,
      })).filter(block => /^[A-Z]$/.test(block.letter));
      // Temporary wrong-guess previews never count as exposed letters.
      const currentSize = letters.filter(block => block.hidden).length;
      total += letters.length;
      unrevealed += currentSize;
      return { groupIndex, length: letters.length, currentSize,
        interior: letters.slice(1, -1).filter(block => block.hidden) };
    });

    const hintCount = unrevealed >= 45 ? 3 : unrevealed >= 21 ? 2 : 1;
    const shortWordsAllowed = total > 0 && (total - unrevealed) / total >= 0.75;
    const eligible = words.filter(word => word.interior.length && (word.length > 3 || shortWordsAllowed));
    if (!eligible.length) return null;

    const sizes = eligible.map(word => word.currentSize).sort((a, b) => a - b);
    const middle = Math.floor(sizes.length / 2);
    const median = sizes.length % 2 ? sizes[middle] : (sizes[middle - 1] + sizes[middle]) / 2;
    const higher = eligible.filter(word => word.currentSize >= median);
    const lower = eligible.filter(word => word.currentSize < median);
    // Exactly one 80/20 decision per event, followed by selection without replacement.
    const pools = Math.random() < 0.8 ? [higher, lower] : [lower, higher];
    const selected = [];
    for (const pool of pools) {
      while (pool.length && selected.length < hintCount) {
        selected.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      }
    }
    const letters = selected.map(word => {
      const consonants = word.interior.filter(block => !"AEIOU".includes(block.letter));
      const pool = consonants.length ? consonants : word.interior;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      return { groupIndex: word.groupIndex, letterIndex: pick.letterIndex };
    });
    return { action: "revealMany", letters };
  },
};
