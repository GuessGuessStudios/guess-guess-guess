// =====================================================
// Guess Guess Guess - game.js (STABLE CLEAN VERSION)
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
  let hoveredGroup = null;
  let gameEnded = false;
  let currentPuzzleIndex = -1;
  let currentAttempt = createAttempt();
  let wrongFeedback = null;

  let puzzleList = [];


  const MAX_STRIKES = 5;
  const SUBMISSION_GRACE_PERIOD = 250;
  const WRONG_GUESS_DISPLAY_MS = 750;

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

      cancelWrongFeedback();
      cancelAttemptTimers(currentAttempt);
      if (currentAttempt.group) {
        clearPreview(currentAttempt.group);
      }
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
      if (answer && !isBlockRevealed(block)) revealBlock(block);
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
    const group = currentAttempt.group;
    cancelWrongFeedback();
    cancelAttemptTimers(currentAttempt);
    if (group) {
      clearPreview(group);
    }
    currentAttempt = createAttempt();

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
    return Boolean(block && block.dataset.revealed === "true");
  }

  function revealBlock(block) {
    block.textContent = block.dataset.letter || "";
    block.classList.remove("typing-preview");
    block.dataset.revealed = "true";
  }

  function clearCapitalizationEditing(group) {
    if (!group) return;

    group
      .querySelectorAll(
        ".capitalization-error, .capitalization-editable, .capitalization-selected"
      )
      .forEach((block) => {
        block.classList.remove(
          "capitalization-error",
          "capitalization-editable",
          "capitalization-selected"
        );
      });

    if (currentAttempt.group === group) {
      currentAttempt.selectedCapitalizationBlock = null;
    }
  }

  function clearPreview(group) {
    if (!group) return;
    group.querySelectorAll(".letter-block").forEach((b) => {
      if (!isBlockRevealed(b)) {
        b.textContent = "";
        b.classList.remove("typing-preview");
      }
    });
    clearCapitalizationEditing(group);
  }

  function createAttempt(group = null, selectionSource = "click") {
    return {
      group,
      selectionSource,
      typedCharacters: "",
      phase: "typing",
      submissionTimer: null,
      selectedCapitalizationBlock: null,
    };
  }

  function cancelSubmissionTimer(attempt) {
    if (attempt.submissionTimer) clearTimeout(attempt.submissionTimer);
    attempt.submissionTimer = null;
    if (attempt.phase === "grace") attempt.phase = "typing";
  }

  function cancelAttemptTimers(attempt) {
    cancelSubmissionTimer(attempt);
  }

  function getSelectedGroup() {
    if (
      currentAttempt.group &&
      currentAttempt.group.isConnected &&
      currentAttempt.group.classList.contains("selected") &&
      !currentAttempt.group.classList.contains("revealed")
    ) {
      return currentAttempt.group;
    }

    cancelAttemptTimers(currentAttempt);
    currentAttempt = createAttempt();
    return null;
  }

  function selectGroup(group, source = "click") {
    if (
      wrongFeedback ||
      !group ||
      group.classList.contains("revealed")
    ) return;

    const active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
      active.blur();
    }

    const previousGroup = getSelectedGroup();
    if (previousGroup === group) {
      cancelSubmissionTimer(currentAttempt);
      group.focus({ preventScroll: true });
      setMessage("");
      return;
    }

    if (previousGroup) {
      cancelAttemptTimers(currentAttempt);
      clearPreview(previousGroup);
      previousGroup.classList.remove("selected");
    }

    group.classList.remove("hovered");
    group.classList.add("selected");
    currentAttempt = createAttempt(group, source);
    group.focus({ preventScroll: true });
    setMessage("");
  }

  function getActualWord(group) {
    return Array.from(group.querySelectorAll(".letter-block"))
      .map((b) => b.dataset.letter || "")
      .join("");
  }

  function getHiddenBlocks(group) {
    return Array.from(group.querySelectorAll(".letter-block"))
      .filter((block) => !isBlockRevealed(block));
  }

  function renderAttemptPreview(attempt) {
    if (!attempt.group) return;

    getHiddenBlocks(attempt.group).forEach((block, index) => {
      const character = attempt.typedCharacters[index] || "";
      block.textContent = character;
      block.classList.toggle("typing-preview", Boolean(character));
    });
  }

  function buildFullGuess(attempt) {
    let j = 0;
    return Array.from(attempt.group.querySelectorAll(".letter-block"))
      .map((b) => {
        if (isBlockRevealed(b)) return (b.textContent || "").trim();
        const ch = attempt.typedCharacters[j] || "";
        j += 1;
        return ch;
      })
      .join("");
  }

  function getCapitalizationErrorBlocks(blocks, guess, actual) {
    if (guess.toLowerCase() !== actual.toLowerCase()) return [];

    return blocks.filter((block, index) => guess[index] !== actual[index]);
  }

  function showCapitalizationFeedback(blocks) {
    if (blocks.length > 0) {
      clearCapitalizationEditing(blocks[0].closest(".word-group"));
    }

    blocks.forEach((block) => {
      block.classList.add("capitalization-error", "capitalization-editable");
    });

    setMessage("Check capitalization.");
  }

  function makeCapitalizationErrorsEditable(attempt, blocks) {
    clearCapitalizationEditing(attempt.group);

    blocks.forEach((block) => {
      block.classList.add("capitalization-error", "capitalization-editable");
    });
    attempt.selectedCapitalizationBlock = null;
    setMessage("Check capitalization.");
  }

  function selectCapitalizationBlock(block) {
    if (
      !currentAttempt.group ||
      !currentAttempt.group.contains(block) ||
      !block.classList.contains("capitalization-editable")
    ) return;

    currentAttempt.group
      .querySelectorAll(".capitalization-selected")
      .forEach((selectedBlock) => {
        selectedBlock.classList.remove("capitalization-selected");
        selectedBlock.classList.add("capitalization-error");
      });

    block.classList.remove("capitalization-error");
    block.classList.add("capitalization-selected");
    currentAttempt.selectedCapitalizationBlock = block;
  }

  function replaceSelectedCapitalizationLetter(attempt, character) {
    const block = attempt.selectedCapitalizationBlock;
    if (!block || !block.classList.contains("capitalization-editable")) return;

    const hiddenBlocks = getHiddenBlocks(attempt.group);
    const characterIndex = hiddenBlocks.indexOf(block);
    if (characterIndex < 0) return;

    const characters = Array.from(attempt.typedCharacters);
    characters[characterIndex] = character;
    attempt.typedCharacters = characters.join("");
    attempt.selectedCapitalizationBlock = null;
    renderAttemptPreview(attempt);

    submitGuess(attempt, buildFullGuess(attempt), {
      flashCapitalizationErrors: false,
    });
  }

  function submitCurrentGuess(attempt = currentAttempt) {
    if (attempt !== currentAttempt || !attempt.group) return;

    cancelSubmissionTimer(attempt);
    if (attempt.typedCharacters.length !== getHiddenBlocks(attempt.group).length) {
      setMessage("Type the remaining letters.");
      return;
    }

    submitGuess(attempt, buildFullGuess(attempt));
  }

  function scheduleCurrentGuessSubmission(attempt) {
    cancelSubmissionTimer(attempt);
    attempt.phase = "grace";
    attempt.submissionTimer = setTimeout(() => {
      if (attempt !== currentAttempt || attempt.phase !== "grace") return;
      attempt.submissionTimer = null;
      submitCurrentGuess(attempt);
    }, SUBMISSION_GRACE_PERIOD);
  }

  function isGameplayInputEvent(event) {
    const target = event.target;
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      (
        target &&
        (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        )
      )
    ) return false;

    return (
      /^[a-zA-Z]$/.test(event.key) ||
      ["Backspace", "Enter", "Escape"].includes(event.key)
    );
  }

  function removeFeedbackInputBlocker(feedback) {
    document.removeEventListener("keydown", feedback.blockKeydown, true);
    document.removeEventListener("keyup", feedback.releaseKeyup, true);
  }

  function clearWrongSnapshot(feedback) {
    feedback.group.classList.remove("wrong-guess");
    feedback.blocks.forEach((block) => {
      delete block.dataset.wrongSnapshotLetter;
    });
  }

  function cancelWrongFeedback() {
    if (!wrongFeedback) return;
    const feedback = wrongFeedback;
    clearTimeout(feedback.timer);
    clearWrongSnapshot(feedback);
    wrongFeedback = null;
    feedback.animationFinished = true;
  }

  function showWrongGuessFeedback(attempt) {
    const feedback = {
      group: attempt.group,
      selectionSource: attempt.selectionSource,
      blocks: getHiddenBlocks(attempt.group),
      timer: null,
      endsAt: performance.now() + WRONG_GUESS_DISPLAY_MS,
      animationFinished: false,
      pressedGameplayKeys: new Set(),
      blockKeydown: null,
      releaseKeyup: null,
    };

    feedback.blockKeydown = (event) => {
      if (!isGameplayInputEvent(event)) return;

      const keyId = event.code || event.key;
      const occurredDuringAnimation =
        !feedback.animationFinished ||
        (
          event.timeStamp > 0 &&
          event.timeStamp <= feedback.endsAt
        );

      if (occurredDuringAnimation) {
        feedback.pressedGameplayKeys.add(keyId);
      }

      if (
        feedback.animationFinished &&
        !occurredDuringAnimation &&
        !feedback.pressedGameplayKeys.has(keyId)
      ) {
        removeFeedbackInputBlocker(feedback);
        return;
      }

      if (
        occurredDuringAnimation ||
        feedback.pressedGameplayKeys.has(keyId)
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    feedback.releaseKeyup = (event) => {
      feedback.pressedGameplayKeys.delete(event.code || event.key);
    };

    feedback.blocks.forEach((block, index) => {
      block.dataset.wrongSnapshotLetter =
        attempt.typedCharacters[index] || "";
    });
    clearCapitalizationEditing(feedback.group);
    feedback.group.classList.add("wrong-guess");

    cancelAttemptTimers(attempt);
    attempt.typedCharacters = "";
    renderAttemptPreview(attempt);
    currentAttempt = createAttempt(
      feedback.group,
      feedback.selectionSource
    );

    wrongFeedback = feedback;
    document.addEventListener("keydown", feedback.blockKeydown, true);
    document.addEventListener("keyup", feedback.releaseKeyup, true);
    setMessage("Wrong.");

    feedback.timer = setTimeout(() => {
      if (wrongFeedback !== feedback) return;
      clearWrongSnapshot(feedback);
      wrongFeedback = null;
      feedback.animationFinished = true;
      processWrongGuess(feedback.group, feedback.selectionSource);
    }, WRONG_GUESS_DISPLAY_MS);
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
  function submitGuess(
    attempt,
    rawGuess,
    { flashCapitalizationErrors = true } = {}
  ) {
    if (isGameOver) return;
    if (gameEnded) return;
    if (attempt !== currentAttempt || !attempt.group) {
      setMessage("Click a word first.");
      return;
    }

    const group = attempt.group;
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

    const capitalizationErrorBlocks = getCapitalizationErrorBlocks(
      blocks,
      guess,
      actual
    );
    if (capitalizationErrorBlocks.length > 0) {
      if (flashCapitalizationErrors) {
        showCapitalizationFeedback(capitalizationErrorBlocks);
      } else {
        makeCapitalizationErrorsEditable(attempt, capitalizationErrorBlocks);
      }
      return;
    }

    // ---------- CORRECT ----------
    if (guess === actual) {
      clearPreview(group);

      let newlyRevealed = 0;
      blocks.forEach((b) => {
        if (!isBlockRevealed(b)) newlyRevealed++;
        revealBlock(b);
      });

      score += newlyRevealed;
      updateScore();

      strikeCount = 0;
      hintRevealCount = 0;
      updateStrikes();

      group.classList.remove("selected");
      group.classList.add("revealed");
      currentAttempt = createAttempt();
      updatePartialUnderlineForGroup(group);
      setMessage("Correct!");

      if (checkWin()) endGame();
      return;
    }

    // ---------- WRONG (VALID) ----------
    showWrongGuessFeedback(attempt);
  }

  function processWrongGuess(group, selectionSource) {
    if (selectionSource === "hover") {
      if (hoveredGroup === group) {
        group.classList.add("hovered");
      } else {
        group.classList.remove("selected");
      }
      if (currentAttempt.group === group) currentAttempt = createAttempt();
    }

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
          revealBlock(b);
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

    if (event.ctrlKey || event.metaKey || event.altKey) return;

    let group = getSelectedGroup();
    if (!group) {
      if (/^[a-zA-Z]$/.test(event.key) && hoveredGroup) {
        selectGroup(hoveredGroup, "hover");
        group = getSelectedGroup();
      } else {
        return;
      }
    }

    const attempt = currentAttempt;
    const hiddenBlockCount = getHiddenBlocks(group).length;
    const isLetterKey = /^[a-zA-Z]$/.test(event.key);

    if (isLetterKey && attempt.selectedCapitalizationBlock) {
      event.preventDefault();
      replaceSelectedCapitalizationLetter(attempt, event.key);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      submitCurrentGuess(attempt);
      return;
    }

    if (event.key === "Escape") {
      cancelSubmissionTimer(attempt);
      clearCapitalizationEditing(group);
      attempt.typedCharacters = "";
      renderAttemptPreview(attempt);
      setMessage("");
      event.preventDefault();
      return;
    }

    if (event.key === "Backspace") {
      cancelSubmissionTimer(attempt);
      clearCapitalizationEditing(group);
      attempt.typedCharacters = attempt.typedCharacters.slice(0, -1);
      renderAttemptPreview(attempt);
      event.preventDefault();
      return;
    }

    if (!isLetterKey) return;

    cancelSubmissionTimer(attempt);
    if (attempt.typedCharacters.length >= hiddenBlockCount) return;

    attempt.typedCharacters += event.key;
    renderAttemptPreview(attempt);

    if (attempt.typedCharacters.length === hiddenBlockCount) {
      scheduleCurrentGuessSubmission(attempt);
    }

  });

  // ---------- RENDER ----------
  function renderPuzzle(text) {
    cancelWrongFeedback();
    cancelAttemptTimers(currentAttempt);
    if (currentAttempt.group) {
      clearPreview(currentAttempt.group);
    }
    currentAttempt = createAttempt();

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
    hoveredGroup = null;
    isGameOver = false;
    clearEnding();

    strikeCount = 0;
    hintRevealCount = 0;
    score = 0;
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
      group.tabIndex = -1;

            group.addEventListener("pointerover", (event) => {
        if (group.contains(event.relatedTarget)) return;
        if (isGameOver) return;
        if (group.classList.contains("revealed")) return;

        hoveredGroup = group;
        if (!getSelectedGroup()) {
          group.classList.add("hovered");
          group.classList.add("selected");
        }
      });

            group.addEventListener("pointerout", (event) => {
        if (group.contains(event.relatedTarget)) return;
        if (hoveredGroup === group) hoveredGroup = null;
        if (group.classList.contains("hovered")) {
          group.classList.remove("hovered");
          group.classList.remove("selected");
        }
      });

            group.addEventListener("click", () => {
        if (isGameOver) return;
        selectGroup(group);
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
          if (/^[A-Z]$/.test(ch)) {
            block.classList.add("capital-letter");
          }
          block.dataset.letter = ch;
          block.dataset.revealed = "false";
          block.textContent = "";
          block.addEventListener("click", (event) => {
            if (!block.classList.contains("capitalization-editable")) return;
            event.stopPropagation();
            selectCapitalizationBlock(block);
          });
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
