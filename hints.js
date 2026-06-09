console.log("hints.js LOADED");

/*
=========================================================
HINTS.JS — SINGLE SOURCE OF TRUTH FOR HINT LOGIC

PUBLIC CONTRACT:
- Hints.evaluate({ allGroups, hintRevealCount })
- Returns:
    { action: "revealOne", groupIndex, letterIndex }
  OR null
=========================================================
*/

window.Hints = {
  config: {
    triggerStrikeCount: 5,
    revealPercent: 0.05,
    minEligibleBlocks: 20,
  },

  evaluate(state) {
    if (!state || !state.allGroups) return null;

    const groups = Array.from(state.allGroups);
    const revealCount = Number(state.hintRevealCount || 0);
    if (groups.length === 0) return null;

    const consonants = [];
    const vowels = [];

    groups.forEach((group, groupIndex) => {
      const blocks = Array.from(group.querySelectorAll(".letter-block"));
      if (!blocks.length) return;

      blocks.forEach((block, letterIndex) => {
        const letter = (block.dataset.letter || "").toUpperCase();
        if (!letter) return;

        const isHidden = (block.textContent || "").trim() === "";
        if (!isHidden) return;

        const isVowel = ["A", "E", "I", "O", "U"].includes(letter);

        (isVowel ? vowels : consonants).push({ groupIndex, letterIndex });
      });
    });

    if (consonants.length === 0 && vowels.length === 0) return null;

    let pool = [];
    if (revealCount === 0) {
      pool = consonants.length ? consonants : vowels;
    } else if (revealCount === 1 || revealCount === 2) {
      pool =
        consonants.length && Math.random() < 0.8
          ? consonants
          : vowels.length
          ? vowels
          : consonants;
    } else if (revealCount === 3) {
      pool =
        consonants.length && Math.random() < 0.6
          ? consonants
          : vowels.length
          ? vowels
          : consonants;
    } else {
      pool = consonants.concat(vowels);
    }

    if (!pool.length) return null;

    const pick = pool[Math.floor(Math.random() * pool.length)];

    return {
      action: "revealOne",
      groupIndex: pick.groupIndex,
      letterIndex: pick.letterIndex,
    };
  },
};
