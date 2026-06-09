// =====================================================
// Word Detective - game.js (STABLE CLEAN VERSION)
// Depends on: hints.js
// =====================================================

window.addEventListener("load", () => {
    // ---------- Admin panel toggle (Control + Option + Shift + M) ----------
  const adminPanel = document.getElementById("adminPanel");
  if (adminPanel) adminPanel.classList.add("hidden");
// ---------- Puzzle image (optional, per puzzle, in memory) ----------
let puzzleImageDataUrl = null;
// ---------- Player image view elements ----------
const holdImageBtn = document.getElementById("holdImageBtn");
const imageOverlay = document.getElementById("imageOverlay");
const puzzleImageEl = document.getElementById("puzzleImage");

  document.addEventListener("keydown", (event) => {
  if (event.code === "KeyM" && event.ctrlKey && event.altKey && event.shiftKey) {
    event.preventDefault();
    if (!adminPanel) return;
    adminPanel.classList.toggle("hidden");

    if (document.activeElement) {
      document.activeElement.blur();
    }
  }
});

  // ---------- STATE ----------
  let isGameOver = false;
  let strikeCount = 0;
  let hintRevealCount = 0;
  let score = 0;
  let typedBuffer = "";
  let gameEnded = false;
  let currentPuzzleIndex = -1;

  let puzzleList = [];


  const MAX_STRIKES = 5;

  // ---------- ELEMENTS ----------
  const puzzleArea = document.getElementById("puzzleArea");
  const messageEl = document.getElementById("message");
  const scoreEl = document.getElementById("scoreDisplay");
  const strikeEl = document.getElementById("strikeDisplay");
  const winBanner = document.getElementById("winBanner");
  const endingImage = document.getElementById("endingImage");
    const endGameBtn = document.getElementById("endGameBtn");
  const nextPuzzleBtn = document.getElementById("nextPuzzleBtn");
  if (endGameBtn) {
    endGameBtn.addEventListener("click", () => {
      if (gameEnded) return;
      gameEnded = true;
      

      revealAllLetters();
      lockGame("answer");
    });
  }

  if (nextPuzzleBtn) {
    nextPuzzleBtn.addEventListener("click", loadNextPuzzle);
  }

  async function loadPuzzleList() {
    try {
      const response = await fetch("puzzles/puzzle-list.json");
      if (!response.ok) {
        throw new Error(`Could not load puzzle-list.json: ${response.status}`);
      }

      puzzleList = await response.json();
    } catch (error) {
      console.error("Puzzle list failed to load.", error);
      setMessage("Puzzle list failed to load.");
      puzzleList = [];
    }
  }

  async function loadNextPuzzle() {
    if (puzzleList.length === 0) {
      puzzleImageDataUrl = null;
      setMessage("No saved puzzles yet.");
      return;
    }

    currentPuzzleIndex = (currentPuzzleIndex + 1) % puzzleList.length;

    try {
      const response = await fetch(puzzleList[currentPuzzleIndex]);
      if (!response.ok) {
        throw new Error(`Could not load puzzle file: ${response.status}`);
      }

      const puzzle = await response.json();
      puzzleImageDataUrl = puzzle.image || null;
      renderPuzzle(puzzle.text);
    } catch (error) {
      console.error("Puzzle file failed to load.", error);
      setMessage("Puzzle file failed to load.");
    }
  }
  // ---------- END GAME BUTTON HELPERS ----------
  function revealAllLetters() {
    const blocks = document.querySelectorAll(".letter-block");
    blocks.forEach((block) => {
      const answer = block.dataset.letter || "";
      if (answer && (block.textContent || "").trim() === "") {
        block.textContent = answer;
        block.classList.remove("typing-preview");
      }
    });
  }

  function showEnding(type) {
    winBanner.classList.remove("hidden", "ending-complete", "ending-answer");
    winBanner.classList.add(type === "complete" ? "ending-complete" : "ending-answer");

    if (endingImage) {
      endingImage.src =
        type === "complete"
          ? "assets/images/ending-complete.png"
          : "assets/images/ending-answer.png";
      endingImage.alt =
        type === "complete"
          ? "Puzzle complete!"
          : "Answer shown. Game ended.";
    }
  }

  function clearEnding() {
    winBanner.classList.add("hidden");
    winBanner.classList.remove("ending-complete", "ending-answer");
    if (endingImage) {
      endingImage.removeAttribute("src");
      endingImage.alt = "";
    }
  }

  function lockGame(type) {
    // Lock both flags used in this file
    isGameOver = true;
    gameEnded = true;

    // Disable the end game button
    if (endGameBtn) endGameBtn.disabled = true;

    showEnding(type);

    // Optional: clear selection highlight so it looks "ended"
    document
      .querySelectorAll(".word-group.selected")
      .forEach((g) => g.classList.remove("selected"));

    // Clear any preview letters
    const group = getSelectedGroup();
    if (group) clearPreview(group);

    typedBuffer = "";
    setMessage("");
  }

// ---------- IMAGE FILE HELPER ----------
function readImageFileAsDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

  // ---------- HELPERS ----------
    // TEMP: underline words that have some revealed letters but are not finished
  function updatePartialUnderlineForGroup(group) {
    if (!group) return;

    // Never underline completed words
    if (group.classList.contains("revealed")) {
      group.classList.remove("partial");
      return;
    }

    const blocks = Array.from(group.querySelectorAll(".letter-block"));
    if (blocks.length === 0) {
      group.classList.remove("partial");
      return;
    }

    const revealedCount = blocks.filter(isBlockRevealed).length;

    if (revealedCount > 0 && revealedCount < blocks.length) {
      group.classList.add("partial");
    } else {
      group.classList.remove("partial");
    }
  }

  function updateAllPartialUnderlines() {
    document
      .querySelectorAll(".word-group")
      .forEach(updatePartialUnderlineForGroup);
  }

  function setMessage(msg) {
    messageEl.textContent = msg || "";
  }

  function updateScore() {
    scoreEl.textContent = `Score: ${score}`;
  }

  function updateStrikes() {
    strikeEl.textContent = `Strikes: ${strikeCount}`;
  }

  function isBlockRevealed(block) {
    return (
      block &&
      !block.classList.contains("typing-preview") &&
      (block.textContent || "").trim() !== ""
    );
  }

  function clearPreview(group) {
    if (!group) return;
    group.querySelectorAll(".letter-block").forEach((b) => {
      if (b.classList.contains("typing-preview")) {
        b.textContent = "";
        b.classList.remove("typing-preview");
      }
    });
  }

  function getSelectedGroup() {
    return document.querySelector(".word-group.selected");
  }

  function getActualWord(group) {
    return Array.from(group.querySelectorAll(".letter-block"))
      .map((b) => b.dataset.letter || "")
      .join("");
  }

  function checkWin() {
    const blocks = document.querySelectorAll(".letter-block");
    for (const b of blocks) {
      if (!isBlockRevealed(b)) return false;
    }
    return true;
  }

  function endGame() {
    lockGame("complete");
  }

  // ---------- CORE GUESS PIPELINE ----------
  function submitGuess(rawGuess) {
    if (isGameOver) return;
    if (gameEnded) return;


    const group = getSelectedGroup();
    if (!group) {
      setMessage("Click a word first.");
      return;
    }

    const guess = (rawGuess || "").trim();
    if (!guess) return;

    const actual = getActualWord(group);
    const blocks = Array.from(group.querySelectorAll(".letter-block"));
    
    // Length check
    if (guess.length !== actual.length) {
      setMessage("Wrong length.");
      return;
    }

    // Must match revealed letters
    for (let i = 0; i < blocks.length; i++) {
      if (
        isBlockRevealed(blocks[i]) &&
        guess[i].toLowerCase() !== blocks[i].textContent.toLowerCase()
      ) {
        setMessage("Does not match revealed letters.");
        return;
      }
    }

    // ---------- CORRECT ----------
    if (guess.toLowerCase() === actual.toLowerCase()) {
      clearPreview(group);

      let newlyRevealed = 0;
      blocks.forEach((b) => {
        if (!isBlockRevealed(b)) newlyRevealed++;
        b.textContent = b.dataset.letter || "";
        b.classList.remove("typing-preview");
      });

      score += newlyRevealed;
      updateScore();

      strikeCount = 0;
      hintRevealCount = 0;
      updateStrikes();

      group.classList.remove("selected");
      group.classList.add("revealed");
            updatePartialUnderlineForGroup(group);


      typedBuffer = "";
      setMessage("Correct!");

      if (checkWin()) endGame();
      return;
    }

    // ---------- WRONG (VALID) ----------
    clearPreview(group);
    typedBuffer = "";

    strikeCount += 1;

    if (strikeCount < MAX_STRIKES) {
      updateStrikes();
      setMessage("Wrong.");
      return;
    }

    // ---------- STRIKE THRESHOLD → HINT ----------
    strikeCount = 0;
    updateStrikes();

    const allGroups = document.querySelectorAll(".word-group");
    hintRevealCount += 1;

    const hint = Hints.evaluate({
      allGroups,
      hintRevealCount,
    });

    let didReveal = false;

    if (hint && hint.action === "revealOne") {
      const g = allGroups[hint.groupIndex];
      if (g) {
        const b = g.querySelectorAll(".letter-block")[hint.letterIndex];
        if (b && !isBlockRevealed(b)) {
          b.textContent = b.dataset.letter || "";
          b.classList.remove("typing-preview");
          didReveal = true;
        }
      }
    }

        if (didReveal) {
      updateAllPartialUnderlines();
      setMessage("Hint revealed!");
      if (checkWin()) endGame();
    } else {
      setMessage("No eligible hints remaining.");
    }

  }

  // ---------- DIRECT TYPING ONLY ----------
  // ---------- Hold-to-view image (player) ----------
if (holdImageBtn && imageOverlay) {
  holdImageBtn.addEventListener("pointerdown", (e) => {
    if (!puzzleImageDataUrl) return;
    e.preventDefault();
    holdImageBtn.setPointerCapture(e.pointerId);
    imageOverlay.style.display = "flex";
    imageOverlay.setAttribute("aria-hidden", "false");
  });

  const hideOverlay = () => {
    imageOverlay.style.display = "none";
    imageOverlay.setAttribute("aria-hidden", "true");
  };

  holdImageBtn.addEventListener("pointerup", hideOverlay);
  holdImageBtn.addEventListener("pointercancel", hideOverlay);
  holdImageBtn.addEventListener("pointerleave", hideOverlay);
}

  document.addEventListener("keydown", (event) => {
    if (isGameOver) return;

    const active = document.activeElement;
    if (
      active &&
      (active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.isContentEditable)
    )
      return;

    const group = getSelectedGroup();
    if (!group) return;

    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const blocks = Array.from(group.querySelectorAll(".letter-block"));
const hiddenIndices = blocks
  .map((b, i) => (!isBlockRevealed(b) ? i : null))
  .filter((i) => i !== null);

    if (event.key === "Enter") {
  event.preventDefault();

  // Must fill ALL missing letters before submitting
  if (typedBuffer.length !== hiddenIndices.length) {
    setMessage("Type the remaining letters.");
    return; // invalid (no strike)
  }

  // Reconstruct the full guess using revealed letters + typed missing letters
  let j = 0;
  const fullGuess = blocks
    .map((b, i) => {
      if (isBlockRevealed(b)) return (b.textContent || "").trim();
      const ch = typedBuffer[j] || "";
      j += 1;
      return ch;
    })
    .join("");

  submitGuess(fullGuess);

  clearPreview(group);
  typedBuffer = "";
  return;
}


    if (event.key === "Backspace") {
      typedBuffer = typedBuffer.slice(0, -1);
      event.preventDefault();
    } else if (/^[a-zA-Z]$/.test(event.key)) {
  // Player types ONLY the missing letters
  if (typedBuffer.length < hiddenIndices.length) {
    typedBuffer += event.key;
  }
} else {
  return;
}


   // Update preview ONLY in hidden positions, left-to-right
for (let k = 0; k < hiddenIndices.length; k++) {
  const i = hiddenIndices[k];
  const b = blocks[i];
  const ch = typedBuffer[k];

  if (ch) {
    b.textContent = ch;
    b.classList.add("typing-preview");
  } else {
    if (b.classList.contains("typing-preview")) {
      b.textContent = "";
      b.classList.remove("typing-preview");
    }
  }
}

  });

  // ---------- RENDER ----------
  function renderPuzzle(text) {
        // Update player image button visibility for this puzzle
    if (puzzleImageDataUrl && holdImageBtn) {
      puzzleImageEl.src = puzzleImageDataUrl;
      holdImageBtn.style.display = "inline-block";
    } else if (holdImageBtn) {
      holdImageBtn.style.display = "none";
      puzzleImageEl.removeAttribute("src");
    }

    if (imageOverlay) {
      imageOverlay.style.display = "none";
      imageOverlay.setAttribute("aria-hidden", "true");
    }

    puzzleArea.innerHTML = "";
    window.currentDialogueWordsContainer = null;
    isGameOver = false;
    clearEnding();

    strikeCount = 0;
    hintRevealCount = 0;
    score = 0;
    typedBuffer = "";
    gameEnded = false;
    updateScore();
    updateStrikes();
    setMessage("");
    if (endGameBtn) endGameBtn.disabled = false;
    const words = text.split(/\s+/).filter(Boolean);
    applyPuzzleBlockScale(words);

    words.forEach((word) => {
      const group = document.createElement("div");
      group.className = "word-group";

            group.addEventListener("mouseenter", () => {
        if (isGameOver) return;

        const active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) active.blur();

        if (group.classList.contains("revealed")) return;

        document
          .querySelectorAll(".word-group")
          .forEach((g) => {
            clearPreview(g);
            g.classList.remove("selected");
          });

        group.classList.add("selected");
        typedBuffer = "";
        clearPreview(group);
        setMessage("");
      });
// Speaker label rule:
// If a word is like JOHN: or MARY:, show it normally.
// Also start a new visual line BEFORE each speaker name, except the first one.
if (/^[A-Za-z]+:$/.test(word)) {
  const row = document.createElement("div");
  row.className = "dialogue-line";

  const speaker = document.createElement("div");
  speaker.className = "speaker-label";
  speaker.textContent = word;

  const wordsContainer = document.createElement("div");
  wordsContainer.className = "dialogue-words";

  row.appendChild(speaker);
  row.appendChild(wordsContainer);

  puzzleArea.appendChild(row);

  window.currentDialogueWordsContainer = wordsContainer;
  return;
}
             let lastLetterBlock = null;

      for (const ch of word) {
        // Letters become blocks
        if (/^[A-Za-z]$/.test(ch)) {
          const block = document.createElement("div");
          block.className = "letter-block";
          block.dataset.letter = ch;
          block.textContent = "";
          group.appendChild(block);
          lastLetterBlock = block;
          continue;
        }

        // Non-letters: punctuation/symbols
        const punct = document.createElement("span");
        punct.className = "punct";
        punct.textContent = ch;

        // Trailing punctuation attaches to the previous letter block
        // (commas/periods/etc should appear bottom-right of the last letter)
                if (lastLetterBlock && /[.,!?;:]/.test(ch)) {
  const existing = lastLetterBlock.dataset.trailing || "";
  lastLetterBlock.dataset.trailing = existing + ch;
  group.classList.add("has-trailing");
} else {
  group.appendChild(punct);
}


      }



            if (window.currentDialogueWordsContainer) {
        window.currentDialogueWordsContainer.appendChild(group);
      } else {
        puzzleArea.appendChild(group);
      }
    });
  }

  function applyPuzzleBlockScale(words) {
    const letterCount = words.reduce((total, word) => {
      return total + Array.from(word).filter((ch) => /^[A-Za-z]$/.test(ch)).length;
    }, 0);

    let blockSize = 60;
    if (letterCount > 150) blockSize = 38;
    else if (letterCount > 110) blockSize = 44;
    else if (letterCount > 75) blockSize = 50;

    puzzleArea.style.setProperty("--block-size", blockSize + "px");
    puzzleArea.style.setProperty("--block-font-size", Math.max(18, Math.round(blockSize * 0.4)) + "px");
    puzzleArea.style.setProperty("--punct-font-size", Math.max(22, Math.round(blockSize * 0.5)) + "px");
    puzzleArea.style.setProperty("--punct-offset", Math.max(4, Math.round(blockSize * 0.13)) + "px");
    puzzleArea.style.setProperty("--trailing-space", Math.max(14, Math.round(blockSize * 0.36)) + "px");
  }

  // ---------- ADMIN LOAD ----------
  document.getElementById("loadPuzzleBtn").addEventListener("click", async () => {
  const adminText = document.getElementById("adminText");
  const text = adminText.value.trim();
  if (!text) return;
  // Optional image (admin-only): store in memory for this puzzle
  const imageInput = document.getElementById("adminImageInput");
  const imageFile = imageInput ? imageInput.files[0] : null;
  puzzleImageDataUrl = await readImageFileAsDataUrl(imageFile);

  // Reset image input so the same file can be picked again later
  if (imageInput) imageInput.value = "";

  renderPuzzle(text);

  // IMPORTANT: move keyboard focus away from the textarea
  adminText.blur();
});


  // ---------- INIT ----------
  async function init() {
    updateScore();
    updateStrikes();
    await loadPuzzleList();
    loadNextPuzzle();
  }

  init();
});
