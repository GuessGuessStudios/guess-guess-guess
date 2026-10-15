// =====================================================
// Guess Guess Guess - game.js (STABLE CLEAN VERSION)
// Depends on: hints.js
// =====================================================

window.addEventListener("load", () => {
  // ---------- Hidden administrator access ----------
  const adminPanel = document.getElementById("adminPanel");
  const adminAccessTrigger = document.getElementById("adminAccessTrigger");
  const adminAccessForm = document.getElementById("adminAccessForm");
  const adminAccessPassword = document.getElementById("adminAccessPassword");
  const adminAccessError = document.getElementById("adminAccessError");
  const closeAdminPanelBtn = document.getElementById("closeAdminPanelBtn");
  const adminMainMenu = document.getElementById("adminMainMenu");
  const createPuzzleForm = document.getElementById("createPuzzleForm");
  const createPuzzleText = document.getElementById("createPuzzleText");
  const createPuzzleBtn = document.getElementById("createPuzzleBtn");
  const importPuzzleImageBtn = document.getElementById("importPuzzleImageBtn");
  const createPuzzleImage = document.getElementById("createPuzzleImage");
  const createGameStatus = document.getElementById("createGameStatus");
  const openEditPuzzleBtn = document.getElementById("openEditPuzzleBtn");
  const editPuzzlePanel = document.getElementById("editPuzzlePanel");
  const editPuzzleSelector = document.getElementById("editPuzzleSelector");
  const editPuzzleText = document.getElementById("editPuzzleText");
  const editPuzzleCurrentImage = document.getElementById("editPuzzleCurrentImage");
  const editPuzzleCurrentImagePreview = document.getElementById("editPuzzleCurrentImagePreview");
  const editPuzzleCurrentImageLabel = document.getElementById("editPuzzleCurrentImageLabel");
  const removeEditPuzzleImageBtn = document.getElementById("removeEditPuzzleImageBtn");
  const chooseEditPuzzleImageBtn = document.getElementById("chooseEditPuzzleImageBtn");
  const editPuzzleImage = document.getElementById("editPuzzleImage");
  const editPuzzleSelectedImage = document.getElementById("editPuzzleSelectedImage");
  const savePuzzleChangesBtn = document.getElementById("savePuzzleChangesBtn");
  const cancelPuzzleEditBtn = document.getElementById("cancelPuzzleEditBtn");
  const editPuzzleStatus = document.getElementById("editPuzzleStatus");
  const currentPuzzleNumber = document.getElementById("currentPuzzleNumber");
  const LOCAL_PUZZLES_KEY = "ggg-local-puzzles-v1";
  let latestCreatedPuzzle = null;
  let isCreatingPuzzle = false;
  let puzzleList = [];
  let editingPuzzle = null;
  let editingImageRemoved = false;
  const AI_LOGIC_DEFAULTS = {
    timing: {
      firstGuess: [
        { minSeconds: 15, maxSeconds: 20, chance: 30 },
        { minSeconds: 21, maxSeconds: 30, chance: 70 },
      ],
      betweenGuesses: [
        { minSeconds: 2, maxSeconds: 5, chance: 5 },
        { minSeconds: 6, maxSeconds: 15, chance: 5 },
        { minSeconds: 16, maxSeconds: 25, chance: 80 },
        { minSeconds: 26, maxSeconds: 35, chance: 10 },
      ],
    },
    correctGuess: {
      entries: [
        { fromGuess: 1, chance: 2 },
        { fromGuess: 2, chance: 3 },
        { fromGuess: 3, chance: 10 },
        { fromGuess: 4, chance: 10 },
        { fromGuess: 5, chance: 15 },
        { fromGuess: 6, chance: 15 },
        { fromGuess: 7, chance: 15 },
        { fromGuess: 8, chance: 15 },
        { fromGuess: 9, chance: 15 },
      ],
      continuation: { fromGuess: 10, chance: 15 },
    },
    wordLength: {
      early: {
        fromGuess: 1,
        toGuess: 6,
        ranges: [
          { minLength: 1, maxLength: 4, chance: 60 },
          { minLength: 5, maxLength: 6, chance: 25 },
          { minLength: 7, chance: 15 },
        ],
      },
      later: {
        fromGuess: 7,
        ranges: [
          { minLength: 1, maxLength: 5, chance: 66 },
          { minLength: 6, chance: 34 },
        ],
      },
    },
    rules: {
      noCaseMistakes: true,
      noRepeatedWrongGuessSameSlot: true,
      allowSameWordDifferentSlot: true,
      neverGuessSolvedSlot: true,
    },
  };
  let aiLogicSettings = JSON.parse(JSON.stringify(AI_LOGIC_DEFAULTS));
  let aiLogicSettingsLoaded = false;
  if (adminPanel) adminPanel.classList.add("hidden");
  function showAdminAccess() {
    if (!adminAccessForm || !adminAccessPassword) return;
    adminAccessForm.classList.remove("hidden");
    if (adminAccessError) adminAccessError.textContent = "";
    adminAccessPassword.value = "";
    adminAccessPassword.focus();
  }

  function closeAdminPanel() {
    if (adminPanel) adminPanel.classList.add("hidden");
    document.body.classList.remove("admin-open");
    if (adminMainMenu) adminMainMenu.classList.remove("hidden");
    document.querySelectorAll(".admin-screen").forEach((screen) => {
      if (screen !== adminMainMenu) screen.classList.add("hidden");
    });
  }

  function cloneAiSettings(settings) {
    return JSON.parse(JSON.stringify(settings));
  }

  async function loadAiLogicSettings() {
    try {
      const response = await fetch("/api/ai-logic-settings");
      if (!response.ok) throw new Error("Saved AI settings could not be loaded.");
      aiLogicSettings = await response.json();
      aiLogicSettingsLoaded = true;
    } catch (error) {
      aiLogicSettingsLoaded = false;
      aiLogicSettings = cloneAiSettings(AI_LOGIC_DEFAULTS);
      console.error("Saved AI settings could not be loaded.", error);
    }
  }
  loadAiLogicSettings();

  let vault1Words = [];

  async function loadGlobalVault1() {
    try {
      const response = await fetch("vaults/vault-1.json");
      if (!response.ok) throw new Error(`Vault 1 failed to load: ${response.status}`);
      const vault = await response.json();
      const words = Array.isArray(vault.words) ? vault.words : [];
      vault1Words = words;
    } catch (error) {
      console.error("Vault 1 failed to load.", error);
    }
  }

  loadGlobalVault1();

  let vault3ByPuzzle = {};

  async function loadPuzzleVault3() {
    if (isHumanPlaytestMode()) return;
    try {
      const response = await fetch("vaults/vault-3.json");
      if (!response.ok) throw new Error(`Vault 3 failed to load: ${response.status}`);
      const vault = await response.json();
      vault3ByPuzzle = vault.puzzles && typeof vault.puzzles === "object" ? vault.puzzles : {};
    } catch (error) {
      console.error("Vault 3 failed to load.", error);
    }
  }

  loadPuzzleVault3();

  let vault5ByPuzzle = {};

  async function loadPuzzleVault5() {
    if (isHumanPlaytestMode()) return;
    try {
      const response = await fetch("vaults/vault-5.json");
      if (!response.ok) throw new Error(`Vault 5 failed to load: ${response.status}`);
      const vault = await response.json();
      vault5ByPuzzle = vault.puzzles && typeof vault.puzzles === "object" ? vault.puzzles : {};
    } catch (error) {
      console.error("Vault 5 failed to load.", error);
    }
  }

  loadPuzzleVault5();

  document.querySelectorAll("[data-admin-screen]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".admin-screen").forEach((screen) => screen.classList.add("hidden"));
      document.getElementById(button.dataset.adminScreen)?.classList.remove("hidden");
    });
  });

  document.querySelectorAll(".admin-back-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".admin-screen").forEach((screen) => screen.classList.add("hidden"));
      document.getElementById(button.dataset.adminBack || "adminMainMenu")?.classList.remove("hidden");
    });
  });

  if (adminAccessTrigger) {
    adminAccessTrigger.addEventListener("click", showAdminAccess);
    adminAccessTrigger.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      showAdminAccess();
    });
  }

  if (adminAccessForm) {
    adminAccessForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (adminAccessPassword.disabled) return;
      adminAccessPassword.disabled = true;
      if (adminAccessError) adminAccessError.textContent = "";
      try {
        const response = await fetch("/api/admin/login", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: adminAccessPassword.value }),
        });
        if (!response.ok) throw new Error("Administrator login failed.");
      } catch {
        if (adminAccessError) adminAccessError.textContent = "Administrator login failed.";
        return;
      } finally {
        adminAccessPassword.value = "";
        adminAccessPassword.disabled = false;
      }
      adminPanel.classList.remove("hidden");
      document.body.classList.add("admin-open");
      if (adminMainMenu) adminMainMenu.classList.remove("hidden");
      adminAccessForm.classList.add("hidden");
      adminAccessPassword.value = "";
      cancelAiTurn();
      resetHandRaiseState();
      gameStarted = false;
      updateStartGameButton();
    });
  }

  if (closeAdminPanelBtn) closeAdminPanelBtn.addEventListener("click", async () => {
    closeAdminPanelBtn.disabled = true;
    try {
      const response = await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error("Logout failed");
      closeAdminPanel();
    } catch {
      alert("Could not log out. Please try again, or stop the local server to end administrator access.");
    } finally {
      closeAdminPanelBtn.disabled = false;
    }
  });

  function readLocalPuzzles() {
    try {
      const stored = JSON.parse(localStorage.getItem(LOCAL_PUZZLES_KEY) || "[]");
      return Array.isArray(stored) ? stored.filter((p) => p && Number.isInteger(p.number) && p.text) : [];
    } catch {
      return [];
    }
  }

  function formatPuzzleNumber(number) {
    return String(number).padStart(3, "0");
  }

  function updateCreateStatus(message) {
    if (createGameStatus) createGameStatus.textContent = message;
  }

  function updateEditStatus(message) {
    if (editPuzzleStatus) editPuzzleStatus.textContent = message;
  }

  function projectPuzzleEntries() {
    return puzzleList
      .map((source, index) => ({ source, index }))
      .filter(({ source }) => typeof source === "string");
  }

  function puzzleNumberFromSource(source, fallback = 1) {
    return typeof source === "string"
      ? Number(source.match(/puzzle-(\d+)/)?.[1] || fallback)
      : Number(source?.number || fallback);
  }

  function populateEditPuzzleSelector() {
    if (!editPuzzleSelector) return;
    const entries = projectPuzzleEntries();
    editPuzzleSelector.replaceChildren(...entries.map(({ source, index }) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `Puzzle ${puzzleNumberFromSource(source, index + 1)}`;
      return option;
    }));
  }

  async function loadPuzzleForEditing() {
    if (!editPuzzleSelector) return;
    const source = puzzleList[Number(editPuzzleSelector.value)];
    if (typeof source !== "string") return;
    try {
      const response = await fetch(source);
      if (!response.ok) throw new Error("Puzzle could not be loaded");
      const puzzle = await response.json();
      editingPuzzle = {
        number: puzzleNumberFromSource(source),
        text: String(puzzle.text || ""),
        image: String(puzzle.image || ""),
      };
      editingImageRemoved = false;
      if (editPuzzleText) editPuzzleText.value = editingPuzzle.text;
      if (editPuzzleCurrentImageLabel) editPuzzleCurrentImageLabel.textContent = `Current image: ${editingPuzzle.image || "none"}`;
      if (editPuzzleCurrentImagePreview) {
        if (editingPuzzle.image) {
          editPuzzleCurrentImagePreview.src = editingPuzzle.image;
          editPuzzleCurrentImagePreview.style.display = "block";
        } else {
          editPuzzleCurrentImagePreview.removeAttribute("src");
          editPuzzleCurrentImagePreview.style.display = "none";
        }
      }
      if (editPuzzleImage) editPuzzleImage.value = "";
      if (editPuzzleSelectedImage) editPuzzleSelectedImage.textContent = "";
      updateEditStatus("");
    } catch (error) {
      editingPuzzle = null;
      updateEditStatus("The puzzle could not be loaded.");
    }
  }

  function closeEditPuzzle() {
    editingPuzzle = null;
    editingImageRemoved = false;
    if (editPuzzlePanel) editPuzzlePanel.classList.add("hidden");
    updateEditStatus("");
  }

  async function savePuzzleChanges() {
    if (!editingPuzzle || !editPuzzleText) return;
    const text = editPuzzleText.value.trim();
    const file = editPuzzleImage?.files?.[0];
    if (!text) {
      updateEditStatus("Enter puzzle text before saving.");
      return;
    }
    if (file && !/^image\/(jpeg|png)$/.test(file.type)) {
      updateEditStatus("Please choose a JPG, JPEG, or PNG image.");
      return;
    }
    if (savePuzzleChangesBtn) savePuzzleChangesBtn.disabled = true;
    updateEditStatus("Saving changes…");
    try {
      const extension = file ? (file.type === "image/png" ? "png" : "jpg") : "";
      const removeImage = !file && editingImageRemoved ? "1" : "0";
      const saveUrl = `/api/puzzles?number=${encodeURIComponent(editingPuzzle.number)}&text=${encodeURIComponent(text)}&extension=${extension}&removeImage=${removeImage}`;
      const response = await fetch(saveUrl, {
        method: "PUT",
        headers: file ? { "Content-Type": file.type } : {},
        body: file || undefined,
      });
      const responseText = await response.text();
      let result;
      try { result = JSON.parse(responseText); } catch { result = {}; }
      if (!response.ok) throw new Error(`Puzzle update failed (HTTP ${response.status}): ${result.error || responseText || response.statusText}`);
      if (result.vault3Cleared && vault3ByPuzzle) delete vault3ByPuzzle[String(editingPuzzle.number)];
      editingPuzzle.text = text;
      editingPuzzle.image = result.image || "";
      editingImageRemoved = false;
      if (editPuzzleCurrentImageLabel) editPuzzleCurrentImageLabel.textContent = `Current image: ${editingPuzzle.image || "none"}`;
      if (editPuzzleCurrentImagePreview) {
        if (editingPuzzle.image) {
          editPuzzleCurrentImagePreview.src = editingPuzzle.image;
          editPuzzleCurrentImagePreview.style.display = "block";
        } else {
          editPuzzleCurrentImagePreview.removeAttribute("src");
          editPuzzleCurrentImagePreview.style.display = "none";
        }
      }
      if (editPuzzleImage) editPuzzleImage.value = "";
      if (editPuzzleSelectedImage) editPuzzleSelectedImage.textContent = "";
      updateEditStatus(`Puzzle ${formatPuzzleNumber(editingPuzzle.number)} updated successfully.${result.vault3Cleared ? " Vault 3 needs to be regenerated." : ""}`);
    } catch (error) {
      updateEditStatus(error.message || "The puzzle could not be updated.");
    } finally {
      if (savePuzzleChangesBtn) savePuzzleChangesBtn.disabled = false;
    }
  }

  if (openEditPuzzleBtn) {
    openEditPuzzleBtn.addEventListener("click", async () => {
      await loadPuzzleList();
      populateEditPuzzleSelector();
      if (editPuzzlePanel) editPuzzlePanel.classList.remove("hidden");
      await loadPuzzleForEditing();
    });
  }
  if (editPuzzleSelector) editPuzzleSelector.addEventListener("change", loadPuzzleForEditing);
  if (chooseEditPuzzleImageBtn && editPuzzleImage) {
    chooseEditPuzzleImageBtn.addEventListener("click", () => editPuzzleImage.click());
  }
  if (removeEditPuzzleImageBtn) {
    removeEditPuzzleImageBtn.addEventListener("click", () => {
      editingImageRemoved = true;
      if (editPuzzleImage) editPuzzleImage.value = "";
      if (editPuzzleCurrentImagePreview) {
        editPuzzleCurrentImagePreview.removeAttribute("src");
        editPuzzleCurrentImagePreview.style.display = "none";
      }
      if (editPuzzleCurrentImageLabel) editPuzzleCurrentImageLabel.textContent = "Current image will be removed when you save.";
      if (editPuzzleSelectedImage) editPuzzleSelectedImage.textContent = "Choose a new image to replace it, or save to remove it.";
    });
  }
  if (editPuzzleImage) {
    editPuzzleImage.addEventListener("change", () => {
      const file = editPuzzleImage.files?.[0];
      if (!file) return;
      editingImageRemoved = false;
      if (editPuzzleSelectedImage) editPuzzleSelectedImage.textContent = `Selected image: ${file.name}`;
      if (editPuzzleCurrentImageLabel) editPuzzleCurrentImageLabel.textContent = `Current image: ${editingPuzzle?.image || "none"}`;
    });
  }
  if (savePuzzleChangesBtn) savePuzzleChangesBtn.addEventListener("click", savePuzzleChanges);
  if (cancelPuzzleEditBtn) cancelPuzzleEditBtn.addEventListener("click", closeEditPuzzle);

  function prepareNextPuzzleCreation() {
    latestCreatedPuzzle = null;
    if (createPuzzleText) {
      createPuzzleText.value = "";
      createPuzzleText.disabled = false;
    }
    if (createPuzzleBtn) createPuzzleBtn.disabled = false;
    if (importPuzzleImageBtn) importPuzzleImageBtn.disabled = true;
    if (createPuzzleImage) createPuzzleImage.value = "";
  }

  async function createPuzzle() {
    const text = createPuzzleText?.value.trim();
    if (!text) {
      updateCreateStatus("Enter puzzle text before creating the puzzle.");
      createPuzzleText?.focus();
      return;
    }
    if (isCreatingPuzzle || latestCreatedPuzzle) return;

    isCreatingPuzzle = true;
    if (createPuzzleBtn) createPuzzleBtn.disabled = true;
    updateCreateStatus("Creating puzzle…");

    try {
      // The service reserves the number without creating any files. Legacy
      // localStorage numbers are included so they cannot be reused.
      await loadPuzzleList();
      const legacyNumbers = readLocalPuzzles().map((puzzle) => puzzle.number);
      const numberResponse = await fetch(`/api/next-puzzle-number?legacyNumbers=${encodeURIComponent(JSON.stringify(legacyNumbers))}`);
      if (!numberResponse.ok) throw new Error("Local save service is not running");
      const { number } = await numberResponse.json();
      const puzzle = { number, text, image: null };
      latestCreatedPuzzle = puzzle;
      puzzleList.push(puzzle);
      populateEditPuzzleSelector();
      if (createPuzzleText) createPuzzleText.disabled = true;
      if (importPuzzleImageBtn) importPuzzleImageBtn.disabled = false;
      updateCreateStatus(`Puzzle ${formatPuzzleNumber(number)} created. Select Image to attach an image.`);
    } catch (error) {
      console.error("Puzzle creation failed.", error);
      updateCreateStatus("The local save service is unavailable. Start it, then try again.");
      if (createPuzzleBtn) createPuzzleBtn.disabled = false;
    } finally {
      isCreatingPuzzle = false;
    }
  }

  if (createPuzzleForm) {
    createPuzzleForm.addEventListener("submit", (event) => {
      event.preventDefault();
      createPuzzle();
    });
  }

  if (importPuzzleImageBtn && createPuzzleImage) {
    importPuzzleImageBtn.addEventListener("click", () => createPuzzleImage.click());
    createPuzzleImage.addEventListener("change", async () => {
      const file = createPuzzleImage.files?.[0];
      if (!file || !latestCreatedPuzzle) return;
      if (!/^image\/(jpeg|png)$/.test(file.type)) {
        updateCreateStatus("Please choose a JPG, JPEG, or PNG image.");
        createPuzzleImage.value = "";
        return;
      }
      updateCreateStatus("Saving puzzle and image…");
      try {
        const extension = file.type === "image/png" ? "png" : "jpg";
        const saveUrl = `/api/puzzles?number=${encodeURIComponent(latestCreatedPuzzle.number)}&text=${encodeURIComponent(latestCreatedPuzzle.text)}&extension=${extension}`;
        const response = await fetch(saveUrl, {
          method: "POST",
          headers: {
            "Content-Type": file.type,
          },
          body: file,
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Puzzle save failed");

        const activePuzzle = puzzleList.find((item) => (
          typeof item !== "string" && item.number === latestCreatedPuzzle.number
        ));
        if (activePuzzle) {
          activePuzzle.image = result.image;
          activePuzzle.imageName = result.image.split("/").pop();
        }
        updateCreateStatus(`Puzzle ${formatPuzzleNumber(latestCreatedPuzzle.number)} saved.`);
        prepareNextPuzzleCreation();
      } catch (error) {
        console.error("Puzzle image save failed.", error);
        updateCreateStatus(error.message || "The image could not be saved. Please try again.");
      }
    });
  }

// ---------- Puzzle image (optional, per puzzle, in memory) ----------
let puzzleImageDataUrl = null;
// ---------- Player image view elements ----------
const holdImageBtn = document.getElementById("holdImageBtn");
const imageOverlay = document.getElementById("imageOverlay");
const puzzleImageEl = document.getElementById("puzzleImage");

  // ---------- STATE ----------
  let isGameOver = false;
  let strikeCount = 0;
  let hintRevealCount = 0;
  let score = 0;
  const playerScores = {
    character1: 0,
    character2: 0,
    character3: 0,
    character4: 0,
  };
  let hoveredGroup = null;
  let gameEnded = false;
  let currentPuzzleIndex = -1;
  let currentPuzzleText = "";
  let currentAttempt = createAttempt();
  let wrongFeedback = null;
  let isAiTurnActive = false;
  let gameStarted = false;
  let aiTurnTimer = null;
  let aiTurnState = "idle";
  let aiGuessNumber = 1;
  let raisedHandCharacter = null;
  const HAND_RAISE_STATES = {
    OPEN: "OPEN",
    AI_HAND_PENDING: "AI_HAND_PENDING",
    ANSWER_LOCKED: "ANSWER_LOCKED",
  };
  let handRaiseState = HAND_RAISE_STATES.OPEN;
  let recognizedResponder = null;
  let humanHandRaised = false;
  let recognitionTimer = null;
  let currentAiTargetSlot = null;
  let currentAiCandidatePool = null;
  let currentAiSelectedCandidate = null;
  let currentAiAttemptShouldBeCorrect = null;
  const wrongAiGuessesBySlot = new Map();

  const MAX_STRIKES = 5;
  const SUBMISSION_GRACE_PERIOD = 250;
  const WRONG_GUESS_DISPLAY_MS = 750;
  const AI_GUESS_DISPLAY_MS = 1500;
  const GAMEPLAY_DELAY_MULTIPLIER = 1.20;
  const HUMAN_PLAYTEST_INCORRECT_GUESS_DISPLAY_MS = 1500;
  const HUMAN_PLAYTEST_AI_CYCLE_SCALE = 0.2;
  const AI_CHARACTERS = ["character1", "character2", "character4", "character3"];
  const AI_CHARACTER_NAMES = {
    character1: "Misaki",
    character2: "Aoi",
    character3: "Taiga",
    character4: "Sho",
  };
  const INCORRECT_SOURCE_WEIGHTS = Object.freeze({
    3: 40,
    1: 40,
    5: 15,
    4: 5,
  });
  // Vault 2 contains the answer for the selected slot, but it is still a
  // legitimate puzzle-word source.  Give it a bounded neutral lexical prior
  // so that answer candidates are not reduced to Vault 4's tiny per-word
  // fallback mass.  This is deliberately below the usual Vault 1/3
  // per-word priors and provides no correctness or grammar bonus.
  const VAULT_2_NEUTRAL_SOURCE_PRIOR = 1;
  const HINT_DISPLAY = { pending: null, sequence: 0 };
  const HUMAN_PLAYTEST_TURN = { generation: 0, prepared: null, emptyBoardKey: null, opportunity: 0 };
  const ETTIN_ATTENTION = { gameId: 0, boardKey: null, slots: new Map(), currentSlot: null };
  const ETTIN_SHADOW_ENABLED = false;
  const ETTIN_CONTEXTUAL_ACCESS_ENABLED = true;
  const ETTIN_CONTEXTUAL_ACCESS_CAP = 48;
  const ETTIN_PERSON_ACCESS_ENABLED = true;
  const ENTITY_TYPE_ACCESS_ENABLED = true;
  const ENTITY_TYPE_RANKING_ENABLED = true;
  const ENTITY_SLOT_COMPATIBILITY_ENABLED = true;
  const DISCOURSE_PERSON_COMPATIBILITY_ENABLED = true;
  let ettinShadowBusy = false;
  let aiFrequencyPromise = null;

  // One lexical index for both proposed words and publicly solved words.
  // Inflections are generated only from known lemmas, never from a suffix alone.
  const AI_LEXICON = (() => {
    const index = new Map();
    const add = (word, roles, lemma = word) => {
      const entry = index.get(word) || { roles: new Set(), lemmas: new Set() };
      roles.forEach(role => entry.roles.add(role));
      entry.lemmas.add(lemma);
      index.set(word, entry);
    };
    const lists = {
      article: "a an the",
      determiner: "this that these those some any each every one which what all both either neither many much few little more most less least enough another other such no",
      possessiveDeterminer: "my your his her its our their whose",
      possessivePronoun: "mine yours his hers ours theirs",
      subjectPronoun: "i he she we you they it who what which that this these those",
      objectPronoun: "me him her us them you it whom who what which that this these those",
      questionWord: "who whom whose what where when why how which",
      conjunction: "and but or nor so yet because although though while if unless when that since",
      preposition: "to in on at for with from up out over into of by near beside under behind between through around without after before since",
      particle: "up out off away back down over",
      adjective: "new big small old young good bad happy sad red blue little great ready shy long short golden tired hungry kind",
      adverb: "now here there then very really quickly slowly often always never why how not too home away",
      noun: "cat dog boy girl man woman child house school song book car mat table food room friend teacher pet paw fox owl ant bee rat hen pig cow sun toy rug bed box zoo art ink lap eye ear toe run watch play love look study work family chicken window son daughter person garden shop park bag ball water name day time lover",
    };
    const nounPlurals = { child: ["children"], man: ["men"], woman: ["women"], person: ["people", "persons"] };
    for (const [role, words] of Object.entries(lists)) {
      for (const word of words.split(" ")) {
        add(word, [role]);
        if (role.endsWith("Pronoun") && role !== "possessivePronoun") add(word, ["pronoun"]);
        if (role === "noun") {
          const regular = word.endsWith("y") && !/[aeiou]y$/.test(word) ? word.slice(0, -1) + "ies" : word + (/(s|x|ch|sh)$/.test(word) ? "es" : "s");
          for (const plural of nounPlurals[word] || [regular]) add(plural, ["noun"], word);
        }
      }
    }
    // Closed pronoun families share the same analysis as their visible forms.
    for (const prefix of ["some", "any", "every", "no"]) {
      for (const suffix of ["body", "one", "thing"]) {
        if (prefix === "no" && suffix === "one") continue; // two words: "no one"
        add(prefix + suffix, ["pronoun", "subjectPronoun", "objectPronoun"]);
      }
    }
    for (const word of "myself yourself yourselves himself herself itself ourselves themselves".split(" ")) {
      add(word, ["pronoun", "objectPronoun"]);
    }
    const irregular = {
      go: ["went", "gone"], run: ["ran", "run"], sit: ["sat", "sat"],
      buy: ["bought", "bought"], leave: ["left", "left"], come: ["came", "come"],
      see: ["saw", "seen"], eat: ["ate", "eaten"], take: ["took", "taken"],
      make: ["made", "made"], get: ["got", "got"], give: ["gave", "given"],
      write: ["wrote", "written"], speak: ["spoke", "spoken"], break: ["broke", "broken"],
      sing: ["sang", "sung"], read: ["read", "read"], swim: ["swam", "swum"],
      know: ["knew", "known"], think: ["thought", "thought"], find: ["found", "found"],
      say: ["said", "said"], tell: ["told", "told"],
      lose: ["lost", "lost"], drive: ["drove", "driven"], ride: ["rode", "ridden"],
      choose: ["chose", "chosen"], fly: ["flew", "flown"], grow: ["grew", "grown"],
    };
    const doubled = new Set(["run", "sit", "pet", "stop", "swim", "get", "plan", "shop"]);
    const lemmas = new Set(("love look lose play watch pet study try stop help talk want like finish open close walk jump arrive live move dance work call ask answer learn listen need use smile cook clean visit wait start turn carry enjoy rain happen plan shop " + Object.keys(irregular).join(" ")).split(" "));
    for (const lemma of lemmas) {
      const third = /[^aeiou]y$/.test(lemma) ? lemma.slice(0, -1) + "ies"
        : lemma + (/(s|x|z|ch|sh|o)$/.test(lemma) ? "es" : "s");
      const stem = doubled.has(lemma) ? lemma + lemma.at(-1) : lemma;
      const past = lemma.endsWith("e") ? lemma + "d"
        : /[^aeiou]y$/.test(lemma) ? lemma.slice(0, -1) + "ied" : stem + "ed";
      const progressive = lemma.endsWith("e") && !lemma.endsWith("ee") ? lemma.slice(0, -1) + "ing" : stem + "ing";
      add(lemma, ["verb", "baseVerb"], lemma);
      add(third, ["verb", "finiteVerb"], lemma);
      add(irregular[lemma]?.[0] || past, ["verb", "finiteVerb"], lemma);
      add(irregular[lemma]?.[1] || past, ["verb", "pastParticiple"], lemma);
      add(progressive, ["verb", "presentParticiple"], lemma);
    }
    for (const [subtype, words] of Object.entries({
      beAuxiliary: "am is are was were be been being",
      doAuxiliary: "do does did done", haveAuxiliary: "have has had",
      modal: "can could will would shall should may might must",
    })) {
      for (const word of words.split(" ")) {
        add(word, ["auxiliary", subtype]);
        if (!["be", "been", "being", "done"].includes(word)) add(word, ["finiteVerb"]);
      }
    }
    for (const word of ["be", "do", "have"]) add(word, ["baseVerb"]);
    for (const word of ["been", "done", "had"]) add(word, ["pastParticiple"]);
    add("being", ["presentParticiple"]);
    add("doing", ["verb", "doAuxiliary", "presentParticiple"], "do");
    add("having", ["verb", "haveAuxiliary", "presentParticiple"], "have");
    return index;
  })();

  const AI_TARGET_ROLE_WEIGHTS = Object.freeze(Object.fromEntries([
    "neutral", "noun", "properNoun", "verb", "finiteVerb", "baseVerb",
    "presentParticiple", "pastParticiple", "adjective", "adverb", "article",
    "determiner", "possessiveDeterminer", "pronoun", "subjectPronoun",
    "objectPronoun", "preposition", "conjunction", "auxiliary", "modal",
    "beAuxiliary", "doAuxiliary", "haveAuxiliary", "questionWord",
  ].map(role => [role, 1])));

  // Lexical collocations and spelling agreement remain separate from syntax.
  const AI_GRAMMAR_PHRASE_BOOSTS = Object.freeze([
    ["sat", ["on", "in"]], ["went", ["to"]], ["looked", ["at"]],
    ["talked", ["to"]], ["one", ["of"]], ["because", ["of"]], ["lot", ["of"]],
  ]);

  const AI_SLOT_SELECTION_WEIGHTS = Object.freeze({
    base: 1,
    earlyShortSlot: 1.35,
    earlyFirstUnsolvedShort: 6,
    earlyFirstUnsolvedMedium: 3,
    laterFirstUnsolvedShort: 2.2,
    laterFirstUnsolvedMedium: 1.5,
    noiseMin: 0.9,
    noiseMax: 1.1,
  });

  // ---------- ELEMENTS ----------
  const puzzleArea = document.getElementById("puzzleArea");
  const messageEl = document.getElementById("message");
  const playerScoreElements = {
    character1: document.getElementById("characterOneScore"),
    character2: document.getElementById("characterTwoScore"),
    character3: document.getElementById("characterThreeScore"),
    character4: document.getElementById("characterFourScore"),
  };
  const myPointsValue = document.getElementById("myPointsValue");
  const humanRaiseHandBtn = document.getElementById("humanRaiseHandBtn");
  const teacherMessage = document.getElementById("teacherMessage");
  const aiHandIndicators = {
    character1: document.getElementById("characterOneHandRaise"),
    character2: document.getElementById("characterTwoHandRaise"),
    character3: document.getElementById("characterThreeHandRaise"),
    character4: document.getElementById("characterFourHandRaise"),
  };
  const startGameBtn = document.getElementById("startGameBtn");
  const runtimeBuildMarker = document.getElementById("runtimeBuildMarker");
  const loadedRuntime = window.__GGG_RUNTIME__ || null;
  let runtimeCheckInProgress = false;
  const myPointsPlate = document.getElementById("myPointsPlate");
  function setActiveManualGuesser(character) {
    document.body.dataset.activeTestCharacter = character;
    document.querySelectorAll(".manual-guesser-selected").forEach((element) => {
      element.classList.remove("manual-guesser-selected");
    });
    if (character === "human") {
      myPointsPlate?.classList.add("manual-guesser-selected");
    } else {
      document.querySelector('[data-student="' + character + '"]')?.classList.add("manual-guesser-selected");
    }
  }
  document.querySelectorAll("[data-student]").forEach((stage) => {
    stage.addEventListener("click", () => {
      if (isAiTurnActive || (handRaiseState === HAND_RAISE_STATES.ANSWER_LOCKED && recognizedResponder !== stage.dataset.student)) return;
      setActiveManualGuesser(stage.dataset.student);
    });
  });
  myPointsPlate?.addEventListener("click", () => {
    if (isAiTurnActive || (handRaiseState === HAND_RAISE_STATES.ANSWER_LOCKED && recognizedResponder !== "human")) return;
    setActiveManualGuesser("human");
  });
  setActiveManualGuesser("human");
  const winBanner = document.getElementById("winBanner");
  const endingImage = document.getElementById("endingImage");
  const winnerResult = document.getElementById("winnerResult");
    const endGameBtn = document.getElementById("endGameBtn");
  const previousPuzzleBtn = document.getElementById("previousPuzzleBtn");
  const nextPuzzleBtn = document.getElementById("nextPuzzleBtn");
  if (endGameBtn) {
    endGameBtn.addEventListener("click", () => {
      if (gameEnded || isAiTurnActive) return;
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
    nextPuzzleBtn.addEventListener("click", () => {
      if (isAiTurnActive) return;
      loadNextPuzzle();
    });
  }

  if (previousPuzzleBtn) {
    previousPuzzleBtn.addEventListener("click", () => {
      if (isAiTurnActive || puzzleList.length === 0) return;
      loadPuzzleAtIndex((currentPuzzleIndex - 1 + puzzleList.length) % puzzleList.length);
    });
  }

  async function loadPuzzleList() {
    try {
      const response = await fetch("puzzles/puzzle-list.json");
      if (!response.ok) {
        throw new Error(`Could not load puzzle-list.json: ${response.status}`);
      }

      puzzleList = await response.json();
      const localPuzzles = readLocalPuzzles();
      puzzleList = [...puzzleList, ...localPuzzles.map((puzzle) => puzzle)];
      populateEditPuzzleSelector();
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

    await loadPuzzleAtIndex((currentPuzzleIndex + 1) % puzzleList.length);
  }

  async function loadPuzzleAtIndex(index) {
    if (puzzleList.length === 0) return;
    if (isHumanPlaytestMode() && gameStarted && !gameEnded) emitDiagnosticEvent('complete', { reason: 'changed-puzzle' });
    cancelAiTurn();
    resetHandRaiseState();
    clearAiWrongGuessMemory();
    gameStarted = false;
    updateStartGameButton();
    currentPuzzleIndex = Math.max(0, Math.min(index, puzzleList.length - 1));

    try {
      const source = puzzleList[currentPuzzleIndex];
      const puzzle = typeof source === "string"
        ? await (async () => {
            const response = await fetch(source);
            if (!response.ok) throw new Error(`Could not load puzzle file: ${response.status}`);
            return response.json();
          })()
        : source;
      const puzzleNumber = typeof source === "string"
        ? Number(source.match(/puzzle-(\d+)/)?.[1] || currentPuzzleIndex + 1)
        : Number(source?.number || currentPuzzleIndex + 1);
      if (currentPuzzleNumber) {
        currentPuzzleNumber.textContent = `Puzzle ${puzzleNumber}`;
      }
      if (previousPuzzleBtn) previousPuzzleBtn.disabled = false;
      puzzleImageDataUrl = puzzle.image || null;
      currentPuzzleText = puzzle.text || "";
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
    if (winnerResult) {
      winnerResult.textContent = type === "complete" ? getWinnerResultMessage() : "";
    }
  }

  function getWinnerResultMessage() {
    const players = [
      { name: "Misaki", score: playerScores.character1 },
      { name: "Aoi", score: playerScores.character2 },
      { name: "Sho", score: playerScores.character4 },
      { name: "Taiga", score: playerScores.character3 },
      { name: "You", score },
    ];
    const highestScore = Math.max(...players.map((player) => player.score));
    const winners = players.filter((player) => player.score === highestScore);
    if (winners.length === 5) return "Everybody wins!";
    if (winners.length === 4) return "Four-way tie!";
    if (winners.length === 3) return "Three-way tie!";
    if (winners.length === 2) return "Tie game!";
    return winners[0].name === "You"
      ? "You are the winner!"
      : `${winners[0].name} is the winner!`;
  }

  function clearEnding() {
    winBanner.classList.add("hidden");
    winBanner.classList.remove("ending-complete", "ending-answer");
    if (endingImage) {
      endingImage.removeAttribute("src");
      endingImage.alt = "";
    }
    if (winnerResult) winnerResult.textContent = "";
  }

  function lockGame(type) {
    if (isHumanPlaytestMode() && handRaiseState === HAND_RAISE_STATES.AI_HAND_PENDING)
      logHumanPlaytestTransition('opportunity-cancelled', 'game-ended');
    if (isHumanPlaytestMode()) emitDiagnosticEvent('complete', { reason: type,
      scores: { ...playerScores, human: score } });
    cancelAiTurn();
    resetHandRaiseState();
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

  function emitStudentEvent(type, detail = {}) {
    document.dispatchEvent(new CustomEvent(type, { detail }));
  }

  function emitDiagnosticEvent(type, detail = {}) {
    try { window.GGGGameplayLogger?.observe(type, detail); } catch (error) { console.debug("Gameplay diagnostic observer failed", error); }
  }

  function ordinal(number) {
    const remainder100 = number % 100;
    if (remainder100 >= 11 && remainder100 <= 13) return `${number}th`;
    if (number % 10 === 1) return `${number}st`;
    if (number % 10 === 2) return `${number}nd`;
    if (number % 10 === 3) return `${number}rd`;
    return `${number}th`;
  }

  function lineName(lineNumber) {
    if (lineNumber === 1) return "Top line";
    const names = ["", "", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"];
    return `${names[lineNumber] || ordinal(lineNumber)} line`;
  }

  function wordName(wordNumber, wordCount) {
    if (wordCount >= 6 && wordNumber === wordCount) return "last word";
    const names = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
    return `${names[wordNumber] || ordinal(wordNumber)} word`;
  }

  function getWordLocations(text) {
    const locations = [];
    text.split(/\r?\n/).forEach((line, lineIndex) => {
      const words = line.trim().split(/\s+/).filter(Boolean);
      const guessableWords = words.filter((word) => !/^[A-Za-z]+:$/.test(word));
      guessableWords.forEach((word, wordIndex) => {
        locations.push(`${lineName(lineIndex + 1)}, ${wordName(wordIndex + 1, guessableWords.length)}.`);
      });
    });
    return locations;
  }

  function getActiveTestCharacter() {
    if (handRaiseState === HAND_RAISE_STATES.ANSWER_LOCKED && recognizedResponder) {
      return recognizedResponder;
    }
    return document.body.dataset.activeTestCharacter || "human";
  }

  function cancelAiTurn() {
    if (aiTurnTimer !== null) clearTimeout(aiTurnTimer);
    aiTurnTimer = null;
    if (aiTurnState !== "executing") aiTurnState = "stopped";
  }

  function cancelTeacherRecognition() {
    if (recognitionTimer !== null) clearTimeout(recognitionTimer);
    recognitionTimer = null;
  }

  function setTeacherMessage(message = "") {
    if (teacherMessage) teacherMessage.textContent = message;
  }

  function updateHumanRaiseHandButton() {
    if (!humanRaiseHandBtn) return;
    const isRaised = humanHandRaised || recognizedResponder === "human";
    humanRaiseHandBtn.textContent = isRaised ? "Hand Raised" : "Raise Hand";
    humanRaiseHandBtn.classList.toggle("raised", isRaised);
    humanRaiseHandBtn.disabled = !gameStarted || handRaiseState === HAND_RAISE_STATES.ANSWER_LOCKED;
  }

  // Opt-in diagnostic path; the ordinary launcher and saved settings stay intact.
  function isHumanPlaytestMode() {
    return /(?:^\?|&)humanPlaytestMode=1(?:&|$)/.test(window.location?.search || "");
  }

  function isEttinPilotMode() {
    return isHumanPlaytestMode() && /(?:^\?|&)ettinPilot=1(?:&|$)/.test(window.location?.search || "");
  }

  function getHumanCandidateProvider() {
    return globalThis.GGGCandidateProviders?.get(window.location?.search || '') || globalThis.GGGHumanPlaytest;
  }

  function isSituationPilotMode() {
    return isHumanPlaytestMode() && /(?:^\?|&)situationPilot=1(?:&|$)/.test(window.location?.search || '');
  }

  function logEttinPilot(stage, targetSlot, detail = {}) {
    if (!isEttinPilotMode() || !targetSlot) return;
    const state = getHumanPlaytestPublicState(targetSlot);
    const slot = state.slots[targetSlot.slotIndex];
    const publicBoardKey = globalThis.GGGHumanPlaytest.boardKey(state);
    emitDiagnosticEvent(stage, { provider: 'ETTIN', modelState: globalThis.GGGEttinProvider?.getState?.().status || 'not_requested',
      opportunity: HUMAN_PLAYTEST_TURN.opportunity, opportunityId: `${HUMAN_PLAYTEST_TURN.opportunity}:${publicBoardKey}`, publicBoardKey, publicBoard: buildEttinPublicSnapshot(state),
      targetSlotId: `slot-${targetSlot.slotIndex}`, targetSlot: targetSlot.slotIndex, tokenIndex: targetSlot.slotIndex,
      targetPattern: globalThis.GGGHumanPlaytest.tokenAt(slot), targetLength: targetSlot.length,
      publicRejections: state.rejectedWordsBySlot[targetSlot.slotIndex] || [],
      character: HUMAN_PLAYTEST_TURN.prepared?.character || recognizedResponder || null,
      isAi: (HUMAN_PLAYTEST_TURN.prepared?.character || recognizedResponder) !== 'human', ...detail });
  }

  function logPilotCandidate(stage, candidate, targetSlot, extra = {}) {
    if (!isSituationPilotMode() || !targetSlot) return;
    const board = globalThis.GGGPublicBoard.snapshot(getHumanPlaytestPublicState(targetSlot));
    const clueKey = globalThis.GGGHumanPlaytest.evidenceKey(board.state);
    const times = HUMAN_PLAYTEST_TURN.publicClueTimes || (HUMAN_PLAYTEST_TURN.publicClueTimes = new Map());
    const old = times.get(targetSlot.slotIndex);
    if (!old || old.key !== clueKey) times.set(targetSlot.slotIndex, { key: clueKey, time: Date.now() });
    emitDiagnosticEvent(stage, { publicBoardRevision: candidate?.boardRevision || board.revision,
      currentPublicBoardRevision: board.revision, targetSlot: targetSlot.slotIndex,
      selectedGuess: candidate?.word || null, actor: HUMAN_PLAYTEST_TURN.prepared?.character || recognizedResponder || null,
      isAi: (HUMAN_PLAYTEST_TURN.prepared?.character || recognizedResponder) !== 'human',
      candidateProviderVersion: getHumanCandidateProvider().version,
      situationIds: candidate?.diagnostic?.situationIds || [], evidenceStrength: candidate?.diagnostic?.evidenceStrength ?? null,
      timeSinceRelevantPublicClueMs: Date.now() - times.get(targetSlot.slotIndex).time,
      previouslyRejectedGuesses: board.slots[targetSlot.slotIndex].rejectedGuesses,
      ...(stage === 'candidate-selected' || stage === 'human-candidate-selected' ? { publicBoard: board.slots } : {}), ...extra });
  }

  function humanPlaytestDelay(milliseconds) {
    const duration = Number(milliseconds);
    if (!Number.isFinite(duration) || duration <= 0 || !isHumanPlaytestMode()) return duration;
    return gameplayDelayWithMultiplier(duration * HUMAN_PLAYTEST_AI_CYCLE_SCALE);
  }

  function gameplayDelayWithMultiplier(milliseconds) {
    const duration = Number(milliseconds);
    if (!Number.isFinite(duration) || duration <= 0) return duration;
    return Math.max(1, Math.round(duration * GAMEPLAY_DELAY_MULTIPLIER));
  }

  function gameplayPacingDelay(milliseconds) {
    const duration = Number(milliseconds);
    if (!Number.isFinite(duration) || duration <= 0) return duration;
    if (isHumanPlaytestMode()) return humanPlaytestDelay(duration);
    return gameplayDelayWithMultiplier(duration);
  }

  function humanPlaytestGuessDisplayDelay() {
    // Preserve the existing correct-answer pacing while incorrect previews
    // use their own Human Playtest display duration below.
    return isHumanPlaytestMode() ? gameplayDelayWithMultiplier(900) : gameplayPacingDelay(AI_GUESS_DISPLAY_MS);
  }

  function humanPlaytestIncorrectGuessDisplayDelay() {
    return isHumanPlaytestMode() ? gameplayDelayWithMultiplier(HUMAN_PLAYTEST_INCORRECT_GUESS_DISPLAY_MS) : gameplayPacingDelay(AI_GUESS_DISPLAY_MS);
  }

  function logHumanPlaytestTransition(transition, reason = null) {
    const prepared = HUMAN_PLAYTEST_TURN.prepared;
    const target = prepared?.pool?.targetSlot || currentAiTargetSlot;
    const publicState = target ? getHumanPlaytestPublicState(target) : null;
    emitDiagnosticEvent('ai-opportunity', { engineVersion: isEttinPilotMode() ? 'ettin-live-v1' : getHumanCandidateProvider().version || globalThis.GGGHumanPlaytest.POLICY.version,
      opportunity: HUMAN_PLAYTEST_TURN.opportunity, transition, ...(reason ? { reason } : {}),
      targetSlot: target?.slotIndex ?? null, targetLength: target?.length ?? null,
      publicBoardKey: publicState ? globalThis.GGGHumanPlaytest.boardKey(publicState) : null,
      character: prepared?.character || recognizedResponder || null,
      slot: prepared?.pool.targetSlot.slotIndex ?? currentAiTargetSlot?.slotIndex ?? null,
      boardId: prepared ? globalThis.GGGHumanPlaytest.boardId(getHumanPlaytestPublicState(prepared.pool.targetSlot)) : null });
  }

  function ettinAttentionBand(slot, hardCount, anchors) {
    const revealed = slot.letters.filter(letter => letter.visible !== null).length;
    if (revealed > 0 && hardCount >= 1 && hardCount <= 8) return 'STRONG';
    if (revealed > 0 || anchors.length > 0) return 'SUPPORTED';
    return 'WEAK';
  }

  function getEttinAttentionAnchors(publicBoard, slotIndex) {
    const slots = publicBoard.slots;
    const target = slots[slotIndex];
    if (!target) return [];
    const anchors = [];
    if (slotIndex > 0 && slots[slotIndex - 1].solved && slots[slotIndex - 1].sentence === target.sentence) {
      anchors.push({ type: 'solved-adjacent-word', slotIndex: slotIndex - 1 });
    }
    if (slotIndex + 1 < slots.length && slots[slotIndex + 1].solved && slots[slotIndex + 1].sentence === target.sentence) {
      anchors.push({ type: 'solved-adjacent-word', slotIndex: slotIndex + 1 });
    }
    const sentenceStart = slots.findIndex(slot => slot.sentence === target.sentence);
    const sentenceEnd = slots.reduce((last, slot, index) => slot.sentence === target.sentence ? index : last, -1);
    if (slotIndex === sentenceStart && sentenceEnd >= sentenceStart && /\?/.test(slots[sentenceEnd].trailing || '')) {
      anchors.push({ type: 'question-opening', sentence: target.sentence });
    }
    return anchors;
  }

  function resetEttinAttention() {
    ETTIN_ATTENTION.gameId += 1;
    ETTIN_ATTENTION.boardKey = null;
    ETTIN_ATTENTION.slots = new Map();
    ETTIN_ATTENTION.currentSlot = null;
  }

  function noteEttinAttentionCommit(slotIndex, result) {
    if (!isEttinPilotMode()) return;
    const record = ETTIN_ATTENTION.slots.get(slotIndex);
    if (!record || record.lastCountedOpportunity === HUMAN_PLAYTEST_TURN.opportunity) return;
    record.lastCountedOpportunity = HUMAN_PLAYTEST_TURN.opportunity;
    record.lastAttempt = HUMAN_PLAYTEST_TURN.opportunity;
    for (const [otherIndex, other] of ETTIN_ATTENTION.slots) {
      if (otherIndex !== slotIndex && other.cooldown > 0) other.cooldown -= 1;
    }
    if (result === 'incorrect') record.failures = Math.min(2, record.failures + 1);
    else if (result === 'correct') record.failures = 0;
    if (record.failures >= 2) record.cooldown = 1;
  }

  function chooseEttinAttentionTarget(considered, triedSlots = new Set()) {
    const selectable = considered.filter(entry => entry.n > 0 && !triedSlots.has(entry.slot.slotIndex));
    if (!selectable.length) return null;
    const cooling = selectable.filter(entry => entry.cooldown > 0);
    const available = cooling.length < selectable.length
      ? selectable.filter(entry => entry.cooldown === 0)
      : selectable;
    const bandRank = { STRONG: 3, SUPPORTED: 2, WEAK: 1 };
    const highest = Math.max(...available.map(entry => bandRank[entry.band]));
    const bandEntries = available.filter(entry => bandRank[entry.band] === highest);
    const freshEntries = bandEntries.filter(entry => entry.fresh);
    const preferred = freshEntries.length ? freshEntries : bandEntries;
    const current = preferred.find(entry => entry.slot.slotIndex === ETTIN_ATTENTION.currentSlot &&
      entry.failures < 2 && entry.cooldown === 0);
    const selected = current || [...preferred].sort((left, right) => {
      const leftAttempt = left.lastAttempt === null ? Number.NEGATIVE_INFINITY : left.lastAttempt;
      const rightAttempt = right.lastAttempt === null ? Number.NEGATIVE_INFINITY : right.lastAttempt;
      return leftAttempt - rightAttempt || left.n - right.n ||
        right.revealedFraction - left.revealedFraction || left.slot.slotIndex - right.slot.slotIndex;
    })[0];
    return { selected, reason: current ? 'persist-current-target' :
      freshEntries.length ? 'new-public-evidence' : `highest-band-${selected.band.toLowerCase()}` };
  }

  function currentEttinOpportunity(context) {
    if (!context || context.ticket !== HUMAN_PLAYTEST_TURN.generation ||
        context.gameId !== ETTIN_ATTENTION.gameId || !gameStarted || isGameOver || gameEnded ||
        handRaiseState !== HAND_RAISE_STATES.OPEN || humanHandRaised) return false;
    const slots = getEligibleAiSlots();
    if (!slots.length) return false;
    return globalThis.GGGHumanPlaytest.boardKey(getHumanPlaytestPublicState(slots[0])) === context.boardKey;
  }

  function logEttinAttentionSelection(plan, selected, reason) {
    logEttinPilot('attention-plan', selected.slot, { gameId: plan.gameId, boardKey: plan.boardKey,
      selectedReason: reason, consideredSlots: plan.considered,
      selectedTargetSlotId: `slot-${selected.slot.slotIndex}` });
  }

  function commitEttinAttentionSelection(plan, selected) {
    const record = ETTIN_ATTENTION.slots.get(selected.slot.slotIndex);
    if (record) record.fresh = false;
    ETTIN_ATTENTION.currentSlot = selected.slot.slotIndex;
    ETTIN_ATTENTION.boardKey = plan.boardKey;
  }

  async function buildEttinAttentionPlan(initialSlot, context = null) {
    if (!isEttinPilotMode()) return null;
    const seed = initialSlot || getEligibleAiSlots()[0];
    if (!seed) return null;
    const publicState = getHumanPlaytestPublicState(seed);
    const publicBoard = globalThis.GGGPublicBoard.snapshot(publicState);
    const boardKey = publicBoard.key;
    const considered = [];
    const eligibleSlots = getEligibleAiSlots();
    for (const slot of eligibleSlots) {
      const pool = await buildHumanPlaytestPool(slot, [], publicState);
      if (context && !currentEttinOpportunity(context)) return { status: 'stale', boardKey };
      if (!pool || !Array.isArray(pool.hardCandidates)) return { status: 'operational-failure', boardKey,
        reason: 'attention-pool-unavailable' };
      const publicSlot = publicBoard.slots[slot.slotIndex];
      const anchors = getEttinAttentionAnchors(publicBoard, slot.slotIndex);
      const evidenceKey = JSON.stringify({
        pattern: publicSlot.letters.map(letter => letter.visible || '_').join(''),
        anchors,
      });
      const previous = ETTIN_ATTENTION.slots.get(slot.slotIndex);
      const record = previous || { failures: 0, cooldown: 0, lastAttempt: null, fresh: false, lastCountedOpportunity: null };
      if (previous && previous.evidenceKey !== evidenceKey) {
        record.failures = 0;
        record.cooldown = 0;
        record.fresh = true;
      }
      record.evidenceKey = evidenceKey;
      record.boardKey = boardKey;
      ETTIN_ATTENTION.slots.set(slot.slotIndex, record);
      const band = ettinAttentionBand(publicSlot, pool.hardCandidates.length, anchors);
      const entry = {
        slot,
        pool,
        slotId: `slot-${slot.slotIndex}`,
        n: pool.hardCandidates.length,
        pattern: globalThis.GGGHumanPlaytest.tokenAt(publicState.slots[slot.slotIndex]),
        revealedFraction: publicSlot.letters.length ? publicSlot.revealedPositions.length / publicSlot.letters.length : 0,
        band,
        anchors,
        evidenceKey,
        fresh: record.fresh,
        failures: record.failures,
        cooldown: record.cooldown,
        lastAttempt: record.lastAttempt,
      };
      considered.push(entry);
    }
    if (!considered.length || considered.length !== eligibleSlots.length) return { status: 'operational-failure', boardKey,
      reason: 'incomplete-attention-assessment' };
    const diagnostics = considered.map(entry => ({ slotId: entry.slotId, slotIndex: entry.slot.slotIndex, n: entry.n, pattern: entry.pattern,
        band: entry.band, anchors: entry.anchors, revealedFraction: entry.revealedFraction, fresh: entry.fresh,
        failures: entry.failures, cooldown: entry.cooldown, lastAttempt: entry.lastAttempt }));
    if (context && !currentEttinOpportunity(context)) return { status: 'stale', boardKey };
    const plan = { gameId: ETTIN_ATTENTION.gameId, boardKey, publicState, publicBoard,
      considered: diagnostics, assessed: considered, selectedSlot: null, selectedPool: null, selectedReason: null };
    const choice = chooseEttinAttentionTarget(considered);
    if (!choice) return { ...plan, status: 'board-empty', eligibleSlotCount: eligibleSlots.length };
    plan.status = 'ready';
    return plan;
  }

  function humanPlaytestCandidateProblem(pool, candidate) {
    if (!pool || !candidate) return 'no-valid-slot';
    if (pool.targetSlot.group.classList.contains('revealed')) return 'slot-solved';
    const state = getHumanPlaytestPublicState(pool.targetSlot);
    if (candidate.publicBoardKey !== globalThis.GGGHumanPlaytest.boardKey(state)) return 'stale-board';
    if (!globalThis.GGGHumanPlaytest.matchesToken(candidate.word, state.slots[pool.targetSlot.slotIndex])) return 'token-invalid';
    const surface = candidate.submissionSurface || candidate.word;
    if (!globalThis.GGGHumanPlaytest.matchesCasePattern(surface, state.slots[pool.targetSlot.slotIndex])) return 'case-pattern-mismatch';
    const admittedPopulation = isEttinPilotMode() ? pool.candidates : (pool.universe || pool.candidates);
    const admittedCandidate = admittedPopulation?.find(entry => entry.normalized === candidate.normalized);
    if (!admittedCandidate) return 'candidate-no-longer-in-pool';
    const blockPolicyProblem = stage1CandidateBlockPolicyProblem(
      { ...admittedCandidate, ...candidate, orthographicSurface: admittedCandidate.orthographicSurface,
        submissionSurface: surface },
      pool,
      state,
      surface,
    );
    if (blockPolicyProblem) return blockPolicyProblem;
    if (isEttinPilotMode()) {
      const snapshot = buildEttinPublicSnapshot(state);
      const valid = globalThis.GGGEttinProvider?.validateCandidate(snapshot, surface);
      if (!valid?.ok) return `public-${valid?.reason || 'invalid'}`;
      return pool.candidates.some(entry => entry.normalized === candidate.normalized) ? null : 'candidate-no-longer-in-pool';
    }
    const ranked = rankHumanPlaytestPool(pool, state);
    if (!ranked?.band.length) return 'empty-band';
    if (!ranked.band.some(c => c.normalized === candidate.normalized)) return 'candidate-no-longer-in-band';
    return null;
  }

  function cancelHumanPlaytestOpportunity(reason, { reschedule = true } = {}) {
    logHumanPlaytestTransition('opportunity-cancelled', reason);
    resetHandRaiseState();
    aiTurnState = 'idle';
    if (reschedule && gameStarted && !isGameOver && !gameEnded) scheduleAiTurn(false);
    return false;
  }

  async function prepareHumanPlaytestOpportunity(character) {
    const ticket = ++HUMAN_PLAYTEST_TURN.generation;
    const initial = getEligibleAiSlots()[0];
    if (!initial) return cancelHumanPlaytestOpportunity('no-valid-slot');
    const boardKey = globalThis.GGGHumanPlaytest.boardKey(getHumanPlaytestPublicState(initial));
    // A proven empty ETTIN board stays parked until a public turn changes its key.
    if (HUMAN_PLAYTEST_TURN.emptyBoardKey === boardKey) {
      aiTurnState = 'idle';
      if (!isEttinPilotMode()) scheduleAiTurn(false);
      return false;
    }
    HUMAN_PLAYTEST_TURN.opportunity++;
    const ownership = { ticket, gameId: ETTIN_ATTENTION.gameId, boardKey };
    try {
      const result = isEttinPilotMode()
        ? await buildEttinPilotTurnPool(initial, ownership)
        : await buildHumanPlaytestTurnPool(initial);
      if (isEttinPilotMode() && result?.status === 'board-empty') {
        if (!currentEttinOpportunity(ownership)) return false;
        HUMAN_PLAYTEST_TURN.emptyBoardKey = boardKey;
        emitDiagnosticEvent('ai-opportunity', { engineVersion: 'ettin-live-v1', opportunity: HUMAN_PLAYTEST_TURN.opportunity,
          transition: 'board-empty', reason: 'all-eligible-targets-conclusively-empty', publicBoardKey: boardKey,
          eligibleSlotCount: result.eligibleSlotCount, attemptedTargetSlots: result.attemptedTargetSlots || [] });
        return cancelHumanPlaytestOpportunity('board-empty', { reschedule: false });
      }
      if (isEttinPilotMode() && result?.status === 'stale') return false;
      if (isEttinPilotMode() && result?.status === 'operational-failure') {
        if (!currentEttinOpportunity(ownership)) return false;
        console.error('ETTIN opportunity preparation failed.', result.reason || result.error);
        return cancelHumanPlaytestOpportunity('preparation-failed');
      }
      const pool = isEttinPilotMode() ? result?.pool : result;
      if (!isEttinPilotMode() && !pool) HUMAN_PLAYTEST_TURN.emptyBoardKey = boardKey;
      if (isEttinPilotMode() && !currentEttinOpportunity(ownership)) return false;
      if (ticket !== HUMAN_PLAYTEST_TURN.generation || !gameStarted || isGameOver || gameEnded ||
          handRaiseState !== HAND_RAISE_STATES.OPEN || humanHandRaised) return false;
      const candidate = pool && chooseFinalAiCandidate(pool, aiGuessNumber);
      if (isEttinPilotMode() && (!pool || !candidate)) return cancelHumanPlaytestOpportunity('no-candidate');
      const problem = humanPlaytestCandidateProblem(pool, candidate);
      if (problem) return cancelHumanPlaytestOpportunity(problem);
      if (isEttinPilotMode()) {
        const selected = pool.attentionPlan.assessed.find(entry => entry.slot.slotIndex === pool.targetSlot.slotIndex);
        if (selected) commitEttinAttentionSelection(pool.attentionPlan, selected);
      }
      HUMAN_PLAYTEST_TURN.emptyBoardKey = null;
      candidate.diagnostic.character = character;
      HUMAN_PLAYTEST_TURN.prepared = { pool, candidate, character };
      currentAiTargetSlot = pool.targetSlot; currentAiCandidatePool = pool; currentAiSelectedCandidate = candidate;
      if (isEttinPilotMode()) {
        logEttinPilot('candidate-selected', pool.targetSlot, { selectedGuess: candidate.word, selectedScore: candidate.score,
          selectedModelProbability: candidate.modelProbability, selectedSelectionProbability: candidate.selectionProbability,
          selectedRank: candidate.diagnostic?.modelRank, selectedEligibleRank: candidate.diagnostic?.eligibleRank,
          stage3: candidate.diagnostic });
        logEttinPilot('candidate-revalidated', pool.targetSlot, { phase: 'before-hand', selectedGuess: candidate.word });
      } else {
        logPilotCandidate('candidate-selected', candidate, pool.targetSlot);
        logPilotCandidate('candidate-revalidated', candidate, pool.targetSlot, { phase: 'before-hand' });
      }
      logHumanPlaytestTransition('candidate-ready');
      aiTurnState = 'idle';
      return raiseAiHand(character);
    } catch (error) {
      if (isEttinPilotMode() && !currentEttinOpportunity(ownership)) return false;
      console.error('Human playtest candidate preparation failed.', error);
      return cancelHumanPlaytestOpportunity('preparation-failed');
    }
  }

  function recognizePreparedHumanPlaytestResponder(character) {
    const prepared = HUMAN_PLAYTEST_TURN.prepared;
    const problem = !prepared || prepared.character !== character ? 'no-valid-slot' : humanPlaytestCandidateProblem(prepared.pool, prepared.candidate);
    if (problem) return cancelHumanPlaytestOpportunity(problem);
    clearRaisedAiHand(); recognizedResponder = character; humanHandRaised = false;
    handRaiseState = HAND_RAISE_STATES.ANSWER_LOCKED;
    cancelAiTurn(); setTeacherMessage(`Go ahead, ${AI_CHARACTER_NAMES[character]}`); updateHumanRaiseHandButton();
    emitDiagnosticEvent('teacher-recognition', { responder: character });
    logHumanPlaytestTransition('recognized');
    return submitSelectedAiGuess();
  }

  function isAiMaximumAccuracyMode() {
    return !isHumanPlaytestMode() && /(?:^\?|&)aiMode=maximum-accuracy(?:&|$)/.test(window.location?.search || "");
  }

  // Copy only rendered public properties. dataset.letter and puzzle text never
  // cross this boundary. Typing previews are not revealed-letter evidence.
  function getHumanPlaytestPublicState(targetSlot) {
    const groups = Array.from(document.querySelectorAll(".word-group"));
    const slots = groups.map(group => {
      const blocks = Array.from(group.querySelectorAll(".letter-block"));
      const letters = blocks.map(block => ({ capital: block.classList.contains("capital-letter"),
        visible: isBlockRevealed(block) ? block.textContent : null }));
      const gaps = [""];
      for (const child of Array.from(group.children || blocks)) {
        if (blocks.includes(child)) gaps.push(child.dataset.trailing || "");
        else if (child.classList?.contains("punct")) gaps[gaps.length - 1] += child.textContent || "";
      }
      return { letters, gaps, trailing: gaps.at(-1), solved: !letters.length ||
        (group.classList.contains("revealed") && letters.every(l => l.visible !== null)) };
    });
    const rejectedWordsBySlot = Object.fromEntries(groups.map((_, i) => [i,
      Array.from(wrongAiGuessesBySlot.get(String(i)) || []).map(w => w.toLowerCase()).filter(w => /^[a-z]+(?:['’-][a-z]+)*$/.test(w))]));
    const state = { slots, spacing: slots.map((_, i) => i ? " " : "").concat(""),
      targetSlotIndex: targetSlot.slotIndex, rejectedWordsBySlot };
    if (isSituationPilotMode()) {
      const key = globalThis.GGGHumanPlaytest.evidenceKey(state);
      const times = HUMAN_PLAYTEST_TURN.publicClueTimes || (HUMAN_PLAYTEST_TURN.publicClueTimes = new Map());
      if (times.get(targetSlot.slotIndex)?.key !== key) times.set(targetSlot.slotIndex, { key, time: Date.now() });
    }
    return state;
  }

  function buildEttinPublicSnapshot(state) {
    if (!state || !Array.isArray(state.slots)) throw new Error('ETTIN public board is missing slots.');
    const visible_tokens = state.slots.map(slot => `${globalThis.GGGHumanPlaytest.tokenAt(slot)}${slot.trailing || ''}`);
    const slots = state.slots.map((slot, tokenIndex) => {
      const pattern = globalThis.GGGHumanPlaytest.tokenAt(slot);
      const first = slot.letters[0];
      return { slot_id: `slot-${tokenIndex}`, token_index: tokenIndex, length: slot.letters.length, pattern,
        capitalization: first?.capital ? 'titlecase' : 'lowercase',
        case_pattern: slot.letters.map(letter => letter.capital ? 'U' : 'l').join(''),
        punctuation: slot.trailing || '', solved: Boolean(slot.solved),
        public_rejections: state.rejectedWordsBySlot[tokenIndex] || [] };
    });
    return { visible_tokens, slots, target_slot_id: `slot-${state.targetSlotIndex}`,
      public_rejections: state.rejectedWordsBySlot[state.targetSlotIndex] || [] };
  }

  function buildEttinShadowClueSummary(snapshot) {
    const lengths = snapshot.slots.map(slot => slot.length);
    const revealed = [];
    snapshot.slots.forEach((slot, wordIndex) => {
      if (slot.solved) return;
      let letterPosition = 0;
      for (const letter of Array.from(slot.pattern)) {
        if (!/[A-Za-z_]/.test(letter)) continue;
        letterPosition += 1;
        if (!/[A-Za-z]/.test(letter)) continue;
        const suffix = letterPosition === 1 ? 'st' : letterPosition === 2 ? 'nd' : letterPosition === 3 ? 'rd' : 'th';
        revealed.push(`Word ${wordIndex + 1} has '${letter}' as its ${letterPosition}${suffix} letter.`);
      }
    });
    return `\nPublic clues: The puzzle word lengths are ${lengths.join(', ')} letters.${revealed.length ? ` ${revealed.join(' ')}` : ''}`;
  }

  async function buildEttinPilotPool(targetSlot, attentionPlan = null, ownership = null) {
    if (!targetSlot || !globalThis.GGGEttinProvider) return { status: 'operational-failure', reason: 'provider-unavailable' };
    const lexicalPool = await buildHumanPlaytestPool(targetSlot, [], null, true);
    if (ownership && !currentEttinOpportunity(ownership)) return { status: 'stale' };
    if (!lexicalPool || !Array.isArray(lexicalPool.candidates) || !Array.isArray(lexicalPool.hardCandidates)) {
      return { status: 'operational-failure', reason: 'target-pool-unavailable' };
    }
    if (!lexicalPool.candidates.length) return { status: 'target-empty', reason: 'empty-shortlist',
      hardCandidateCount: lexicalPool.hardCandidates.length };
    const shortlistCandidates = lexicalPool.candidates;
    const state = getHumanPlaytestPublicState(targetSlot);
    const snapshot = buildEttinPublicSnapshot(state);
    const hardValid = shortlistCandidates.filter(candidate => {
      const surface = candidate.submissionSurface;
      if (!surface || !isSafelySubmittableAiCandidate(surface, targetSlot.length)) return false;
      if (!matchesAiRevealedLetters(surface, targetSlot)) return false;
      return globalThis.GGGEttinProvider.validateCandidate(snapshot, surface)?.ok === true;
    });
    const baselineCap = 64;
    const baseline = hardValid.slice(0, baselineCap);
    const contextualData = lexicalPool.contextualAccess;
    const personQualification = ettinPersonAccessQualification(contextualData);
    let contextualAccess;
    if (personQualification.qualified) {
      contextualAccess = { kind: 'person', expectation: null, qualification: personQualification,
        candidates: buildEttinPersonAccessExtension(contextualData.classData, snapshot, targetSlot, baseline,
          ETTIN_CONTEXTUAL_ACCESS_CAP) };
    } else {
      const extensionCap = ETTIN_CONTEXTUAL_ACCESS_ENABLED ? ETTIN_CONTEXTUAL_ACCESS_CAP : 0;
      const verbAccess = buildEttinContextualAccessExtension(contextualData?.classData,
        contextualData?.construction, snapshot, targetSlot, baseline, extensionCap);
      contextualAccess = { ...verbAccess, kind: verbAccess.expectation ? 'verb' : 'none',
        qualification: personQualification };
    }
    const legacyExtension = contextualAccess.candidates;
    const extensionBudget = contextualAccess.kind === 'person' ? ETTIN_CONTEXTUAL_ACCESS_CAP :
      (ETTIN_CONTEXTUAL_ACCESS_ENABLED ? ETTIN_CONTEXTUAL_ACCESS_CAP : 0);
    const noEntityContext = { confidence: 'NONE', hypotheses: [], evidence: [] };
    const entityAccessContext = contextualData?.entityTypeContext || noEntityContext;
    const entityContext = ENTITY_TYPE_ACCESS_ENABLED ? entityAccessContext :
      (ENTITY_TYPE_RANKING_ENABLED
          ? entityTypeContextForTarget(state, targetSlot,
            contextualData?.construction || buildEttinConstructionContext(state,
            globalThis.GGGHumanPlaytest, globalThis.vault4Dictionary.dictionary), globalThis.GGGHumanPlaytest)
        : noEntityContext);
    const slotCompatibilityConstruction = ENTITY_SLOT_COMPATIBILITY_ENABLED
      ? (contextualData?.construction || buildEttinConstructionContext(state,
        globalThis.GGGHumanPlaytest, globalThis.vault4Dictionary.dictionary)) : null;
    const slotCompatibilityBaseContext = ENTITY_SLOT_COMPATIBILITY_ENABLED
      ? (contextualData?.entityTypeContext || entityTypeContextForTarget(state, targetSlot,
        slotCompatibilityConstruction, globalThis.GGGHumanPlaytest))
      : noEntityContext;
    const entitySlotCompatibilityContext = entitySlotCompatibilityContextForTarget(state, targetSlot,
      slotCompatibilityConstruction, globalThis.GGGHumanPlaytest, slotCompatibilityBaseContext);
    const discourseConstruction = DISCOURSE_PERSON_COMPATIBILITY_ENABLED
      ? (contextualData?.construction || buildEttinConstructionContext(state,
        globalThis.GGGHumanPlaytest, globalThis.vault4Dictionary.dictionary)) : null;
    const discoursePersonCompatibilityContext = discoursePersonCompatibilityContextForTarget(state, targetSlot,
      discourseConstruction, globalThis.GGGHumanPlaytest, DISCOURSE_PERSON_COMPATIBILITY_ENABLED);
    const entityExtension = buildEntityTypeAccessExtension(contextualData?.classData, snapshot, targetSlot,
      baseline, legacyExtension, entityAccessContext, Math.max(0, ETTIN_CONTEXTUAL_ACCESS_CAP - legacyExtension.length));
    const extension = [...legacyExtension, ...entityExtension.candidates];
    const totalExtensionBudget = ENTITY_TYPE_ACCESS_ENABLED
      ? Math.max(extensionBudget, ETTIN_CONTEXTUAL_ACCESS_CAP) : extensionBudget;
    const cap = baselineCap + totalExtensionBudget;
    const bounded = [...baseline, ...extension].map(candidate => ({ ...candidate, word: candidate.submissionSurface }));
    logEttinPilot('ettin-input', targetSlot, { targetReason: attentionPlan?.selectedReason || 'attention-plan-selected',
      resourceKey: lexicalPool.resourceKey,
      universeCandidateCount: lexicalPool.universe.length, hardValidPopulationCount: lexicalPool.hardCandidates.length,
      shortlistCandidateCount: shortlistCandidates.length,
      baselineCandidateCount: baseline.length, contextualExtensionCount: extension.length,
      contextualExtensionKind: contextualAccess.kind,
      personExtensionCount: contextualAccess.kind === 'person' ? legacyExtension.length : 0,
      personAccessQualified: personQualification.qualified,
      personAccessQualificationReason: personQualification.reason,
      grammaticalExpectation: contextualAccess.expectation, ettinCandidateCount: bounded.length,
      entityAccess: { enabled: ENTITY_TYPE_ACCESS_ENABLED,
        hypotheses: ENTITY_TYPE_ACCESS_ENABLED ? entityAccessContext.hypotheses : [],
        confidence: ENTITY_TYPE_ACCESS_ENABLED ? entityAccessContext.confidence : null,
        preservedLegacyExtensionCount: legacyExtension.length,
        additionsCount: entityExtension.candidates.length,
        capacityBlocked: entityExtension.capacityBlocked,
        added: entityExtension.candidates.map(candidate => ({ word: candidate.word,
          types: entityExtension.matchedTypes.get(normalizeAiCandidate(candidate.word)) || [] })) },
      ettinCandidates: bounded.map(c => c.word), cap, truncatedCount: Math.max(0, hardValid.length - cap),
      truncationStartIndex: hardValid.length > cap ? cap : null });
    if (!bounded.length) {
      logEttinPilot('ettin-structural-failure', targetSlot, { reason: 'no-hard-valid-candidates', lexicalCandidateCount: shortlistCandidates.length, hardValidPopulationCount: lexicalPool.hardCandidates.length, hardValidCandidateCount: hardValid.length, ettinCandidateCount: 0 });
      return { status: 'target-empty', reason: 'public-validation-removed-all',
        hardCandidateCount: lexicalPool.hardCandidates.length };
    }
    const started = performance.now();
    try {
      const scored = await globalThis.GGGEttinProvider.scoreCandidates(snapshot, bounded);
      if (ownership && !currentEttinOpportunity(ownership)) return { status: 'stale' };
      if (!Array.isArray(scored?.candidates) || !scored.candidates.length || scored.candidates.some(candidate =>
        !Number.isInteger(candidate?.rank) || candidate.rank < 1 || !Number.isFinite(candidate.score) ||
        !Number.isFinite(candidate.probability) || candidate.probability < 0)) {
        return { status: 'operational-failure', reason: 'malformed-provider-result' };
      }
      const publicBoardKey = globalThis.GGGHumanPlaytest.boardKey(state);
      logEttinPilot('ettin-scored', targetSlot, { lexicalCandidateCount: shortlistCandidates.length, universeCandidateCount: lexicalPool.universe.length,
        hardValidPopulationCount: lexicalPool.hardCandidates.length, hardValidCandidateCount: hardValid.length,
        baselineCandidateCount: baseline.length, contextualExtensionCount: extension.length,
        contextualExtensionKind: contextualAccess.kind,
        personExtensionCount: contextualAccess.kind === 'person' ? legacyExtension.length : 0,
        personAccessQualified: personQualification.qualified,
        personAccessQualificationReason: personQualification.reason,
        grammaticalExpectation: contextualAccess.expectation,
        ettinCandidateCount: bounded.length, cap, loadMs: scored.loadMs, scoringMs: scored.scoringMs,
        partial_neighbor_evidence_present: scored.candidates.some(c => c.partial_neighbor_evidence_present),
        partial_neighbor_evidence_consumed_by_ettin: false,
        ettinRenderedInput: scored.candidates[0] ? { text: scored.candidates[0].ettinRenderedText, targetStart: scored.candidates[0].ettinTargetStart, targetEnd: scored.candidates[0].ettinTargetEnd, targetSlot: targetSlot.slotIndex, maskToken: '[MASK]', maskedNeighborTokenIndices: scored.candidates[0].ettinMaskedNeighborTokenIndices, partialNeighborEvidencePresent: scored.candidates[0].partial_neighbor_evidence_present } : null,
        rankedCandidates: scored.candidates.map(c => ({ word: c.word, score: c.score, probability: c.probability, rank: c.rank })),
        topCandidates: scored.candidates.slice(0, 5).map(c => ({ word: c.word, score: c.score, probability: c.probability })) });
      if (ETTIN_SHADOW_ENABLED) {
        const shadowOpportunity = HUMAN_PLAYTEST_TURN.opportunity;
        const shadowTarget = targetSlot.slotIndex;
        const shadowBoardKey = publicBoardKey;
        if (ettinShadowBusy) {
          emitDiagnosticEvent('ettin-shadow-skipped-busy', {
            opportunity: shadowOpportunity, opportunityId: `${shadowOpportunity}:${shadowBoardKey}`,
            targetSlot: shadowTarget, targetSlotId: `slot-${shadowTarget}`,
          });
        } else {
          const shadowSummary = buildEttinShadowClueSummary(snapshot);
          ettinShadowBusy = true;
          void (async () => {
            try {
              const shadow = await globalThis.GGGEttinProvider.scoreCandidatesShadow(snapshot, bounded, shadowSummary);
              emitDiagnosticEvent('ettin-shadow-scored', {
                provider: 'ETTIN', shadowVersion: 'public-clue-summary-v1', opportunity: shadowOpportunity,
                opportunityId: `${shadowOpportunity}:${shadowBoardKey}`, targetSlot: shadowTarget,
                targetSlotId: `slot-${shadowTarget}`, publicClueSummary: shadowSummary.trim(),
                rankedCandidates: shadow.candidates.map(c => [c.word, c.probability]),
              });
            } catch (error) {
              emitDiagnosticEvent('ettin-shadow-failed', {
                provider: 'ETTIN', shadowVersion: 'public-clue-summary-v1', opportunity: shadowOpportunity,
                opportunityId: `${shadowOpportunity}:${shadowBoardKey}`, targetSlot: shadowTarget,
                targetSlotId: `slot-${shadowTarget}`, publicClueSummary: shadowSummary.trim(),
                error: error.code || String(error.message || error),
              });
            } finally {
              ettinShadowBusy = false;
            }
          })();
        }
      }
      const proposalReasonsByWord = new Map(bounded.map(candidate => [normalizeAiCandidate(candidate.word), candidate.proposalReasons || []]));
      return { status: 'ready', pool: { predictionMode: 'ettin-pilot', targetLength: targetSlot.length, targetSlot: { group: targetSlot.group, slotIndex: targetSlot.slotIndex, length: targetSlot.length },
        candidates: scored.candidates.map(c => ({ ...c, proposalReasons: proposalReasonsByWord.get(normalizeAiCandidate(c.word)) || [], normalized: c.normalized || normalizeAiCandidate(c.word), publicBoardKey })),
        entityTypeContext: entityContext,
        entitySlotCompatibilityContext,
        discoursePersonCompatibilityContext,
        publicBoardKey, lexicalCandidateCount: shortlistCandidates.length, universeCandidateCount: lexicalPool.universe.length,
        hardValidPopulationCount: lexicalPool.hardCandidates.length, hardValidCandidateCount: hardValid.length,
        ettinCandidateCount: bounded.length, candidateCap: cap, modelLoadMs: scored.loadMs, scoringMs: Number((performance.now() - started).toFixed(3)), snapshot } };
    } catch (error) {
      logEttinPilot('ettin-failed', targetSlot, { reason: error.code || String(error.message || error), lexicalCandidateCount: shortlistCandidates.length, universeCandidateCount: lexicalPool.universe.length, hardValidPopulationCount: lexicalPool.hardCandidates.length, hardValidCandidateCount: hardValid.length, ettinCandidateCount: bounded.length });
      return { status: 'operational-failure', reason: error.code || String(error.message || error) };
    }
  }

  async function buildEttinPilotTurnPool(initialSlot, ownership) {
    if (!currentEttinOpportunity(ownership)) return { status: 'stale' };
    let attentionPlan;
    try {
      attentionPlan = await buildEttinAttentionPlan(initialSlot, ownership);
    } catch (error) {
      return currentEttinOpportunity(ownership)
        ? { status: 'operational-failure', reason: error.code || String(error.message || error) }
        : { status: 'stale' };
    }
    if (!currentEttinOpportunity(ownership)) return { status: 'stale' };
    if (attentionPlan?.status === 'stale' || attentionPlan?.status === 'operational-failure') return attentionPlan;
    if (attentionPlan?.status === 'board-empty') return { ...attentionPlan, attemptedTargetSlots: [] };
    if (attentionPlan?.status !== 'ready') return { status: 'operational-failure', reason: 'attention-plan-unavailable' };

    const triedSlots = new Set();
    while (true) {
      if (!currentEttinOpportunity(ownership)) return { status: 'stale' };
      const choice = chooseEttinAttentionTarget(attentionPlan.assessed, triedSlots);
      if (!choice) return { status: 'board-empty', boardKey: attentionPlan.boardKey,
        eligibleSlotCount: attentionPlan.assessed.length, attemptedTargetSlots: [...triedSlots] };
      const selected = choice.selected;
      triedSlots.add(selected.slot.slotIndex);
      const attemptPlan = { ...attentionPlan, selectedSlot: selected.slot,
        selectedPool: selected.pool, selectedReason: choice.reason };
      logEttinAttentionSelection(attentionPlan, selected, choice.reason);
      let result;
      try {
        result = await buildEttinPilotPool(selected.slot, attemptPlan, ownership);
      } catch (error) {
        return currentEttinOpportunity(ownership)
          ? { status: 'operational-failure', reason: error.code || String(error.message || error) }
          : { status: 'stale' };
      }
      if (!currentEttinOpportunity(ownership) || result?.status === 'stale') return { status: 'stale' };
      if (result?.status === 'operational-failure') return result;
      if (result?.status === 'target-empty') continue;
      if (result?.status !== 'ready' || !result.pool) return { status: 'operational-failure', reason: 'invalid-target-result' };
      result.pool.boardKey = result.pool.publicBoardKey;
      result.pool.attentionPlan = attemptPlan;
      return result;
    }
  }

  function getHumanPlaytestAnalysis(word, properNoun = false) {
    const base = globalThis.GGGHumanPlaytest.enrichAnalysis(analyzeAiWord(String(word).toLowerCase()));
    const roles = new Set(base.roles);
    if (properNoun) { roles.add("properNoun"); roles.add("noun"); }
    return { word: base.word, roles: [...roles], lexicalRoles: [...base.roles], lemmas: base.lemmas,
      known: base.known, primaryVerb: base.primaryVerb, ordinaryBase: base.ordinaryBase, transitive: base.transitive, primaryAdjective: base.primaryAdjective, primaryNoun: base.primaryNoun, pluralNoun: base.pluralNoun, dictionaryProper: properNoun };
  }

  function buildEttinConstructionContext(state, engine, dictionary) {
    const visibleAnalyses = state.slots.map((slot, index) => {
      if (!slot.solved) return null;
      const word = engine.tokenAt(slot);
      const ordinary = getHumanPlaytestAnalysis(word);
      const initial = index === 0 || /[.!?]/.test(state.slots[index - 1].trailing);
      const closed = ordinary.roles.some(role => ['auxiliary', 'pronoun', 'article', 'determiner', 'preposition', 'conjunction'].includes(role));
      const knownName = engine.nameFamiliarity(word) && (!initial || !closed);
      const properNoun = Boolean(slot.letters[0]?.capital && (knownName ||
        (dictionary.isProperWord(word) && !dictionary.isAccepted(word))));
      return getHumanPlaytestAnalysis(word, properNoun);
    });
    return engine.construction(state, visibleAnalyses, true);
  }

  const ENTITY_TYPE_ORDER = ['PERSON_ANIMATE', 'TIME_CALENDAR', 'BUSINESS', 'PLACE'];
  const ENTITY_TYPE_CATEGORY_MAP = Object.freeze({
    'first-names': ['PERSON_ANIMATE'], 'surnames': ['PERSON_ANIMATE'],
    weekdays: ['TIME_CALENDAR'], months: ['TIME_CALENDAR'], 'holidays-festivals': ['TIME_CALENDAR'],
    countries: ['PLACE'], 'japan-places': ['PLACE'], 'foreign-cities': ['PLACE'], regions: ['PLACE'],
    landmarks: ['PLACE'], 'natural-geography': ['PLACE'],
    'companies-brands': ['BUSINESS'], 'stores-chains': ['BUSINESS', 'PLACE'],
  });
  const ENTITY_TYPE_INTERPERSONAL_PREDICATES = new Set(['love', 'like', 'know', 'meet', 'invite', 'help']);

  function candidateEntityTypes(candidate, engine = globalThis.GGGHumanPlaytest) {
    const sources = new Map(ENTITY_TYPE_ORDER.map(type => [type, new Set()]));
    const add = (type, source) => sources.get(type)?.add(source);
    for (const category of candidate?.properNounBankCategories || []) {
      for (const type of ENTITY_TYPE_CATEGORY_MAP[category] || []) add(type, `bank:${category}`);
    }
    if (Number(candidate?.nameFamiliarity) > 0 || candidate?.legacyRecognizedName === true) {
      add('PERSON_ANIMATE', 'legacy-recognized-name');
    }
    const lexical = engine?.semanticClasses?.(candidate?.word || '', candidate?.analysis, false) || [];
    if (lexical.some(type => ['PERSON', 'ANIMAL', 'ANIMATE'].includes(type))) add('PERSON_ANIMATE', 'lexical:animate');
    if (lexical.includes('TIME')) add('TIME_CALENDAR', 'lexical:time');
    if (lexical.includes('PLACE')) add('PLACE', 'lexical:place');
    return Object.fromEntries(ENTITY_TYPE_ORDER
      .filter(type => sources.get(type).size)
      .map(type => [type, [...sources.get(type)]]));
  }

  function entityTypeSentenceBounds(state, engine, index) {
    let start = index, end = index;
    while (start > 0 && !/[.!?]/.test(state.slots[start - 1]?.trailing || '')) start--;
    while (end < state.slots.length - 1 && !/[.!?]/.test(state.slots[end]?.trailing || '')) end++;
    return { start, end };
  }

  function entityTypeContextForTarget(state, targetSlot, construction, engine) {
    const targetIndex = targetSlot?.slotIndex;
    const none = { confidence: 'NONE', hypotheses: [], evidence: [] };
    if (!state?.slots || !Number.isInteger(targetIndex) || !state.slots[targetIndex]) return none;
    const target = state.slots[targetIndex];
    const proper = engine.properContext(state);
    if (!(target.letters?.[0]?.capital && !proper.sentenceInitial && proper.active)) return none;
    const { start, end } = entityTypeSentenceBounds(state, engine, targetIndex);
    const solved = index => index >= start && index <= end && state.slots[index]?.solved === true;
    const word = index => solved(index) ? engine.tokenAt(state.slots[index]).toLocaleLowerCase() : '';
    const analysis = index => word(index) ? getHumanPlaytestAnalysis(word(index)) : null;
    const lemmaMatches = (value, result) => [value, ...(result?.lemmas || [])]
      .some(lemma => ENTITY_TYPE_INTERPERSONAL_PREDICATES.has(String(lemma).toLocaleLowerCase()));
    const typeEvidence = new Map();
    const add = (type, confidence, reason, indices) => {
      typeEvidence.set(type, { type, confidence, reason, slots: indices });
    };
    const hasCompetingFrame = Boolean(construction?.closedFamily || construction?.requiredForm ||
      construction?.negativeHave || construction?.objectCompound || construction?.prepositionFamily ||
      construction?.conditionalOpening || construction?.listCoordination || construction?.possessiveParallel);

    // Who + auxiliary + target subject + known interpersonal base-form verb.
    if (!hasCompetingFrame && targetIndex === start + 2 && targetIndex + 1 === end && word(start) === 'who' &&
        solved(start + 1) && ['do', 'does', 'did'].includes(word(start + 1)) &&
        solved(targetIndex + 1) && /\?/.test(state.slots[end]?.trailing || '')) {
      const verb = analysis(targetIndex + 1);
      const roles = new Set(verb?.lexicalRoles || verb?.roles || []);
      if (roles.has('baseVerb') && lemmaMatches(word(targetIndex + 1), verb)) {
        add('PERSON_ANIMATE', 'STRONG', 'interpersonal-question-subject',
          [start, start + 1, targetIndex + 1, end]);
      }
    }

    // Solved person-like subject + interpersonal predicate + direct-object target.
    const followingNominal = targetIndex < end && solved(targetIndex + 1) &&
      ['noun', 'properNoun'].some(role => (analysis(targetIndex + 1)?.lexicalRoles || []).includes(role));
    if (!hasCompetingFrame && targetIndex === start + 2 && targetIndex === end && !followingNominal &&
        solved(start) && solved(start + 1) &&
        construction?.objectPosition === true && !construction?.objectCompound &&
        !construction?.prepositionFamily && !construction?.conditionalOpening) {
      const subjectAnalysis = analysis(start);
      const subjectRoles = new Set(subjectAnalysis?.lexicalRoles || subjectAnalysis?.roles || []);
      const pronounSubject = subjectRoles.has('subjectPronoun') &&
        ['i', 'you', 'he', 'she', 'we', 'they'].includes(word(start));
      const subjectTypes = candidateEntityTypes({ word: word(start), analysis: subjectAnalysis,
        properNoun: subjectRoles.has('properNoun'), nameFamiliarity: engine.nameFamiliarity(word(start)) }, engine);
      const interpersonal = lemmaMatches(word(start + 1), analysis(start + 1));
      if ((pronounSubject || subjectTypes.PERSON_ANIMATE) && interpersonal) {
        add('PERSON_ANIMATE', 'SUPPORTED', 'interpersonal-direct-object', [start, start + 1, targetIndex]);
      }
    }

    // Sentence-opening temporal adjunct: determiner, target comma, then a
    // fully visible simple subject + finite lexical predicate.
    if (targetIndex === start + 1 && solved(start) && engine.timeDeterminer(word(start)) &&
        /,/.test(state.slots[targetIndex]?.trailing || '') && targetIndex + 2 <= end &&
        solved(targetIndex + 1) && solved(targetIndex + 2) && !hasCompetingFrame) {
      const subject = analysis(targetIndex + 1), predicate = analysis(targetIndex + 2);
      const subjectRoles = new Set(subject?.lexicalRoles || subject?.roles || []);
      const predicateRoles = new Set(predicate?.lexicalRoles || predicate?.roles || []);
      const nominalSubject = ['noun', 'properNoun', 'subjectPronoun'].some(role => subjectRoles.has(role));
      const finitePredicate = predicateRoles.has('finiteVerb') && predicateRoles.has('verb') && predicate.primaryVerb === true;
      if (nominalSubject && finitePredicate) {
        add('TIME_CALENDAR', 'STRONG', 'sentence-opening-temporal-adjunct',
          [start, targetIndex, targetIndex + 1, targetIndex + 2]);
      }
    }

    // Purchase location; inspect at most nine preceding slots, never cross
    // the sentence, and require a fully solved object path from buy/purchase.
    if (targetIndex === end && targetIndex > start && solved(targetIndex - 1) &&
        word(targetIndex - 1) === 'at') {
      const lowerBound = Math.max(start, targetIndex - 9);
      const visibleAnalyses = state.slots.map((_, index) => solved(index) ? analysis(index) : null);
      const localConstructions = new Map();
      const constructionAt = index => {
        if (!localConstructions.has(index)) {
          localConstructions.set(index, engine.construction({ ...state, targetSlotIndex: index }, visibleAnalyses));
        }
        return localConstructions.get(index);
      };
      const competingFinitePredicate = (index, roles) => {
        if (!roles.has('finiteVerb')) return false;
        if (roles.has('auxiliary') || !roles.has('noun')) return true;
        const local = constructionAt(index);
        const subjectPredicate = local.predicate && local.subjectWord && local.number;
        const nominalFrame = local.objectPosition || local.objectCompound || local.listCoordination ||
          local.expectedSemantic?.length;
        return Boolean(subjectPredicate) || !nominalFrame;
      };
      let purchaseIndex = -1, objectNominal = false, blocked = false;
      for (let index = targetIndex - 2; index >= lowerBound; index--) {
        if (!solved(index)) { blocked = true; break; }
        const trailing = state.slots[index]?.trailing || '';
        if (/[;:.!?]/.test(trailing)) { blocked = true; break; }
        const currentAnalysis = analysis(index);
        const currentRoles = new Set(currentAnalysis?.lexicalRoles || currentAnalysis?.roles || []);
        const isPurchase = [word(index), ...(currentAnalysis?.lemmas || [])]
          .some(lemma => ['buy', 'purchase'].includes(String(lemma).toLocaleLowerCase()));
        if (isPurchase && currentRoles.has('verb')) { purchaseIndex = index; break; }
        if (competingFinitePredicate(index, currentRoles)) { blocked = true; break; }
        if (index < targetIndex - 2 && ['noun', 'properNoun'].some(role => currentRoles.has(role))) objectNominal = true;
      }
      if (!blocked && purchaseIndex >= lowerBound && purchaseIndex < targetIndex - 2) {
        const objectSlots = [];
        let validObject = true;
        for (let index = purchaseIndex + 1; index <= targetIndex - 2; index++) {
          if (!solved(index)) { validObject = false; break; }
          const roles = new Set(analysis(index)?.lexicalRoles || analysis(index)?.roles || []);
          if (competingFinitePredicate(index, roles)) {
            validObject = false;
            break;
          }
          objectNominal ||= ['noun', 'properNoun'].some(role => roles.has(role));
          objectSlots.push(index);
        }
        if (validObject && objectNominal) {
          add('BUSINESS', 'STRONG', 'purchase-location', [purchaseIndex, ...objectSlots, targetIndex - 1, targetIndex]);
          add('PLACE', 'SUPPORTED', 'purchase-location', [purchaseIndex, ...objectSlots, targetIndex - 1, targetIndex]);
        }
      }
    }
    const hypotheses = ENTITY_TYPE_ORDER.filter(type => typeEvidence.has(type)).map(type => typeEvidence.get(type));
    const confidence = hypotheses.some(item => item.confidence === 'STRONG') ? 'STRONG' :
      hypotheses.some(item => item.confidence === 'SUPPORTED') ? 'SUPPORTED' : 'NONE';
    return { confidence, hypotheses, evidence: [] };
  }

  function discoursePersonCompatibilityContextForTarget(state, targetSlot, construction, engine, enabled = DISCOURSE_PERSON_COMPATIBILITY_ENABLED) {
    const none = { active: false, confidence: 'NONE', pronoun: '', role: '', predicate: '', reason: '' };
    if (!enabled || !state?.slots || !targetSlot || !engine) return none;
    const targetIndex = targetSlot.slotIndex;
    if (!Number.isInteger(targetIndex) || !state.slots[targetIndex] || state.slots[targetIndex].solved) return none;
    const baseContext = entityTypeContextForTarget(state, targetSlot, construction, engine);
    const alignedPersonHypothesis = baseContext.hypotheses?.find(item =>
      item.type === 'PERSON_ANIMATE' && item.confidence === 'STRONG' &&
      item.reason === 'interpersonal-question-subject');
    if (!alignedPersonHypothesis) return none;

    const question = entityTypeSentenceBounds(state, engine, targetIndex);
    const solved = index => index >= 0 && index < state.slots.length && state.slots[index]?.solved === true;
    const word = index => solved(index) ? engine.tokenAt(state.slots[index]).toLocaleLowerCase() : '';
    const analysis = index => word(index) ? getHumanPlaytestAnalysis(word(index)) : null;
    const roles = index => new Set(analysis(index)?.lexicalRoles || analysis(index)?.roles || []);
    const questionVerbIndex = targetIndex + 1;
    if (targetIndex !== question.start + 2 || questionVerbIndex !== question.end ||
        word(question.start) !== 'who' || !['do', 'does', 'did'].includes(word(question.start + 1)) ||
        !/\?/.test(state.slots[question.end]?.trailing || '') || !solved(questionVerbIndex)) return none;
    const questionVerb = analysis(questionVerbIndex);
    const questionVerbRoles = new Set(questionVerb?.lexicalRoles || questionVerb?.roles || []);
    const approvedLemma = [word(questionVerbIndex), ...(questionVerb?.lemmas || [])]
      .map(lemma => String(lemma).toLocaleLowerCase())
      .find(lemma => ENTITY_TYPE_INTERPERSONAL_PREDICATES.has(lemma));
    if (!approvedLemma || !questionVerbRoles.has('baseVerb')) return none;

    const answerStart = question.end + 1;
    const answer = entityTypeSentenceBounds(state, engine, answerStart);
    const pronoun = word(answerStart);
    const pronounRoles = roles(answerStart);
    if (answer.start !== answerStart || answer.end !== answerStart + 2 ||
        !['he', 'she'].includes(pronoun) || !pronounRoles.has('subjectPronoun') ||
        !solved(answerStart + 1) || !solved(answerStart + 2) ||
        !/[.!]/.test(state.slots[answer.end]?.trailing || '') ||
        /\?/.test(state.slots[answer.end]?.trailing || '')) return none;

    const answerVerbIndex = answerStart + 1;
    const answerVerb = analysis(answerVerbIndex);
    const answerVerbRoles = new Set(answerVerb?.lexicalRoles || answerVerb?.roles || []);
    const answerLemmas = new Set([word(answerVerbIndex), ...(answerVerb?.lemmas || [])]
      .map(lemma => String(lemma).toLocaleLowerCase()));
    if (!answerVerbRoles.has('finiteVerb') || !answerVerbRoles.has('verb') ||
        answerVerb?.primaryVerb !== true || !answerLemmas.has(approvedLemma)) return none;

    const answerConstruction = buildEttinConstructionContext({ ...state, targetSlotIndex: answerStart + 2 },
      engine, globalThis.vault4Dictionary.dictionary);
    if (answerConstruction?.objectPosition !== true || answerConstruction?.objectCompound ||
        answerConstruction?.prepositionFamily) return none;
    return { active: true, confidence: 'STRONG', pronoun, role: 'subject', predicate: approvedLemma,
      reason: 'adjacent-aligned-interpersonal-question-answer' };
  }

  function evaluateDiscoursePersonCompatibility(candidate, context, engine = globalThis.GGGHumanPlaytest,
      enabled = DISCOURSE_PERSON_COMPATIBILITY_ENABLED) {
    const neutral = { status: 'neutral', membership: 'unknown', support: 0, penalty: 0 };
    if (!enabled || !context?.active || context.confidence !== 'STRONG' ||
        !['he', 'she'].includes(context.pronoun) || context.role !== 'subject' ||
        candidate?.properNameRoleEligible !== true || candidate?.properNoun !== true) return neutral;
    const categories = candidate.properNounBankCategories || [];
    const recognizedNameReading = candidate.legacyRecognizedName === true || candidate.nameOnlyAuthorized === true ||
      candidate.lexicalClass === 'given-name' || candidate.lexicalClass === 'proper-noun-bank' ||
      categories.some(category => ['first-names', 'surnames'].includes(category));
    if (!recognizedNameReading || typeof engine?.nameSourceMembership !== 'function') return neutral;
    const membership = engine.nameSourceMembership(candidate.orthographicSurface || candidate.submissionSurface || candidate.word);
    if (!['M', 'F', 'B'].includes(membership)) return neutral;
    if (membership === 'B') return { status: 'ambiguous', membership, support: 0, penalty: 0 };
    const expectedMembership = context.pronoun === 'she' ? 'F' : 'M';
    if (membership === expectedMembership) {
      return { status: 'compatible', membership, support: DISCOURSE_PERSON_COMPATIBILITY_SUPPORT, penalty: 0 };
    }
    return { status: 'mismatch', membership, support: 0, penalty: DISCOURSE_PERSON_COMPATIBILITY_MISMATCH_PENALTY };
  }

  function entitySlotCompatibilityContextForTarget(state, targetSlot, construction, engine, entityContext) {
    const none = { confidence: 'NONE', hypotheses: [] };
    if (!ENTITY_SLOT_COMPATIBILITY_ENABLED) return none;
    const hypotheses = (entityContext?.hypotheses || []).filter(item =>
      item?.confidence === 'STRONG' ||
      (item?.confidence === 'SUPPORTED' && item.reason === 'purchase-location'));
    const targetIndex = targetSlot?.slotIndex;
    if (Number.isInteger(targetIndex) && state?.slots?.[targetIndex] && construction && engine) {
      const { start, end } = entityTypeSentenceBounds(state, engine, targetIndex);
      const solved = index => index >= start && index <= end && state.slots[index]?.solved === true;
      const word = index => solved(index) ? engine.tokenAt(state.slots[index]).toLocaleLowerCase() : '';
      const analysis = index => word(index) ? getHumanPlaytestAnalysis(word(index)) : null;
      const roles = index => new Set(analysis(index)?.lexicalRoles || analysis(index)?.roles || []);
      const next = targetIndex + 1;
      const nextRoles = roles(next);
      const nextAnalysis = analysis(next);
      const purchaseVerb = [word(next), ...(nextAnalysis?.lemmas || [])]
        .some(lemma => ['buy', 'purchase'].includes(String(lemma).toLocaleLowerCase()));
      const clearBuyerSubject = !construction.closedFamily && !construction.requiredForm &&
        !construction.negativeHave && !construction.objectCompound && !construction.prepositionFamily &&
        !construction.conditionalOpening && targetIndex < end && solved(next) && purchaseVerb &&
        nextRoles.has('verb') && nextRoles.has('finiteVerb') && nextAnalysis?.primaryVerb === true;
      let visiblePurchaseObject = false;
      if (clearBuyerSubject) {
        for (let index = next + 1; index <= end; index++) {
          const trailing = state.slots[index]?.trailing || '';
          if (/[;:.!?]/.test(trailing)) break;
          if (!solved(index)) continue;
          const currentRoles = roles(index);
          if (['noun', 'properNoun'].some(role => currentRoles.has(role)) &&
              !currentRoles.has('finiteVerb')) {
            visiblePurchaseObject = true;
            break;
          }
        }
      }
      if (clearBuyerSubject && visiblePurchaseObject &&
          !hypotheses.some(item => item.type === 'PERSON_ANIMATE' && item.reason === 'buyer-subject-purchase')) {
        hypotheses.push({ type: 'PERSON_ANIMATE', confidence: 'SUPPORTED',
          reason: 'buyer-subject-purchase', slots: [targetIndex, next] });
      }
    }
    const confidence = hypotheses.some(item => item.confidence === 'STRONG') ? 'STRONG' :
      hypotheses.some(item => item.confidence === 'SUPPORTED') ? 'SUPPORTED' : 'NONE';
    return { confidence, hypotheses };
  }

  function buildEntityTypeAccessExtension(classData, snapshot, targetSlot, baseline, legacyExtension, context, remaining) {
    if (!ENTITY_TYPE_ACCESS_ENABLED || !context?.hypotheses?.length) return { candidates: [], capacityBlocked: false };
    const wanted = context.hypotheses.filter(item => item.confidence === 'STRONG' || item.confidence === 'SUPPORTED');
    if (!wanted.length) return { candidates: [], capacityBlocked: false };
    const already = new Set([...baseline, ...legacyExtension].map(candidate => normalizeAiCandidate(candidate.word)));
    const compare = classData?.compare;
    if (typeof compare !== 'function') return { candidates: [], capacityBlocked: false };
    const queues = new Map(wanted.map(item => [item.type, []])), typeMetadata = new Map();
    for (const tier of ['supported', 'neutral']) {
      for (const candidate of classData.enriched?.filter(item => item.supportTier === tier) || []) {
        const types = candidateEntityTypes(candidate);
        typeMetadata.set(candidate, types);
        for (const item of wanted) {
          if (types[item.type] && !already.has(normalizeAiCandidate(candidate.word))) queues.get(item.type).push(candidate);
        }
      }
    }
    for (const queue of queues.values()) queue.sort(compare);
    const candidates = [], matched = new Map(), cursors = new Map([...queues.keys()].map(type => [type, 0]));
    let progress = true, capacityBlocked = false;
    while (progress) {
      progress = false;
      for (const item of wanted) {
        const queue = queues.get(item.type) || [];
        let cursor = cursors.get(item.type) || 0;
        while (cursor < queue.length) {
          const candidate = queue[cursor++];
          cursors.set(item.type, cursor);
          const normalized = normalizeAiCandidate(candidate.word);
          if (!normalized || already.has(normalized)) continue;
          if (!isSafelySubmittableAiCandidate(candidate.submissionSurface, targetSlot.length) ||
              !matchesAiRevealedLetters(candidate.submissionSurface, targetSlot) || hasWrongAiGuessForSlot(targetSlot.slotIndex, candidate.submissionSurface) ||
              globalThis.GGGEttinProvider.validateCandidate(snapshot, candidate.submissionSurface)?.ok !== true) continue;
          if (candidates.length >= remaining) {
            capacityBlocked = true;
            break;
          }
          already.add(normalized);
          candidates.push({ ...candidate, shortlistClasses: [...candidate.lexicalClasses] });
          matched.set(normalized, [...ENTITY_TYPE_ORDER.filter(type => wanted.some(entry => entry.type === type) &&
            typeMetadata.get(candidate)?.[type])]);
          progress = true;
          break;
        }
        if (capacityBlocked) break;
      }
      if (capacityBlocked) break;
    }
    return { candidates, matchedTypes: matched, capacityBlocked };
  }

  function ettinContextualAccessExpectation(context) {
    if (!context || context.closedFamily || context.negativeHave) return null;
    const hasStrongSupport = role => context.profiles.some(profile =>
      Number(profile.strength) >= 0.75 && Number(profile.roles?.[role]) >= 3);
    if (context.requiredForm === 'baseVerb' || context.requiredForm === 'pastParticiple') {
      return hasStrongSupport(context.requiredForm)
        ? { kind: 'required-form', form: context.requiredForm, number: null }
        : null;
    }
    if (context.requiredForm || !context.predicate || !['singular', 'first', 'plural'].includes(context.number) || !hasStrongSupport('finiteVerb')) return null;
    return { kind: 'finite-verb', form: null, number: context.number };
  }

  function ettinPersonAccessQualification(context) {
    if (!ETTIN_PERSON_ACCESS_ENABLED) return { qualified: false, reason: 'disabled' };
    if (context?.meaningfullyCapitalized !== true) return { qualified: false, reason: 'not-meaningfully-capitalized' };
    const construction = context.construction;
    if (!construction?.personLike) return { qualified: false, reason: 'no-person-like-construction' };
    if (construction.closedFamily || construction.requiredForm || construction.negativeHave) {
      return { qualified: false, reason: 'conflicting-construction-evidence' };
    }
    const supported = construction.profiles?.some(profile =>
      Number(profile.strength) >= 0.75 && Number(profile.roles?.properNoun) >= 3);
    return supported
      ? { qualified: true, reason: 'strong-person-like-proper-name-support' }
      : { qualified: false, reason: 'insufficient-proper-name-support' };
  }

  function buildEttinPersonAccessExtension(classData, snapshot, targetSlot, baseline, limit) {
    if (!ETTIN_PERSON_ACCESS_ENABLED || !classData || limit <= 0) return [];
    const baselineWords = new Set(baseline.map(candidate => normalizeAiCandidate(candidate.word)));
    const seen = new Set(baselineWords), extension = [];
    const compare = classData.compare;
    if (typeof compare !== 'function') return extension;
    const isPersonCompatible = candidate =>
      (candidate.properNounBankCategories || []).some(category => category === 'first-names' || category === 'surnames') ||
      Number(candidate.nameFamiliarity) > 0;
    const queues = [classData.queues?.supported?.['proper-names'], classData.queues?.neutral?.['proper-names']];
    for (const queue of queues) {
      const ordered = [...(queue || [])].sort(compare);
      for (const candidate of ordered) {
        const word = normalizeAiCandidate(candidate.word);
        if (!word || seen.has(word) || !isPersonCompatible(candidate)) continue;
        if (!isSafelySubmittableAiCandidate(candidate.submissionSurface, targetSlot.length) ||
            !matchesAiRevealedLetters(candidate.submissionSurface, targetSlot) || hasWrongAiGuessForSlot(targetSlot.slotIndex, candidate.submissionSurface) ||
            globalThis.GGGEttinProvider.validateCandidate(snapshot, candidate.submissionSurface)?.ok !== true) continue;
        seen.add(word);
        extension.push({ ...candidate, shortlistClasses: [...candidate.lexicalClasses] });
        if (extension.length >= limit) return extension;
      }
    }
    return extension;
  }

  function buildEttinContextualAccessExtension(classData, context, snapshot, targetSlot, baseline, limit) {
    const expectation = ettinContextualAccessExpectation(context);
    if (!ETTIN_CONTEXTUAL_ACCESS_ENABLED || !expectation || limit <= 0) return { expectation, candidates: [] };
    const baselineWords = new Set(baseline.map(candidate => normalizeAiCandidate(candidate.word)));
    const seen = new Set(baselineWords), extension = [];
    const excludedRoles = ['auxiliary', 'modal', 'beAuxiliary', 'doAuxiliary', 'haveAuxiliary'];
    const queues = [classData?.queues?.supported?.['lexical-verbs'], classData?.queues?.neutral?.['lexical-verbs']];
    for (const queue of queues) {
      for (const candidate of queue || []) {
        const word = normalizeAiCandidate(candidate.word);
        if (!word || seen.has(word)) continue;
        const analysis = candidate.analysis;
        if (analysis?.known !== true) continue;
        const roles = new Set(Array.isArray(analysis?.lexicalRoles) ? analysis.lexicalRoles : (analysis?.roles || []));
        if (excludedRoles.some(role => roles.has(role))) continue;
        let qualifies = false;
        if (expectation.form === 'baseVerb') {
          qualifies = roles.has('baseVerb') && analysis.ordinaryBase === true;
        } else if (expectation.form === 'pastParticiple') {
          qualifies = roles.has('pastParticiple');
        } else if (expectation.number === 'singular') {
          qualifies = analysis.primaryVerb === true && roles.has('verb') && (roles.has('thirdSingular') || roles.has('pastTense'));
        } else {
          qualifies = analysis.primaryVerb === true && roles.has('verb') && (roles.has('baseVerb') || roles.has('pastTense'));
        }
        if (!qualifies || !isSafelySubmittableAiCandidate(candidate.submissionSurface, targetSlot.length) ||
            !matchesAiRevealedLetters(candidate.submissionSurface, targetSlot) || hasWrongAiGuessForSlot(targetSlot.slotIndex, candidate.submissionSurface) ||
            globalThis.GGGEttinProvider.validateCandidate(snapshot, candidate.submissionSurface)?.ok !== true) continue;
        seen.add(word);
        extension.push(candidate);
        if (extension.length >= limit) return { expectation, candidates: extension };
      }
    }
    return { expectation, candidates: extension };
  }

  // Stage 1: public hard constraints are applied before lexical-class queues
  // are built. The stable hash only breaks genuine ties; it prevents source
  // or dictionary storage order from becoming a priority.
  function stage1StableHash(value) {
    let hash = 2166136261;
    for (const character of String(value)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
    return hash >>> 0;
  }

  function stage1ClassifyCandidate(candidate, properNameQueueAllowed = false) {
    if (candidate.nameOnlyRestricted) return candidate.nameOnlyAuthorized ? ['proper-names'] : [];
    if (candidate.requiresProperNameAdmission) return candidate.properNameRoleEligible ? ['proper-names'] : [];
    const roles = new Set(candidate.analysis?.lexicalRoles || candidate.analysis?.roles || []);
    const groups = new Set();
    const functionRoles = ['article', 'determiner', 'pronoun', 'auxiliary', 'preposition', 'conjunction', 'questionWord', 'modal', 'negator'];
    if (roles.has('noun')) groups.add('nouns');
    if ([...roles].some(role => ['verb', 'baseVerb', 'finiteVerb', 'pastParticiple', 'presentParticiple'].includes(role)) &&
      !([...roles].every(role => ['auxiliary', 'finiteVerb'].includes(role)) && roles.has('auxiliary'))) groups.add('lexical-verbs');
    if ([...roles].some(role => ['adjective'].includes(role))) groups.add('adjectives');
    if ([...roles].some(role => ['adverb'].includes(role))) groups.add('adverbs');
    if ([...roles].some(role => functionRoles.includes(role))) groups.add('function-words');
    if (properNameQueueAllowed && (candidate.properNoun || ['given-name', 'dictionary-capitalized', 'public-entity'].includes(candidate.lexicalClass))) groups.add('proper-names');
    if (!groups.size) groups.add('fallback');
    return [...groups];
  }

  function stage1PredicateContext(state, targetSlot) {
    const index = targetSlot?.slotIndex;
    if (!state?.slots || !Number.isInteger(index) || !state.slots[index] || state.slots[index].solved) {
      return { active: false, type: null };
    }
    let start = index, end = index;
    while (start > 0 && !/[.!?]/.test(state.slots[start - 1]?.trailing || '')) start--;
    while (end < state.slots.length - 1 && !/[.!?]/.test(state.slots[end]?.trailing || '')) end++;
    if (state.slots[end]?.trailing !== '.' || state.slots.slice(start, end).some(slot => slot?.trailing)) {
      return { active: false, type: null };
    }
    const sentence = state.slots.slice(start, end + 1);
    if (sentence.some((slot, offset) => start + offset !== index && !slot?.solved)) {
      return { active: false, type: null };
    }
    const plainWord = slot => {
      if (!slot?.solved || !slot.letters?.length || !/^[A-Za-z]+$/.test(globalThis.GGGHumanPlaytest.tokenAt(slot))) return false;
      return !(slot.gaps || []).some((gap, gapIndex) => gap &&
        !(gapIndex === slot.letters.length && gap === '.' && slot.trailing === '.'));
    };
    if (sentence.some((slot, offset) => start + offset !== index && !plainWord(slot))) {
      return { active: false, type: null };
    }
    const target = state.slots[index];
    if (target.letters?.[0]?.capital) return { active: false, type: null };
    const isVisibleRecognizedName = slot => {
      if (!plainWord(slot) || !slot.letters[0]?.capital) return false;
      const word = globalThis.GGGHumanPlaytest.tokenAt(slot);
      return globalThis.GGGHumanPlaytest.nameFamiliarity(word) > 0;
    };
    const isNominalComplement = slots => {
      if (slots.length === 1) {
        const slot = slots[0];
        if (isVisibleRecognizedName(slot)) return true;
        const roles = new Set(getHumanPlaytestAnalysis(globalThis.GGGHumanPlaytest.tokenAt(slot)).lexicalRoles || []);
        return roles.has('noun');
      }
      if (slots.length !== 2) return false;
      const determinerRoles = new Set(getHumanPlaytestAnalysis(globalThis.GGGHumanPlaytest.tokenAt(slots[0])).lexicalRoles || []);
      const nounRoles = new Set(getHumanPlaytestAnalysis(globalThis.GGGHumanPlaytest.tokenAt(slots[1])).lexicalRoles || []);
      return ['article', 'determiner', 'possessiveDeterminer'].some(role => determinerRoles.has(role)) && nounRoles.has('noun');
    };
    const subjectSlots = state.slots.slice(start, index);
    const complementSlots = state.slots.slice(index + 1, end + 1);
    if (!isNominalComplement(complementSlots)) return { active: false, type: null };
    if (subjectSlots.length === 1 && isVisibleRecognizedName(subjectSlots[0])) {
      return { active: true, type: 'single-name-subject' };
    }
    if (subjectSlots.length === 3 && isVisibleRecognizedName(subjectSlots[0]) &&
        globalThis.GGGHumanPlaytest.tokenAt(subjectSlots[1]) === 'and' &&
        isVisibleRecognizedName(subjectSlots[2])) {
      const conjunctionRoles = new Set(getHumanPlaytestAnalysis(globalThis.GGGHumanPlaytest.tokenAt(subjectSlots[1])).lexicalRoles || []);
      if (conjunctionRoles.has('conjunction')) return { active: true, type: 'coordinated-name-subject' };
    }
    return { active: false, type: null };
  }

  // Detect only a short, fully visible declarative subject -> finite verb ->
  // nominal-complement sequence. This is soft role evidence, not a parser or
  // a claim that the subject must be human.
  function stage1SubjectContext(state, targetSlot) {
    const inactive = { active: false, type: null, determinerHeaded: false };
    const index = targetSlot?.slotIndex;
    if (!isEttinPilotMode() || !state?.slots || !Number.isInteger(index) ||
        !state.slots[index] || state.slots[index].solved) return inactive;

    let sentenceStart = index, sentenceEnd = index;
    while (sentenceStart > 0 && !/[.!?]/.test(state.slots[sentenceStart - 1]?.trailing || '')) sentenceStart--;
    while (sentenceEnd < state.slots.length - 1 && !/[.!?]/.test(state.slots[sentenceEnd]?.trailing || '')) sentenceEnd++;
    if (state.slots[sentenceEnd]?.trailing !== '.') return inactive;

    const token = slotIndex => globalThis.GGGHumanPlaytest.tokenAt(state.slots[slotIndex]);
    const plainWord = slotIndex => {
      const slot = state.slots[slotIndex];
      if (!slot?.solved || !slot.letters?.length || !/^[A-Za-z]+$/.test(token(slotIndex))) return false;
      return !(slot.gaps || []).some((gap, gapIndex) => gap && gapIndex < slot.letters.length);
    };
    for (let slotIndex = sentenceStart; slotIndex <= sentenceEnd; slotIndex++) {
      if (slotIndex === index) continue;
      if (!plainWord(slotIndex)) return inactive;
      const trailing = state.slots[slotIndex]?.trailing || '';
      if (slotIndex === sentenceEnd ? trailing !== '.' :
          (trailing !== '' && trailing !== ',')) return inactive;
    }

    const analysisAt = slotIndex => getHumanPlaytestAnalysis(token(slotIndex));
    const rolesAt = slotIndex => new Set(analysisAt(slotIndex).lexicalRoles || analysisAt(slotIndex).roles || []);
    const timeLike = slotIndex => globalThis.GGGHumanPlaytest.semanticClasses(token(slotIndex), analysisAt(slotIndex), false).includes('TIME');
    const determinerRoles = ['article', 'determiner', 'possessiveDeterminer'];
    let subjectStart = index;
    let determinerHeaded = false;
    if (index > sentenceStart && state.slots[index - 1]?.solved &&
        determinerRoles.some(role => rolesAt(index - 1).has(role))) {
      subjectStart = index - 1;
      determinerHeaded = true;
    }

    const prefixLength = subjectStart - sentenceStart;
    let prefixValid = prefixLength === 0;
    if (prefixLength === 1 && state.slots[subjectStart - 1]?.trailing === ',') {
      const prefixRoles = rolesAt(sentenceStart);
      prefixValid = prefixRoles.has('adverb') || timeLike(sentenceStart);
    } else if (prefixLength === 2 && state.slots[subjectStart - 1]?.trailing === ',') {
      const firstRoles = rolesAt(sentenceStart);
      const secondIsTime = timeLike(sentenceStart + 1);
      prefixValid = secondIsTime && [...firstRoles].some(role =>
        ['adjective', 'article', 'determiner', 'possessiveDeterminer'].includes(role));
    }
    if (!prefixValid) return inactive;

    const verbIndex = index + 1;
    if (verbIndex >= sentenceEnd || !plainWord(verbIndex)) return inactive;
    const verbAnalysis = analysisAt(verbIndex);
    const verbRoles = new Set(verbAnalysis.lexicalRoles || verbAnalysis.roles || []);
    if (verbAnalysis.known !== true || verbAnalysis.primaryVerb !== true ||
        !verbRoles.has('verb') || !verbRoles.has('finiteVerb') ||
        !(verbRoles.has('pastTense') || verbRoles.has('thirdSingular')) ||
        ['auxiliary', 'modal', 'beAuxiliary', 'doAuxiliary', 'haveAuxiliary'].some(role => verbRoles.has(role)) ||
        verbAnalysis.transitive !== true) return inactive;

    const frameGroups = globalThis.GGGHumanPlaytest.frameGroups || {};
    const lemmas = new Set([...(verbAnalysis.lemmas || []), token(verbIndex).toLowerCase()]);
    const forbiddenFrames = new Set(['COPULAR', 'INTRANSITIVE', 'PREPOSITIONAL_COMPLEMENT']);
    for (const [family, words] of Object.entries(frameGroups)) {
      if (String(words).split(/\s+/).some(word => lemmas.has(word.toLowerCase())) && forbiddenFrames.has(family)) return inactive;
    }

    const isNominalContinuation = slotIndex => {
      if (slotIndex > sentenceEnd || !plainWord(slotIndex)) return false;
      const slot = state.slots[slotIndex];
      const word = token(slotIndex);
      const roles = rolesAt(slotIndex);
      if (['objectPronoun', 'possessivePronoun'].some(role => roles.has(role))) return true;
      if (slot.letters?.[0]?.capital) {
        const authorization = globalThis.GGGProperNounBank.resolveProperNounAuthorization(word);
        if (authorization.authorized) return true;
      }
      return roles.has('noun');
    };
    const complementIndex = verbIndex + 1;
    if (complementIndex > sentenceEnd) return inactive;
    const complementRoles = rolesAt(complementIndex);
    const hasDeterminer = determinerRoles.some(role => complementRoles.has(role));
    let continuationEnd = complementIndex;
    if (hasDeterminer) {
      let nounIndex = complementIndex + 1;
      if (nounIndex < sentenceEnd && rolesAt(nounIndex).has('adjective')) nounIndex++;
      if (nounIndex > sentenceEnd || !plainWord(nounIndex) || !rolesAt(nounIndex).has('noun')) return inactive;
      continuationEnd = nounIndex;
    } else if (!isNominalContinuation(complementIndex)) {
      return inactive;
    }

    for (let slotIndex = sentenceStart; slotIndex < sentenceEnd; slotIndex++) {
      if (state.slots[slotIndex]?.trailing !== ',') continue;
      const openingPrefaceComma = slotIndex === subjectStart - 1 && prefixLength > 0;
      const postComplementComma = slotIndex >= continuationEnd;
      if (!openingPrefaceComma && !postComplementComma) return inactive;
    }

    return { active: true, type: 'finite-agentive-subject', determinerHeaded };
  }

  function stage1PredicateCandidateCompatibility(candidate) {
    const analysis = candidate?.analysis;
    const lexicalRoles = Array.isArray(analysis?.lexicalRoles) ? analysis.lexicalRoles : null;
    const roles = lexicalRoles || (Array.isArray(analysis?.roles) ? analysis.roles : []);
    if (analysis?.known === false || !roles.length) return 'role-information-unavailable';
    if (roles.some(role => ['verb', 'baseVerb', 'finiteVerb', 'pastParticiple', 'presentParticiple',
      'auxiliary', 'modal', 'beAuxiliary', 'doAuxiliary', 'haveAuxiliary'].includes(role))) {
      return 'verbal-compatible';
    }
    return 'clearly-nonverbal';
  }

  function stage1CoordinationContext(state, targetSlot) {
    const targetIndex = targetSlot?.slotIndex;
    const inactive = { active: false, itemIndices: [], roleFamilies: [], semanticClasses: [] };
    if (!state?.slots || !Number.isInteger(targetIndex) || !state.slots[targetIndex] || state.slots[targetIndex].solved) return inactive;

    let sentenceStart = targetIndex, sentenceEnd = targetIndex;
    while (sentenceStart > 0 && !/[.!?]/.test(state.slots[sentenceStart - 1]?.trailing || '')) sentenceStart--;
    while (sentenceEnd < state.slots.length - 1 && !/[.!?]/.test(state.slots[sentenceEnd]?.trailing || '')) sentenceEnd++;
    if (targetIndex < sentenceStart || targetIndex > sentenceEnd) return inactive;

    const token = index => globalThis.GGGHumanPlaytest.tokenAt(state.slots[index]);
    const roleFamilies = analysis => {
      const roles = new Set(analysis?.roles || analysis?.lexicalRoles || []);
      const families = new Set();
      if (['noun', 'properNoun', 'subjectPronoun', 'objectPronoun'].some(role => roles.has(role))) families.add('nominal');
      if (roles.has('adjective')) families.add('adjective');
      if (analysis?.primaryVerb || ['verb', 'baseVerb', 'pastParticiple', 'presentParticiple'].some(role => roles.has(role)) ||
          (roles.has('finiteVerb') && !roles.has('auxiliary'))) families.add('verb');
      return families;
    };
    const semanticReading = (word, analysis, properNoun, categories = []) => {
      if (properNoun) {
        const personName = categories.some(category => ['first-names', 'surnames'].includes(category)) ||
          globalThis.GGGHumanPlaytest.nameFamiliarity(word) > 0;
        return personName ? ['PERSON', 'ANIMATE'] : [];
      }
      return globalThis.GGGHumanPlaytest.semanticClasses(word, analysis, false);
    };

    for (let coordinator = sentenceStart + 1; coordinator < sentenceEnd; coordinator++) {
      const connector = state.slots[coordinator];
      if (!connector?.solved || !['and', 'or'].includes(token(coordinator))) continue;

      const firstRight = coordinator + 1;
      const lastLeft = coordinator - 1;
      if (lastLeft < sentenceStart || firstRight > sentenceEnd) continue;
      const memberIndices = [lastLeft, firstRight];
      let cursor = lastLeft;
      while (cursor > sentenceStart && /,/.test(state.slots[cursor - 1]?.trailing || '')) {
        cursor--;
        memberIndices.unshift(cursor);
      }
      if (memberIndices.length < 3 || !memberIndices.includes(targetIndex)) continue;
      // At least one comma must link two pre-coordinator items; two-item lists
      // and a comma elsewhere in the sentence do not activate this signal.
      if (!memberIndices.slice(0, -2).some(index => /,/.test(state.slots[index]?.trailing || ''))) continue;
      if (memberIndices.some(index => index < sentenceStart || index > sentenceEnd)) continue;

      // Adjacent solved nominal/adjective material can expose a multiword
      // item (for example, “very angry” or “ice cream”). Do not cross the
      // visible coordinator, punctuation, or a determiner when checking it.
      const targetTrailing = state.slots[targetIndex]?.trailing || '';
      const hasMultiwordContinuation = neighborIndex => {
        if (neighborIndex < sentenceStart || neighborIndex > sentenceEnd || !state.slots[neighborIndex]?.solved) return false;
        const neighborRoles = new Set(getHumanPlaytestAnalysis(token(neighborIndex)).roles || []);
        return ['noun', 'properNoun', 'adjective'].some(role => neighborRoles.has(role));
      };
      if (!/[,.!?;:]/.test(targetTrailing) && targetIndex + 1 <= sentenceEnd && targetIndex + 1 !== coordinator &&
          hasMultiwordContinuation(targetIndex + 1)) continue;
      const previousTrailing = state.slots[targetIndex - 1]?.trailing || '';
      const previousAnalysis = targetIndex > sentenceStart ? getHumanPlaytestAnalysis(token(targetIndex - 1)) : null;
      const previousRoles = new Set(previousAnalysis?.roles || []);
      const previousIsFunctionHead = ['article', 'determiner', 'possessiveDeterminer', 'preposition', 'conjunction', 'auxiliary']
        .some(role => previousRoles.has(role)) || Boolean(previousAnalysis?.primaryVerb);
      if (!/[,.!?;:]/.test(targetTrailing) && targetIndex > sentenceStart && !/[,.;:!?]/.test(previousTrailing) && !previousIsFunctionHead &&
          targetIndex - 1 !== coordinator && hasMultiwordContinuation(targetIndex - 1)) continue;

      const anchors = memberIndices.filter(index => index !== targetIndex && state.slots[index]?.solved).map(index => {
        const word = token(index);
        if (!/^[a-z]+$/i.test(word)) return null;
        const capitalization = Boolean(state.slots[index]?.letters?.[0]?.capital);
        const authorization = capitalization
          ? globalThis.GGGProperNounBank.resolveProperNounAuthorization(word)
          : null;
        const properNoun = Boolean(authorization?.authorized);
        const analysis = getHumanPlaytestAnalysis(word, properNoun);
        const families = roleFamilies(analysis);
        if (!analysis?.known || !families.size) return null;
        return { word, analysis, families,
          semantics: semanticReading(word, analysis, properNoun, authorization?.categories || []) };
      }).filter(Boolean);
      if (!anchors.length) continue;

      const sharedRoles = new Set(anchors[0].families);
      for (const anchor of anchors.slice(1)) {
        for (const family of [...sharedRoles]) if (!anchor.families.has(family)) sharedRoles.delete(family);
      }
      if (!sharedRoles.size) continue;

      const semanticClasses = new Set(anchors.flatMap(anchor => anchor.semantics));
      return { active: true, itemIndices: memberIndices, roleFamilies: [...sharedRoles],
        semanticClasses: [...semanticClasses] };
    }
    return inactive;
  }

  function stage1CoordinationCandidateSupport(candidate, context) {
    if (!context?.active) return { admissionLevel: 0, proposalReasons: [] };
    const analysis = candidate?.analysis;
    const roles = new Set(analysis?.roles || analysis?.lexicalRoles || []);
    const families = new Set();
    if (['noun', 'properNoun', 'subjectPronoun', 'objectPronoun'].some(role => roles.has(role))) families.add('nominal');
    if (roles.has('adjective')) families.add('adjective');
    if (analysis?.primaryVerb || ['verb', 'baseVerb', 'pastParticiple', 'presentParticiple'].some(role => roles.has(role)) ||
        (roles.has('finiteVerb') && !roles.has('auxiliary'))) families.add('verb');
    if (![...context.roleFamilies].some(family => families.has(family))) {
      return { admissionLevel: 0, proposalReasons: [] };
    }
    const proposalReasons = ['public-coordination-role-compatible'];
    let admissionLevel = 1;
    if (context.semanticClasses?.length) {
      const categories = candidate.properNounBankCategories || [];
      const properNoun = Boolean(candidate.properNoun);
      const candidateSemantics = properNoun
        ? (categories.some(category => ['first-names', 'surnames'].includes(category)) || candidate.nameFamiliarity > 0
          ? ['PERSON', 'ANIMATE'] : [])
        : globalThis.GGGHumanPlaytest.semanticClasses(candidate.word, analysis, false);
      if (candidateSemantics.some(semantic => context.semanticClasses.includes(semantic))) {
        admissionLevel = 2;
        proposalReasons.push('public-coordination-semantic-compatible');
      }
    }
    return { admissionLevel, proposalReasons };
  }

  function stage1SubjectCandidateSupport(candidate, context) {
    if (!context?.active) return { admissionLevel: 0, proposalReasons: [] };
    const analysis = candidate?.analysis;
    const lexicalRoles = Array.isArray(analysis?.lexicalRoles) ? analysis.lexicalRoles : [];
    const ordinaryNominal = candidate?.ordinaryRoleEligible === true && lexicalRoles.includes('noun');
    const properName = !context.determinerHeaded && candidate?.properNameRoleEligible === true;
    const subjectPronoun = !context.determinerHeaded && lexicalRoles.includes('subjectPronoun') &&
      candidate?.ordinaryRoleEligible === true;
    if (!(ordinaryNominal || properName || subjectPronoun)) {
      return { admissionLevel: 0, proposalReasons: [] };
    }

    let admissionLevel = 1;
    const proposalReasons = ['public-subject-role-compatible'];
    let corroborated = false;
    if (ordinaryNominal) {
      const semantics = globalThis.GGGHumanPlaytest.semanticClasses(candidate.word, analysis, false);
      corroborated = semantics.some(semantic => ['PERSON', 'ANIMAL', 'ANIMATE'].includes(semantic));
    }
    if (properName) {
      const categories = candidate.properNounBankCategories || [];
      corroborated ||= categories.some(category => ['first-names', 'surnames', 'companies-brands',
        'stores-chains', 'organizations-institutions'].includes(category)) || candidate.nameFamiliarity > 0;
    }
    if (corroborated) {
      admissionLevel = 2;
      proposalReasons.push('public-agent-subject-compatible');
    }
    return { admissionLevel, proposalReasons };
  }

  function stage1BuildClassQueues(candidates, state, targetSlot, proper, dictionary, predicateContext = { active: false }) {
    const index = targetSlot.slotIndex;
    const coordinationContext = isEttinPilotMode()
      ? stage1CoordinationContext(state, targetSlot)
      : { active: false, itemIndices: [], roleFamilies: [], semanticClasses: [] };
    const subjectContext = isEttinPilotMode()
      ? stage1SubjectContext(state, targetSlot)
      : { active: false, type: null, determinerHeaded: false };
    const questionOpening = index === 0 && state.slots.some((slot, slotIndex) => slotIndex >= index && /\?/.test(slot.trailing || ''));
    const previous = index > 0 && state.slots[index - 1]?.solved
      ? getHumanPlaytestAnalysis(globalThis.GGGHumanPlaytest.tokenAt(state.slots[index - 1])) : null;
    const previousRoles = new Set(previous?.roles || []);
    const questionStart = (() => {
      let start = index;
      while (start > 0 && !/[.!?]/.test(state.slots[start - 1]?.trailing || '')) start--;
      return start;
    })();
    let questionEnd = index;
    while (questionEnd < state.slots.length - 1 && !/[.!?]/.test(state.slots[questionEnd]?.trailing || '')) questionEnd++;
    const isQuestion = /\?/.test(state.slots[questionEnd]?.trailing || '');
    const openingInterrogativeSlot = index > 0 && index - 1 === questionStart
      ? state.slots[index - 1] : null;
    const openingInterrogative = openingInterrogativeSlot?.solved
      ? getHumanPlaytestAnalysis(globalThis.GGGHumanPlaytest.tokenAt(openingInterrogativeSlot)) : null;
    const interrogativeRoles = new Set(openingInterrogative?.lexicalRoles || openingInterrogative?.roles || []);
    const possibleSubjectQuestionVerb = Boolean(isQuestion && openingInterrogativeSlot &&
      interrogativeRoles.has('questionWord') && interrogativeRoles.has('subjectPronoun'));
    const followingSlot = index + 1 < state.slots.length ? state.slots[index + 1] : null;
    let followingNominal = false;
    if (possibleSubjectQuestionVerb && followingSlot?.solved && index + 1 === questionEnd) {
      const word = globalThis.GGGHumanPlaytest.tokenAt(followingSlot);
      const ordinaryFollowing = getHumanPlaytestAnalysis(word);
      const ordinaryRoles = new Set(ordinaryFollowing.lexicalRoles || ordinaryFollowing.roles || []);
      const closedFollowing = ['auxiliary', 'pronoun', 'article', 'determiner', 'preposition', 'conjunction']
        .some(role => ordinaryRoles.has(role));
      const knownName = globalThis.GGGHumanPlaytest.nameFamiliarity(word) && !closedFollowing;
      const properNominal = Boolean(followingSlot.letters[0]?.capital &&
        (knownName || (dictionary.isProperWord(word) && !dictionary.isAccepted(word))));
      const followingAnalysis = getHumanPlaytestAnalysis(word, properNominal);
      const followingRoles = new Set([...(followingAnalysis.lexicalRoles || []), ...(followingAnalysis.roles || [])]);
      followingNominal = ['noun', 'properNoun', 'subjectPronoun', 'objectPronoun']
        .some(role => followingRoles.has(role));
    }
    const enriched = candidates.map(candidate => {
      const roles = new Set(candidate.analysis?.lexicalRoles || candidate.analysis?.roles || []), proposalReasons = [];
      const coordination = stage1CoordinationCandidateSupport(candidate, coordinationContext);
      proposalReasons.push(...coordination.proposalReasons);
      const subject = stage1SubjectCandidateSupport(candidate, subjectContext);
      proposalReasons.push(...subject.proposalReasons);
      if (candidate.nameOnlyRestricted || candidate.requiresProperNameAdmission) {
        const authorizedNameRole = candidate.nameOnlyRestricted
          ? candidate.nameOnlyAuthorized : candidate.properNameRoleEligible;
        if (proper.nameSupportAllowed && authorizedNameRole && candidate.properNoun) proposalReasons.push('public-capitalization-name-view');
      } else {
        if (questionOpening && ['questionWord', 'subjectPronoun', 'properNoun', 'noun'].some(role => roles.has(role))) proposalReasons.push('question-opening-compatible');
        if (proper.nameSupportAllowed && candidate.properNoun) proposalReasons.push('public-capitalization-name-view');
        if ([...previousRoles].some(role => ['article', 'determiner', 'possessiveDeterminer'].includes(role)) &&
          ['noun', 'properNoun', 'adjective'].some(role => roles.has(role))) proposalReasons.push('visible-determiner-context');
        if (candidate.lexicalClass === 'public-entity') proposalReasons.push('public-entity');
        const finiteLexicalVerb = roles.has('verb') && roles.has('finiteVerb') &&
          (roles.has('thirdSingular') || roles.has('pastTense'));
        const subjectQuestionSupport = possibleSubjectQuestionVerb && finiteLexicalVerb;
        if (subjectQuestionSupport) proposalReasons.push('public-subject-question-finite-verb');
        const corroboratedObjectFrame = subjectQuestionSupport && followingNominal && candidate.analysis?.transitive === true;
        if (corroboratedObjectFrame) proposalReasons.push('public-subject-question-transitive-object');
      }
      if (predicateContext.active && stage1PredicateCandidateCompatibility(candidate) === 'verbal-compatible') {
        proposalReasons.push('strong-declarative-predicate-verb-slot');
      }
      return { ...candidate, proposalReasons, stage1CoordinationAdmissionLevel: coordination.admissionLevel,
        stage1SubjectAdmissionLevel: subject.admissionLevel,
        stage1ContextualAdmissionLevel: Math.max(coordination.admissionLevel, subject.admissionLevel),
        supportTier: proposalReasons.length ? 'supported' : 'neutral', frequencyKnown: candidate.frequencySource === 'wordfreq-3.1.1-small-en', lexicalClasses: stage1ClassifyCandidate(candidate, proper.nameQueueAllowed) };
    });
    const queues = { supported: {}, neutral: {} }, queueOrder = ['nouns', 'lexical-verbs', 'adjectives', 'adverbs', 'function-words', 'proper-names', 'fallback'];
    const compare = (left, right) => {
      const frequencyDifference = (right.frequencyKnown ? right.zipf : -Infinity) - (left.frequencyKnown ? left.zipf : -Infinity);
      if (frequencyDifference) return frequencyDifference;
      const hashDifference = stage1StableHash(left.normalized) - stage1StableHash(right.normalized);
      return hashDifference || left.normalized.localeCompare(right.normalized, 'en');
    };
    for (const tier of ['supported', 'neutral']) for (const name of queueOrder) {
      const queue = enriched.filter(candidate => candidate.supportTier === tier && candidate.lexicalClasses.includes(name)).sort((left, right) => {
        if (tier === 'supported' && name === 'lexical-verbs') {
          const leftCorroborated = left.proposalReasons.includes('public-subject-question-transitive-object');
          const rightCorroborated = right.proposalReasons.includes('public-subject-question-transitive-object');
          if (leftCorroborated !== rightCorroborated) return leftCorroborated ? -1 : 1;
        }
        return compare(left, right);
      });
      const orderedQueue = name === 'proper-names'
        ? globalThis.GGGProperNounBank.interleaveByAccessCategory(queue, globalThis.GGGHumanPlaytest.boardKey(state), compare)
        : queue;
      if (tier === 'supported') {
        const levels = new Map([[2, []], [1, []], [0, []]]);
        for (const candidate of orderedQueue) {
          const level = candidate.stage1ContextualAdmissionLevel;
          levels.get(levels.has(level) ? level : 0).push(candidate);
        }
        queues[tier][name] = [...levels.get(2), ...levels.get(1), ...levels.get(0)];
      } else queues[tier][name] = orderedQueue;
    }
    return { enriched, queues, tierOrder: ['supported', 'neutral'], queueOrder, compare,
      counts: Object.fromEntries(['supported', 'neutral'].map(tier => [tier, Object.fromEntries(queueOrder.map(name => [name, queues[tier][name].length]))])) };
  }

  // ETTIN consumes the Stage 1 shortlist directly. Keep ordinary and proper
  // readings explicit at that boundary instead of letting one merged spelling
  // imply both roles.
  function stage1RoleEligibility(candidate, proper, authorization) {
    const roles = new Set(candidate.analysis?.lexicalRoles || candidate.analysis?.roles || []);
    const ordinaryRole = ['noun', 'verb', 'baseVerb', 'finiteVerb', 'pastParticiple', 'presentParticiple',
      'adjective', 'adverb', 'article', 'determiner', 'pronoun', 'preposition', 'conjunction', 'auxiliary',
      'questionWord', 'modal', 'negator', 'particle'].some(role => roles.has(role));
    const properRole = authorization.authorized;
    const nameOnlyRestricted = globalThis.vault4Dictionary.isRecognizedNameOnlyRestricted(candidate.word);
    const nameRecognized = authorization.authorized;
    const nameOnlyAuthorized = nameOnlyRestricted && globalThis.vault4Dictionary.canAdmitNameOnlyCandidate(candidate.word, {
      recognizedName: nameRecognized,
      targetPermitsName: proper.nameQueueAllowed,
    });
    const requiresProperNameAdmission = proper.capitalizationState === 'meaningfully-capitalized';
    const authorizationMetadata = {
      properNounAuthorizationSource: authorization.authorizationSource,
      properNounAuthorizationSources: authorization.authorizationSources,
      properNounBankRevision: authorization.bankRevision,
      properNounBankEntryId: authorization.bankEntryId,
      properNounBankCategories: authorization.categories,
      properNounAccessCategory: authorization.accessCategory,
      properNounBankMatchedSurface: candidate.properNounBankMatchedSurface || authorization.matchedSurface,
      properNounBankDisplay: authorization.bankDisplay,
      properNounBank: authorization.authorizationSources.includes('proper-noun-bank'),
      legacyRecognizedName: authorization.authorizationSources.includes('legacy-recognized-name'),
      publicEntity: authorization.authorizationSources.includes('public-entity'),
    };
    if (nameOnlyRestricted) return {
      ordinaryRoleEligible: false,
      properNameRoleEligible: nameOnlyAuthorized,
      roleEligible: nameOnlyAuthorized,
      role: nameOnlyAuthorized ? 'proper-name' : 'name-only-blocked',
      nameOnlyRestricted: true,
      nameRecognized,
      nameOnlyAuthorized,
      requiresProperNameAdmission,
      ...authorizationMetadata,
    };
    const properNameRoleEligible = proper.nameQueueAllowed && properRole;
    const roleEligible = requiresProperNameAdmission
      ? properNameRoleEligible
      : ordinaryRole || properNameRoleEligible;
    const role = requiresProperNameAdmission
      ? (properNameRoleEligible ? 'proper-name' : 'proper-name-required')
      : (proper.nameQueueAllowed ? 'proper-name-or-ordinary' : 'ordinary');
    return { ordinaryRoleEligible: ordinaryRole, properNameRoleEligible,
      roleEligible, role, nameOnlyRestricted: false, nameRecognized, nameOnlyAuthorized: false,
      requiresProperNameAdmission, ...authorizationMetadata };
  }

  function stage1CapitalizationState(state, targetSlotIndex, proper = globalThis.GGGHumanPlaytest.properContext(state)) {
    const slot = state.slots[targetSlotIndex];
    const visiblyCapitalized = Boolean(slot?.letters?.[0]?.capital && slot?.letters?.length > 1);
    if (!visiblyCapitalized) return 'lowercase';
    if (proper.sentenceInitial) return 'sentence-initial';
    return proper.active ? 'meaningfully-capitalized' : 'lowercase';
  }

  function stage1CandidateBlockPolicyProblem(candidate, pool, publicState, submittedWord = candidate?.word) {
    const policy = globalThis.vault4Dictionary;
    if (!candidate?.word || policy.isAbsolutelyBlocked(candidate.word) || policy.isAbsolutelyBlocked(submittedWord)) return 'absolute-block';
    const candidateWord = policy.normalize(candidate.word);
    const submitted = policy.normalize(submittedWord);
    if (!candidateWord || candidateWord !== submitted) return 'candidate-spelling-mismatch';
    const nameOnlyRestricted = policy.isRecognizedNameOnlyRestricted(candidateWord);
    if (!publicState || !pool || !Number.isInteger(pool.targetSlot?.slotIndex)) {
      return nameOnlyRestricted || candidate.requiresProperNameAdmission ? 'name-policy-context-unavailable' : null;
    }
    if (publicState.targetSlotIndex !== pool.targetSlot.slotIndex) return 'target-mismatch';
    if (candidate.publicBoardKey !== globalThis.GGGHumanPlaytest.boardKey(publicState)) return 'stale-board';
    const targetSlotIndex = pool.targetSlot.slotIndex;
    const proper = globalThis.GGGHumanPlaytest.properContext({ ...publicState, targetSlotIndex });
    const expectedSurface = globalThis.GGGHumanPlaytest.surfaceForSlot(
      candidate.orthographicSurface || candidate.submissionSurface || candidate.word,
      publicState.slots[targetSlotIndex],
      proper.sentenceInitial,
    );
    if (!expectedSurface || expectedSurface !== submittedWord) return 'case-pattern-mismatch';
    const capitalizationState = stage1CapitalizationState(publicState, targetSlotIndex, proper);
    const requiresProperNameAdmission = capitalizationState === 'meaningfully-capitalized';
    const publicEntity = Array.isArray(pool.publicEntityWords) && pool.publicEntityWords.includes(candidateWord);
    const authorization = globalThis.GGGProperNounBank.resolveProperNounAuthorization(candidateWord, { publicEntity });
    if (nameOnlyRestricted && !policy.canAdmitNameOnlyCandidate(candidateWord, {
      recognizedName: authorization.authorized,
      targetPermitsName: capitalizationState !== 'lowercase',
    })) return 'name-only-not-authorized';
    if (!nameOnlyRestricted && !requiresProperNameAdmission) return null;

    const admittedPopulation = isEttinPilotMode() ? pool.candidates : (pool.universe || pool.candidates);
    const poolCandidate = admittedPopulation?.find(entry => policy.normalize(entry.word) === candidateWord);
    if (!poolCandidate) return 'proper-name-candidate-not-in-pool';
    const candidateWithAdmission = { ...candidate, ...poolCandidate,
      word: candidate.word, orthographicSurface: poolCandidate.orthographicSurface,
      submissionSurface: candidate.submissionSurface || poolCandidate.submissionSurface,
      publicBoardKey: candidate.publicBoardKey };
    const resolveEntryAuthorization = entry => globalThis.GGGProperNounBank.resolveProperNounAuthorization(entry?.word, {
      publicEntity: Array.isArray(pool.publicEntityWords) && pool.publicEntityWords.includes(policy.normalize(entry?.word)),
    });
    const properNameCandidateIsValid = entry => {
      const classes = entry?.lexicalClasses || (!isEttinPilotMode()
        ? stage1ClassifyCandidate(entry, capitalizationState !== 'lowercase') : null);
      const shortlistClasses = entry?.shortlistClasses;
      const validShortlistClass = Array.isArray(shortlistClasses)
        ? shortlistClasses.length === 1 && shortlistClasses[0] === 'proper-names'
        : !isEttinPilotMode() && Array.isArray(classes) && classes.length === 1 && classes[0] === 'proper-names';
      const currentAuthorization = resolveEntryAuthorization(entry);
      const bankMetadataMatches = currentAuthorization.authorizationSource !== 'proper-noun-bank' ||
        (entry?.properNounBankEntryId === currentAuthorization.bankEntryId &&
          entry?.properNounBankRevision === currentAuthorization.bankRevision &&
          entry?.properNounAccessCategory === currentAuthorization.accessCategory &&
          JSON.stringify(entry?.properNounBankCategories || []) === JSON.stringify(currentAuthorization.categories));
      return currentAuthorization.authorized && bankMetadataMatches &&
        entry?.properNounAuthorizationSource === currentAuthorization.authorizationSource &&
        entry?.properNameRoleEligible === true && entry?.roleEligible === true &&
        entry?.requiresProperNameAdmission === requiresProperNameAdmission && entry?.role === 'proper-name' &&
        Array.isArray(classes) && classes.length === 1 && classes[0] === 'proper-names' && validShortlistClass;
    };
    if (!properNameCandidateIsValid(candidateWithAdmission) || !properNameCandidateIsValid(poolCandidate)) return 'proper-name-admission-invalid';
    if (nameOnlyRestricted && (candidateWithAdmission.nameOnlyRestricted !== true || candidateWithAdmission.nameRecognized !== true ||
        candidateWithAdmission.nameOnlyAuthorized !== true || candidateWithAdmission.ordinaryRoleEligible !== false ||
        poolCandidate.nameOnlyRestricted !== true || poolCandidate.nameRecognized !== true ||
        poolCandidate.nameOnlyAuthorized !== true || poolCandidate.ordinaryRoleEligible !== false)) return 'name-only-admission-invalid';
    return null;
  }

  function stage1MergeClassQueues(classData, limit = 64) {
    const selected = [], seen = new Set();
    const cursors = Object.fromEntries(classData.tierOrder.map(tier => [tier, Object.fromEntries(classData.queueOrder.map(name => [name, 0]))]));
    while (selected.length < limit) {
      let added = false;
      for (const tier of classData.tierOrder) {
        for (const name of classData.queueOrder) {
          const queue = classData.queues[tier][name];
          while (cursors[tier][name] < queue.length && seen.has(queue[cursors[tier][name]].normalized)) cursors[tier][name]++;
          if (cursors[tier][name] >= queue.length) continue;
          const candidate = queue[cursors[tier][name]++];
          if (seen.has(candidate.normalized)) continue;
          seen.add(candidate.normalized);
          selected.push({ ...candidate, shortlistClasses: candidate.lexicalClasses, shortlistIndex: selected.length });
          added = true;
          if (selected.length >= limit) break;
        }
        if (selected.length >= limit) break;
      }
      if (!added) break;
    }
    return selected;
  }

  async function buildHumanPlaytestPool(targetSlot, publicEntities = [], publicBoard = null, includeForensicShortlist = false) {
    if (!targetSlot) return null;
    await globalThis.vault4Ready;
    await globalThis.GGGProperNounBank.ready();
    const frequencies = await loadAiWordFrequency();
    const engine = globalThis.GGGHumanPlaytest;
    await engine.loadResources();
    const state = publicBoard ? { ...publicBoard, targetSlotIndex: targetSlot.slotIndex } : getHumanPlaytestPublicState(targetSlot);
    const proper = engine.properContext(state);
    const capitalizationState = stage1CapitalizationState(state, targetSlot.slotIndex, proper);
    const stage1Proper = { ...proper,
      capitalizationState,
      nameQueueAllowed: capitalizationState !== 'lowercase',
      nameSupportAllowed: capitalizationState === 'meaningfully-capitalized',
    };
    const dictionary = globalThis.vault4Dictionary.dictionary;
    const firstPersonOrthography = new Map([
      ['i', 'I'], ["i'm", "I'm"], ["i've", "I've"], ["i'll", "I'll"], ["i'd", "I'd"],
    ]);
    // Explicit future public-entity input; no image system is connected.
    const entities = publicEntities.filter(e => e && ['public-text', 'image-description'].includes(e.source) && /^[A-Za-z]+$/.test(e.word));
    const names = new Set(entities.map(e => e.word.toLowerCase()));
    const bankForms = stage1Proper.nameQueueAllowed ? globalThis.GGGProperNounBank.candidateForms(targetSlot.length) : [];
    const resourceKey = targetSlot.length + ':' + capitalizationState + ':' +
      globalThis.GGGProperNounBank.revision() + ':' + JSON.stringify(entities);
    const universe = engine.cachedVocabulary(resourceKey, () => {
      const dictionaryWords = globalThis.getVault4Candidates({ usableLengths: [targetSlot.length],
        vault1Words: [], vault2Words: [], vault3Words: [], vault5Words: [], guessedWords: [], includeProperNames: stage1Proper.nameQueueAllowed });
      const sourceLists = [
        { source: 'vault-1', words: [...vault1Words] },
        { source: 'vault-4-public-dictionary', words: dictionaryWords },
        { source: 'human-playtest-language-extras', words: [
          ...engine.extraWords().flatMap(word => {
            const key = word.toLowerCase().replace(/[’‘]/g, "'");
            if (firstPersonOrthography.has(key)) return [firstPersonOrthography.get(key)];
            return engine.nameFamiliarity(word)
              ? [word, word.charAt(0).toUpperCase() + word.slice(1)]
              : [word];
          }),
        ] },
        { source: 'public-entities', words: stage1Proper.nameQueueAllowed ? entities.map(e => e.word) : [] },
        { source: 'proper-noun-bank', words: bankForms },
      ];
      const merged = new Map();
      for (const sourceList of sourceLists) for (const rawEntry of sourceList.words) {
        const bankForm = sourceList.source === 'proper-noun-bank' ? rawEntry : null;
        const rawWord = bankForm?.word || rawEntry;
        const orthographicSurface = String(bankForm?.orthographicSurface || rawWord || '').trim()
          .replace(/[\u2018\u2019\u02bc\uff07]/g, "'")
          .replace(/[\u2010\u2011]/g, "-");
        const word = String(rawWord || '').toLowerCase();
        if (!word) continue;
        const firstPersonSurface = firstPersonOrthography.get(word.replace(/[’‘]/g, "'"));
        if (firstPersonSurface && orthographicSurface !== firstPersonSurface) continue;
        const caseMask = Array.from(orthographicSurface).filter(character => /^[A-Za-z]$/.test(character))
          .map(character => character === character.toLowerCase() ? 'l' : 'U').join('');
        const surfaceKey = `${word}\u0000${caseMask}`;
        const existing = merged.get(surfaceKey);
        if (existing) {
          existing.sources.push(sourceList.source);
          if (bankForm) Object.assign(existing, {
            orthographicSurface: bankForm.orthographicSurface,
            properNounBankEntryId: bankForm.entryId,
            properNounBankCategories: bankForm.categories,
            properNounAccessCategory: bankForm.accessCategory,
            properNounBankMatchedSurface: bankForm.matchedSurface,
            properNounBankDisplay: bankForm.display,
            properNounBankRevision: bankForm.bankRevision,
          });
        } else merged.set(surfaceKey, { word, normalized: word, orthographicSurface, sources: [sourceList.source], ...(bankForm ? {
          properNounBankEntryId: bankForm.entryId,
          properNounBankCategories: bankForm.categories,
          properNounAccessCategory: bankForm.accessCategory,
          properNounBankMatchedSurface: bankForm.matchedSurface,
          properNounBankDisplay: bankForm.display,
          properNounBankRevision: bankForm.bankRevision,
        } : {}) });
      }
      if (isEttinPilotMode()) logEttinPilot('ettin-vocabulary-sources', targetSlot, { resourceKey, properContext: proper,
        orderedSources: sourceLists.map(sourceList => ({ source: sourceList.source, count: sourceList.words.length })) });
      return globalThis.vault4Dictionary.filterAbsolutelyBlockedCandidates([...merged.values()])
        .filter(candidate => engine.tokenLetters(candidate.word).length === targetSlot.length).map(candidate => {
        const word = candidate.word;
        const zipf = frequencies.get(word) ?? 2.5;
        const publicEntity = names.has(word) && candidate.sources.includes('public-entities');
        const authorization = globalThis.GGGProperNounBank.resolveProperNounAuthorization(word, { publicEntity });
        let lexicalClass = engine.lexicalClass(word, dictionary, zipf, publicEntity);
        if (!lexicalClass && stage1Proper.nameQueueAllowed && authorization.authorized) {
          lexicalClass = authorization.authorizationSource === 'proper-noun-bank' ? 'proper-noun-bank' :
            authorization.authorizationSource === 'legacy-recognized-name' ? 'given-name' : 'public-entity';
        }
        if (!lexicalClass || (!stage1Proper.nameQueueAllowed && ['given-name','dictionary-capitalized'].includes(lexicalClass))) return null;
        if (isSituationPilotMode() && ['wanna','gonna','gotta'].includes(word)) return null;
        // Dictionary capitalization alone is not name evidence. Preserve
        // dual-role spellings only when ordinary lexical support classified
        // them independently, while name metadata carries the proper role.
        const properNoun = authorization.authorized;
        const analysis = getHumanPlaytestAnalysis(word, properNoun);
        const enriched = { ...candidate, properNoun, lexicalClass, nameFamiliarity: engine.nameFamiliarity(word), commonWord: dictionary.isAccepted(word), zipf,
          frequencySource: frequencies.has(word) ? 'wordfreq-3.1.1-small-en' : 'fallback-floor', analysis };
        return { ...enriched, ...stage1RoleEligibility(enriched, stage1Proper, authorization) };
      }).filter(candidate => candidate && (!candidate.nameOnlyRestricted || candidate.nameOnlyAuthorized));
    });
    const rejected = new Set(state.rejectedWordsBySlot[targetSlot.slotIndex] || []);
    const targetPublicSlot = state.slots[targetSlot.slotIndex];
    const caseValidByWord = new Map();
    for (const candidate of universe) {
      const submissionSurface = engine.surfaceForSlot(candidate.orthographicSurface, targetPublicSlot, proper.sentenceInitial);
      if (!submissionSurface) continue;
      const admitted = { ...candidate, submissionSurface };
      const previous = caseValidByWord.get(candidate.normalized);
      const isExactSourceSurface = candidate.orthographicSurface === submissionSurface;
      const previousIsExactSourceSurface = previous?.orthographicSurface === previous?.submissionSurface;
      if (!previous || (isExactSourceSurface && !previousIsExactSourceSurface)) caseValidByWord.set(candidate.normalized, admitted);
    }
    const caseValidUniverse = [...caseValidByWord.values()];
    const hardCandidates = caseValidUniverse.filter(candidate => candidate.roleEligible &&
      isSafelySubmittableAiCandidate(candidate.submissionSurface, targetSlot.length) &&
      engine.matchesToken(candidate.word, targetPublicSlot) && !rejected.has(candidate.normalized));
    const predicateContext = isEttinPilotMode() ? stage1PredicateContext(state, targetSlot) : { active: false, type: null };
    let contextualCandidates = hardCandidates;
    let predicateContextFallback = false, predicateContextFallbackReason = null;
    let predicateContextExcludedNonverbalCount = 0;
    if (predicateContext.active) {
      contextualCandidates = hardCandidates.filter(candidate => {
        const compatibility = stage1PredicateCandidateCompatibility(candidate);
        if (compatibility === 'clearly-nonverbal') {
          predicateContextExcludedNonverbalCount++;
          return false;
        }
        return true;
      });
      if (!contextualCandidates.length) {
        contextualCandidates = hardCandidates;
        predicateContextFallback = true;
        predicateContextFallbackReason = 'predicate-filter-left-no-candidates';
      }
    }
    const shortlistContext = predicateContextFallback ? { active: false, type: null } : predicateContext;
    const classData = stage1BuildClassQueues(contextualCandidates, state, targetSlot, stage1Proper, dictionary, shortlistContext);
    const shortlist = contextualCandidates.length <= 64 ? classData.enriched.map((candidate, shortlistIndex) => ({
      ...candidate, shortlistClasses: candidate.lexicalClasses, shortlistIndex,
    })) : stage1MergeClassQueues(classData, 64);
    let contextualAccess = null;
    if (includeForensicShortlist &&
        (ETTIN_CONTEXTUAL_ACCESS_ENABLED || ETTIN_PERSON_ACCESS_ENABLED || ENTITY_TYPE_ACCESS_ENABLED)) {
      const construction = buildEttinConstructionContext(state, engine, dictionary);
      contextualAccess = { classData, construction,
        meaningfullyCapitalized: stage1Proper.capitalizationState === 'meaningfully-capitalized',
        entityTypeContext: ENTITY_TYPE_ACCESS_ENABLED
          ? entityTypeContextForTarget(state, targetSlot, construction, engine)
          : { confidence: 'NONE', hypotheses: [], evidence: [] } };
    }
    const byWord = new Map(shortlist.map(candidate => [candidate.normalized, candidate]));
    const candidates = contextualCandidates.filter(candidate => byWord.has(candidate.normalized)).map(candidate => ({
      ...candidate, ...byWord.get(candidate.normalized), shortlistSources: candidate.sources,
    })).sort((left, right) => left.shortlistIndex - right.shortlistIndex);
    const preparation = { universeCount: universe.length, hardCandidateCount: hardCandidates.length,
      predicateContextDetected: predicateContext.active, predicateContextType: predicateContext.type,
      predicateContextExcludedNonverbalCount, predicateContextFallback,
      predicateContextFallbackReason,
      classes: classData.counts, supportedCount: classData.enriched.filter(candidate => candidate.supportTier === 'supported').length,
      neutralCount: classData.enriched.filter(candidate => candidate.supportTier === 'neutral').length, shortlistCount: candidates.length,
      shortlist: candidates.map(candidate => ({ word: candidate.word, sources: candidate.sources, classes: candidate.shortlistClasses,
        supportTier: candidate.supportTier, proposalReasons: candidate.proposalReasons, lexicalClass: candidate.lexicalClass, zipf: candidate.zipf,
        properNounBankRevision: candidate.properNounBankRevision, properNounBankEntryId: candidate.properNounBankEntryId,
        properNounBankCategories: candidate.properNounBankCategories, properNounAccessCategory: candidate.properNounAccessCategory,
        properNounAuthorizationSource: candidate.properNounAuthorizationSource,
        properNounAuthorizationSources: candidate.properNounAuthorizationSources,
        properNounBank: candidate.properNounBank, legacyRecognizedName: candidate.legacyRecognizedName,
        publicEntity: candidate.publicEntity })),
      classQueues: Object.fromEntries(classData.tierOrder.map(tier => [tier,
        Object.fromEntries(classData.queueOrder.map(name => [name, classData.queues[tier][name].map(candidate => candidate.word)]))])) };
    if (isEttinPilotMode()) {
      const forensicPreparation = includeForensicShortlist ? {
        universeCount: preparation.universeCount, hardCandidateCount: preparation.hardCandidateCount,
        predicateContextDetected: preparation.predicateContextDetected, predicateContextType: preparation.predicateContextType,
        predicateContextExcludedNonverbalCount: preparation.predicateContextExcludedNonverbalCount,
        predicateContextFallback: preparation.predicateContextFallback,
        predicateContextFallbackReason: preparation.predicateContextFallbackReason,
        classes: preparation.classes, supportedCount: preparation.supportedCount, neutralCount: preparation.neutralCount,
        shortlistCount: preparation.shortlistCount, shortlist: preparation.shortlist,
      } : {
        universeCount: preparation.universeCount, hardCandidateCount: preparation.hardCandidateCount,
        predicateContextDetected: preparation.predicateContextDetected, predicateContextType: preparation.predicateContextType,
        predicateContextExcludedNonverbalCount: preparation.predicateContextExcludedNonverbalCount,
        predicateContextFallback: preparation.predicateContextFallback,
        predicateContextFallbackReason: preparation.predicateContextFallbackReason,
        classes: preparation.classes, supportedCount: preparation.supportedCount, neutralCount: preparation.neutralCount,
        shortlistCount: preparation.shortlistCount,
      };
      logEttinPilot('stage1-candidate-prepared', targetSlot, { resourceKey, preparation: forensicPreparation,
        selectedTarget: includeForensicShortlist });
    }
    return { predictionMode: 'human-playtest', targetLength: targetSlot.length, vocabulary: candidates, universe: caseValidUniverse, hardCandidates, resourceKey, frequencies,
      targetSlot: { group: targetSlot.group, slotIndex: targetSlot.slotIndex, length: targetSlot.length }, candidates, preparation,
      publicEntityWords: entities.map(entity => globalThis.GGGProperNounBank.normalize(entity.word)), ...(contextualAccess ? { contextualAccess } : {}) };
  }

  function rankHumanPlaytestPool(pool, publicBoard = null) {
    if (pool?.predictionMode !== 'human-playtest' || pool.targetSlot.group.classList.contains('revealed')) return null;
    const engine = globalThis.GGGHumanPlaytest;
    const state = publicBoard ? { ...publicBoard, targetSlotIndex: pool.targetSlot.slotIndex } : getHumanPlaytestPublicState(pool.targetSlot);
    const dictionary = globalThis.vault4Dictionary.dictionary;
    const visibleAnalyses = state.slots.map((slot, index) => {
      if (!slot.solved) return null;
      const word = engine.tokenAt(slot);
      const ordinary = getHumanPlaytestAnalysis(word);
      const initial = index === 0 || /[.!?]/.test(state.slots[index - 1].trailing);
      const closed = ordinary.roles.some(r => ['auxiliary','pronoun','article','determiner','preposition','conjunction'].includes(r));
      const knownName = engine.nameFamiliarity(word) && (!initial || !closed);
      return getHumanPlaytestAnalysis(word, Boolean(slot.letters[0]?.capital && (knownName || (dictionary.isProperWord(word) && !dictionary.isAccepted(word)))));
    });
    const provider = getHumanCandidateProvider();
    const lexical = word => {
      const zipf = pool.frequencies?.get(word) ?? 2.5;
      const lexicalClass = engine.lexicalClass(word, dictionary, zipf);
      if (!lexicalClass) return null;
      const surfaceEntry = pool.universe?.find(candidate => candidate.normalized === word);
      const properNoun = !!(engine.properContext(state).active && engine.nameFamiliarity(word));
      return { ...(surfaceEntry || {}), word, normalized: word, zipf, lexicalClass, properNoun,
        nameFamiliarity: engine.nameFamiliarity(word), analysis: getHumanPlaytestAnalysis(word, properNoun) };
    };
    const rankingVocabulary = pool.universe || pool.vocabulary;
    const assess = () => provider.rank({ state, lexical, candidates: rankingVocabulary
      ? engine.retrieve(rankingVocabulary, state.slots[state.targetSlotIndex], state.rejectedWordsBySlot[state.targetSlotIndex], pool.resourceKey)
      : pool.candidates, visibleAnalyses, vocabularyCount: rankingVocabulary?.length || pool.candidates.length });
    const key = (provider.version || engine.POLICY.version) + ':' + engine.evidenceKey(state) + ':' + JSON.stringify(state.rejectedWordsBySlot[state.targetSlotIndex]) + ':' + pool.resourceKey;
    return { ...(pool.resourceKey && !isSituationPilotMode() ? engine.cachedRank(key, assess) : assess()), state };
  }

  async function buildHumanPlaytestTurnPool(initialSlot) {
    await globalThis.vault4Ready;
    await loadAiWordFrequency();
    const engine = globalThis.GGGHumanPlaytest, board = getHumanPlaytestPublicState(initialSlot);
    const opportunities = [], pools = new Map();
    for (const slot of getEligibleAiSlots()) {
      const pool = await buildHumanPlaytestPool(slot, [], board);
      const ranking = rankHumanPlaytestPool(pool, board);
      if (!ranking) continue;
      pools.set(slot.slotIndex, pool);
      opportunities.push({ slotIndex: slot.slotIndex, pattern: ranking.pattern, ...getHumanCandidateProvider().opportunity(ranking) });
    }
    const seed = globalThis.crypto?.getRandomValues
      ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 4294967296);
    const choice = engine.chooseSlot(opportunities, seed);
    if (!choice.selected) return null;
    const pool = pools.get(choice.selected.slotIndex);
    pool.opportunityLog = choice.sorted.slice(0, 6);
    pool.slotRandom = { seed, value: choice.value, algorithm: 'lcg32-one-step' };
    pool.boardKey = engine.boardKey(board);
    return pool;
  }

  function loadAiWordFrequency() {
    if (!aiFrequencyPromise) aiFrequencyPromise = fetch("assets/language/english-frequency.json")
      .then(response => {
        if (!response.ok) throw new Error("Maximum-mode word frequency could not be loaded.");
        return response.json();
      }).then(data => {
        if (data.format !== "ggg-frequency-v1" || data.source !== "wordfreq-3.1.1-small-en" || !Array.isArray(data.bins)) {
          throw new Error("Invalid maximum-mode word frequency format.");
        }
        const frequencies = new Map();
        for (const [zipf100, words] of data.bins) {
          if (!Number.isInteger(zipf100) || zipf100 < 300 || zipf100 > 800 || typeof words !== "string") {
            throw new Error("Invalid maximum-mode word frequency bin.");
          }
          for (const word of words.split(" ")) {
            if (!/^[a-z]+$/.test(word) || frequencies.has(word)) throw new Error("Invalid frequency word.");
            frequencies.set(word, zipf100 / 100);
          }
        }
        if (frequencies.size !== data.wordCount || !frequencies.size) throw new Error("Invalid frequency count.");
        return frequencies;
      });
    return aiFrequencyPromise;
  }

  function getAiFrequencyEvidence(word, frequencies) {
    const normalized = String(word).toLowerCase();
    const found = frequencies.has(normalized);
    // Small wordfreq has a Zipf=3 cutoff. Missing/rare words keep a positive
    // floor; frequency never determines legality. Compress and bound the
    // logarithmic prior to 1..32 so strong grammar can override commonness.
    const zipf = found ? frequencies.get(normalized) : 3;
    return { kind: "word-frequency", source: "wordfreq-3.1.1-small-en", found, zipf,
      applied: 2 ** (Math.max(3, Math.min(8, zipf)) - 3) };
  }

  function getEligibleAiSlots() {
    return Array.from(document.querySelectorAll(".word-group"))
      .map((group, slotIndex) => ({
        group,
        slotIndex,
        length: group.querySelectorAll(".letter-block").length,
        solved: group.classList.contains("revealed"),
        location: group.dataset.wordLocation || "",
        ...(isHumanPlaytestMode() || isAiMaximumAccuracyMode() ? {} : { answer: getActualWord(group) }),
      }))
      .filter((slot) => slot.length > 0 && !slot.solved);
  }

  function getUsableWordLengthProfile(guessNumber) {
    const wordLength = aiLogicSettings?.wordLength;
    const early = wordLength?.early;
    const later = wordLength?.later;
    const validGuessNumber = Number.isInteger(guessNumber) && guessNumber > 0;
    const validRangeStart = (value) => Number.isInteger(value) && value > 0;
    const validProfile = (profile, requireEnd) => {
      if (!profile || !validRangeStart(profile.fromGuess)) return false;
      if (requireEnd && !validRangeStart(profile.toGuess)) return false;
      if (requireEnd && profile.fromGuess > profile.toGuess) return false;
      if (!Array.isArray(profile.ranges) || profile.ranges.length === 0) return false;
      let previousMax = 0;
      return profile.ranges.every((range) => {
        if (!validRangeStart(range.minLength)) return false;
        if (range.maxLength !== undefined && (!validRangeStart(range.maxLength) || range.minLength > range.maxLength)) return false;
        if (range.minLength <= previousMax) return false;
        previousMax = range.maxLength ?? Number.POSITIVE_INFINITY;
        return Number.isFinite(range.chance) && range.chance >= 0 && range.chance <= 100;
      }) && profile.ranges.reduce((total, range) => total + range.chance, 0) === 100;
    };
    if (!validGuessNumber || !validProfile(early, true) || !validProfile(later, false)) return null;
    if (guessNumber >= later.fromGuess) return later;
    if (guessNumber >= early.fromGuess && guessNumber <= early.toGuess) return early;
    return null;
  }

  function chooseAiTargetSlot() {
    const eligibleSlots = getEligibleAiSlots();
    if (eligibleSlots.length === 0) return null;
    // Public-only provisional lock; Upgrade 1 compares all opportunities below.
    if (isHumanPlaytestMode()) return eligibleSlots[0];
    // The async maximum-mode path compares legal candidate distributions for
    // every slot. This provisional target only establishes the existing lock.
    if (isAiMaximumAccuracyMode()) return eligibleSlots[0];
    const profile = getUsableWordLengthProfile(aiGuessNumber);
    if (!profile) {
      console.debug("AI word-length settings are invalid; using unbiased slot selection.");
      return eligibleSlots[Math.floor(Math.random() * eligibleSlots.length)];
    }
    const availableRanges = profile.ranges.map((range) => ({
      range,
      slots: eligibleSlots.filter((slot) => (
        slot.length >= range.minLength &&
        (range.maxLength === undefined || slot.length <= range.maxLength)
      )),
    })).filter((entry) => entry.slots.length > 0);
    if (availableRanges.length === 0) {
      console.debug("AI word-length settings have no available ranges; using unbiased slot selection.");
      return eligibleSlots[Math.floor(Math.random() * eligibleSlots.length)];
    }
    const selectedEntry = chooseAiTimingRange(availableRanges.map(({ range }) => range));
    if (!selectedEntry) {
      console.debug("AI word-length settings have no usable probability weight; using unbiased slot selection.");
      return eligibleSlots[Math.floor(Math.random() * eligibleSlots.length)];
    }
    const matchingEntry = availableRanges.find((entry) => entry.range === selectedEntry) || availableRanges[0];
    const earlyProfile = aiLogicSettings?.wordLength?.early;
    const isEarlyGuess = Boolean(
      earlyProfile &&
      aiGuessNumber >= earlyProfile.fromGuess &&
      aiGuessNumber <= earlyProfile.toGuess,
    );
    return chooseSentenceAwareAiSlot(matchingEntry.slots, isEarlyGuess);
  }

  function isFirstUnsolvedWordInSentence(group, groups, targetIndex) {
    let sentenceStart = targetIndex;
    while (sentenceStart > 0 && !endsAiSentence(groups[sentenceStart - 1])) {
      sentenceStart -= 1;
    }
    for (let index = sentenceStart; index < targetIndex; index += 1) {
      if (
        !groups[index].classList.contains("revealed") &&
        groups[index].querySelectorAll(".letter-block").length > 0
      ) return false;
    }
    return true;
  }

  function getAiSlotSelectionWeight(slot, isEarlyGuess, groups) {
    const targetIndex = groups.indexOf(slot.group);
    if (targetIndex < 0) return AI_SLOT_SELECTION_WEIGHTS.base;
    const sentenceInitial = targetIndex === 0 || endsAiSentence(groups[targetIndex - 1]);
    const firstUnsolved = isFirstUnsolvedWordInSentence(slot.group, groups, targetIndex);
    let weight = AI_SLOT_SELECTION_WEIGHTS.base;
    if (isEarlyGuess && slot.length <= 3) weight *= AI_SLOT_SELECTION_WEIGHTS.earlyShortSlot;
    if (firstUnsolved && slot.length <= 3) {
      weight *= isEarlyGuess
        ? AI_SLOT_SELECTION_WEIGHTS.earlyFirstUnsolvedShort
        : AI_SLOT_SELECTION_WEIGHTS.laterFirstUnsolvedShort;
    } else if (firstUnsolved && slot.length >= 4 && slot.length <= 5) {
      weight *= isEarlyGuess
        ? AI_SLOT_SELECTION_WEIGHTS.earlyFirstUnsolvedMedium
        : AI_SLOT_SELECTION_WEIGHTS.laterFirstUnsolvedMedium;
    }
    // Sentence-initial status is an additional signal, without exposing or
    // inspecting the hidden answer.
    if (sentenceInitial && slot.length <= 3 && !firstUnsolved) {
      weight *= isEarlyGuess
        ? AI_SLOT_SELECTION_WEIGHTS.earlyFirstUnsolvedShort
        : AI_SLOT_SELECTION_WEIGHTS.laterFirstUnsolvedShort;
    }
    return weight;
  }

  function chooseSentenceAwareAiSlot(slots, isEarlyGuess) {
    if (!Array.isArray(slots) || slots.length === 0) return null;
    const groups = Array.from(document.querySelectorAll(".word-group"));
    const weighted = slots.map((slot) => ({
      slot,
      weight: getAiSlotSelectionWeight(slot, isEarlyGuess, groups) * (
        AI_SLOT_SELECTION_WEIGHTS.noiseMin +
        Math.random() * (AI_SLOT_SELECTION_WEIGHTS.noiseMax - AI_SLOT_SELECTION_WEIGHTS.noiseMin)
      ),
    }));
    const totalWeight = weighted.reduce((total, entry) => total + entry.weight, 0);
    if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
      return slots[Math.floor(Math.random() * slots.length)];
    }
    let roll = Math.random() * totalWeight;
    for (const entry of weighted) {
      roll -= entry.weight;
      if (roll < 0) return entry.slot;
    }
    return weighted[weighted.length - 1].slot;
  }

  function normalizeAiCandidate(word) {
    const value = String(word ?? "").trim();
    return isHumanPlaytestMode() || isAiMaximumAccuracyMode() || aiLogicSettings?.rules?.noCaseMistakes ? value.toLocaleLowerCase() : value;
  }

  function normalizeAiAnswer(word) {
    return normalizeAiCandidate(word).replace(/[’']/g, "");
  }

  function isUsableAiCandidate(word, targetLength) {
    if (typeof word !== "string") return false;
    const value = word.trim();
    if (!value || !/^[A-Za-z]+(?:['’][A-Za-z]+)*$/.test(value)) return false;
    return Array.from(value).filter((character) => /^[A-Za-z]$/.test(character)).length === targetLength;
  }

  // The existing puzzle submission pipeline only safely renders plain alphabetic
  // words. Reject contractions during pool construction and again at submission.
  function isSafelySubmittableAiCandidate(word, targetLength) {
    if (isHumanPlaytestMode()) return /^[A-Za-z]+(?:['’-][A-Za-z]+)*$/.test(String(word)) && globalThis.GGGHumanPlaytest.tokenLetters(word).length === targetLength;
    if (!isUsableAiCandidate(word, targetLength)) return false;
    return /^[A-Za-z]+$/.test(String(word).trim());
  }

  function matchesAiRevealedLetters(word, targetSlot) {
    if (isHumanPlaytestMode()) return globalThis.GGGHumanPlaytest.matchesToken(word, getHumanPlaytestPublicState(targetSlot).slots[targetSlot.slotIndex]);
    const letters = String(word).toLowerCase();
    return Array.from(targetSlot.group.querySelectorAll(".letter-block")).every((block, index) => (
      !isBlockRevealed(block) || letters[index] === block.textContent.toLowerCase()
    ));
  }

  function applyAiTargetCapitalization(word, targetSlot) {
    const displayWord = String(word ?? "").trim();
    if ((!isHumanPlaytestMode() && !isAiMaximumAccuracyMode() && aiLogicSettings?.rules?.noCaseMistakes !== true) || !targetSlot?.group) {
      return displayWord;
    }

    const blocks = Array.from(targetSlot.group.querySelectorAll(".letter-block"));
    let letterIndex = 0;
    return Array.from(displayWord).map((character) => {
      if (!/^[A-Za-z]$/.test(character)) return character;
      return blocks[letterIndex++]?.classList.contains("capital-letter")
        ? character.toUpperCase()
        : character.toLowerCase();
    }).join("");
  }

  function addAiCandidate(candidateMap, word, source, targetLength, rejectedWordSet) {
    if (!isUsableAiCandidate(word, targetLength)) return;
    const displayWord = word.trim();
    const normalized = normalizeAiCandidate(displayWord);
    if (!normalized || rejectedWordSet.has(normalized)) return;
    const existing = candidateMap.get(normalized);
    if (existing) {
      if (!existing.sources.includes(source)) existing.sources.push(source);
      return;
    }
    candidateMap.set(normalized, { word: displayWord, normalized, sources: [source] });
  }

  async function buildAiCandidatePool(targetSlot) {
    if (isHumanPlaytestMode()) return buildHumanPlaytestPool(targetSlot);
    if (!targetSlot) return null;
    const maximum = isAiMaximumAccuracyMode();
    const puzzleSource = maximum ? null : puzzleList[currentPuzzleIndex];
    const puzzleNumber = typeof puzzleSource === "string"
      ? Number(puzzleSource.match(/puzzle-(\d+)/)?.[1] || currentPuzzleIndex + 1)
      : maximum ? null : Number(puzzleSource?.number || currentPuzzleIndex + 1);
    const targetLength = targetSlot.length;
    const actualAnswer = maximum ? null : normalizeAiAnswer(targetSlot.answer);
    const rejectedWordSets = aiLogicSettings?.rules?.allowSameWordDifferentSlot === false
      ? Array.from(wrongAiGuessesBySlot.values())
      : [wrongAiGuessesBySlot.get(String(targetSlot.slotIndex)) || new Set()];
    const rejectedWordSet = new Set(
      rejectedWordSets.flatMap((words) => Array.from(words).map((word) => normalizeAiCandidate(word))),
    );
    const candidateMap = new Map();
    // Vaults 3/5 are authored with correct answers explicitly excluded. Their
    // membership is answer-derived too, so maximum mode uses global sources.
    const contentWords = maximum ? [] : (vault3ByPuzzle[String(puzzleNumber)] || []);
    const properWords = maximum ? [] : (vault5ByPuzzle[String(puzzleNumber)] || []);
    const sourceWords = [
      ...vault1Words.map((word) => ({ word, source: 1 })),
      ...(Array.isArray(contentWords) ? contentWords : []).map((word) => ({ word, source: 3 })),
      ...(Array.isArray(properWords) ? properWords : []).map((word) => ({ word, source: 5 })),
    ];

    const addCandidate = (word, source) => {
      if (!isSafelySubmittableAiCandidate(word, targetLength)) return;
      addAiCandidate(candidateMap, word, source, targetLength, rejectedWordSet);
    };
    // Vault 2 supplies only this slot's answer. Other hidden puzzle answers
    // receive no special status; they may occur naturally in ordinary sources.
    if (!maximum) addCandidate(targetSlot.answer, 2);
    sourceWords.forEach(({ word, source }) => addCandidate(word, source));

    if (!globalThis.vault4Ready || !globalThis.getVault4Candidates) {
      throw new Error("Vault 4 candidate source is unavailable.");
    }
    await globalThis.vault4Ready;
    const frequencies = maximum ? await loadAiWordFrequency() : null;
    const includeProperNames = maximum && Boolean(targetSlot.group.querySelectorAll(".letter-block")[0]?.classList.contains("capital-letter"));
    const vault4Words = globalThis.getVault4Candidates({
      usableLengths: [targetLength],
      vault1Words,
      vault2Words: [],
      vault3Words: contentWords,
      vault5Words: properWords,
      guessedWords: Array.from(wrongAiGuessesBySlot.get(String(targetSlot.slotIndex)) || []),
      includeProperNames,
    });
    vault4Words.forEach((word) => addCandidate(word, 4));

    const allCandidates = [...candidateMap.values()];
    const sourceCounts = Object.fromEntries(Object.keys(INCORRECT_SOURCE_WEIGHTS).map(source => [
      source, allCandidates.filter(candidate => candidate.sources.includes(Number(source))).length,
    ]));
    // Divide each source's prior across its words so the large dictionary does
    // not swamp classroom vocabulary. Grammar then competes across sources.
    // Count before visible-letter filtering: a revealing hint is evidence,
    // not a reason to replenish the mass of an implausible source.
    allCandidates.forEach(candidate => {
      const hasCuratedNonFallbackSource = candidate.sources.some(source => [1, 3, 5].includes(source));
      candidate.sourcePrior = candidate.sources.reduce((total, source) => {
        // Vault 2 must not stack an answer-specific bonus on top of an
        // ordinary Vault 1/3/5 membership. Its bounded prior is only used
        // when Vault 4 is the candidate's other source.
        if (source === 2) return total + (hasCuratedNonFallbackSource ? 0 : VAULT_2_NEUTRAL_SOURCE_PRIOR);
        return total + (INCORRECT_SOURCE_WEIGHTS[source] || 0) / (sourceCounts[source] || 1);
      }, 0);
      if (candidate.sourcePrior === 0) candidate.sourcePrior = 5 / ((sourceCounts[4] || 0) + 1);
      if (maximum) {
        candidate.properNoun = includeProperNames && globalThis.vault4Dictionary.dictionary.isProperWord(candidate.word);
        // One lexical prior replaces source-budget allocation in maximum mode.
        // The raw source value is diagnostic only, never multiplied in again.
        candidate.priorEvidence = { ...getAiFrequencyEvidence(candidate.word, frequencies), raw: candidate.sourcePrior };
        candidate.sourcePrior = candidate.priorEvidence.applied;
      }
    });
    const candidates = allCandidates.filter(candidate => matchesAiRevealedLetters(candidate.word, targetSlot));
    if (maximum) {
      // Do not even retain an answer-bearing target object inside a fair pool.
      return { predictionMode: "maximum-accuracy", targetLength,
        targetSlot: { group: targetSlot.group, slotIndex: targetSlot.slotIndex, length: targetLength }, candidates };
    }
    const correctCandidates = candidates.filter(candidate => normalizeAiAnswer(candidate.word) === actualAnswer);
    const incorrectCandidates = candidates.filter(candidate => normalizeAiAnswer(candidate.word) !== actualAnswer);
    return {
      puzzleNumber,
      targetSlot,
      targetLength,
      actualAnswer: targetSlot.answer,
      candidates,
      correctCandidates,
      incorrectCandidates,
      incorrectCandidatesBySource: Object.fromEntries(
        Object.keys(INCORRECT_SOURCE_WEIGHTS).map(source => [source,
          incorrectCandidates.filter(candidate => candidate.sources.includes(Number(source))),
        ]),
      ),
    };
  }

  function getCorrectGuessChance(guessNumber) {
    if (!Number.isInteger(guessNumber) || guessNumber < 1) return null;
    const correctGuess = aiLogicSettings?.correctGuess;
    const continuation = correctGuess?.continuation;
    if (
      !continuation ||
      !Number.isInteger(continuation.fromGuess) ||
      !Number.isFinite(continuation.chance) ||
      continuation.chance < 0 ||
      continuation.chance > 100
    ) return null;
    if (guessNumber >= continuation.fromGuess) return continuation.chance;
    const entry = Array.isArray(correctGuess.entries)
      ? correctGuess.entries.find((candidate) => candidate?.fromGuess === guessNumber)
      : null;
    if (!entry || !Number.isFinite(entry.chance) || entry.chance < 0 || entry.chance > 100) return null;
    return entry.chance;
  }

  function getRevealedGrammarWord(group) {
    if (!group?.classList.contains("revealed")) return "";
    return Array.from(group.querySelectorAll(".letter-block"))
      .map((block) => block.textContent || "")
      .join("")
      .toLocaleLowerCase();
  }

  function getTrailingPunctuation(group) {
    const blocks = group?.querySelectorAll(".letter-block");
    return blocks?.[blocks.length - 1]?.dataset.trailing || "";
  }

  function endsAiSentence(group) {
    return /[.!?]/.test(getTrailingPunctuation(group));
  }

  function getNearbyGrammarWord(groups, startIndex, direction) {
    const index = startIndex + direction;
    if (index < 0 || index >= groups.length) return "";
    if (direction < 0 && endsAiSentence(groups[index])) return "";
    // Adjacency rules must not jump across an unsolved intervening word.
    return getRevealedGrammarWord(groups[index]);
  }

  function analyzeAiWord(input) {
    const candidate = typeof input === "string" ? { word: input } : (input || {});
    const text = String(candidate.word || "").trim();
    const word = text.toLocaleLowerCase();
    const known = AI_LEXICON.get(word);
    const roles = new Set(known?.roles || []);
    // Capitalization does not turn known "Sad"/"She" into proper nouns.
    // No target-answer characters or hidden target capitalization are read here.
    const dictionaryName = isAiMaximumAccuracyMode() && (candidate.properNoun ||
      (/^[A-Z]/.test(text) && globalThis.vault4Dictionary?.dictionary.ready && globalThis.vault4Dictionary.dictionary.isProperWord(text)));
    if (dictionaryName || candidate.sources?.includes(5) || (!known && /^[A-Z]/.test(text))) {
      roles.add("properNoun");
      roles.add("noun");
    }
    return { word, roles, lemmas: [...(known?.lemmas || [])], known: Boolean(known) };
  }

  function classifyAiCandidateWord(candidate) {
    return analyzeAiWord(candidate).roles;
  }

  function classifyVisibleAiWord(word) {
    return analyzeAiWord(word).roles;
  }

  function getAiGrammarContext(targetSlot) {
    const groups = Array.from(document.querySelectorAll(".word-group"));
    const targetIndex = groups.indexOf(targetSlot?.group);
    if (targetIndex < 0) return { previousWord: "", nextWord: "", visibleBefore: [], visibleAfter: [] };
    let start = targetIndex;
    let end = targetIndex;
    while (start > 0 && !endsAiSentence(groups[start - 1])) start--;
    while (end < groups.length - 1 && !endsAiSentence(groups[end])) end++;
    // Commas/semicolons/colons conservatively bound propagation, but are not
    // promoted to sentence starts or independent questions.
    let clauseStart = targetIndex;
    let clauseEnd = targetIndex;
    while (clauseStart > start && !/[,;:]/.test(getTrailingPunctuation(groups[clauseStart - 1]))) clauseStart--;
    while (clauseEnd < end && !/[,;:]/.test(getTrailingPunctuation(groups[clauseEnd]))) clauseEnd++;
    const visibleBefore = [];
    const visibleAfter = [];
    for (let index = clauseStart; index <= clauseEnd; index++) {
      if (index === targetIndex || !groups[index].classList.contains("revealed")) continue;
      const text = Array.from(groups[index].querySelectorAll(".letter-block")).map(block => block.textContent || "").join("");
      if (!text) continue;
      const entry = { word: text.toLocaleLowerCase(), text, distance: Math.abs(index - targetIndex), index };
      (index < targetIndex ? visibleBefore : visibleAfter).push(entry);
    }
    visibleBefore.sort((a, b) => b.index - a.index);
    const visibleSentenceWords = [...visibleBefore, ...visibleAfter].sort((a, b) => a.index - b.index);
    const first = visibleSentenceWords.find(entry => entry.index === start);
    const second = visibleSentenceWords.find(entry => entry.index === start + 1);
    const firstRoles = classifyVisibleAiWord(first?.text);
    const secondRoles = classifyVisibleAiWord(second?.text);
    const questionSentence = getTrailingPunctuation(groups[end]).includes("?");
    const inverted = firstRoles.has("auxiliary") &&
      (secondRoles.has("subjectPronoun") || secondRoles.has("properNoun"));
    return {
      previousWord: visibleBefore.find(entry => entry.distance === 1)?.word || "",
      nextWord: visibleAfter.find(entry => entry.distance === 1)?.word || "",
      visibleBefore, visibleAfter, visibleSentenceWords,
      sentenceInitial: targetIndex === start, sentenceFinal: targetIndex === end,
      sentenceWordIndex: targetIndex - start, targetIndex,
      sentenceStartIndex: start, sentenceEndIndex: end, clauseStartIndex: clauseStart, clauseEndIndex: clauseEnd,
      questionSentence,
      questionEvidence: clauseStart === start && (questionSentence || firstRoles.has("questionWord") || inverted),
    };
  }

  function grammarWord(candidate) {
    return String(candidate?.word || "").trim().toLocaleLowerCase();
  }

  function collectAiGrammarEvidence(context) {
    const target = context.targetIndex ?? context.sentenceWordIndex ?? 0;
    const start = context.sentenceStartIndex ?? 0;
    // Immediate-neighbor fields are convenience aliases, not another evidence
    // source. Deduplication makes observer/replay aliases harmless as well.
    const entries = [...new Map([...(context.visibleBefore || []), ...(context.visibleAfter || [])]
      .map(entry => [entry.index, { ...entry, analysis: analyzeAiWord(entry.text || entry.word) }])).values()]
      .sort((a, b) => a.index - b.index);
    const at = index => entries.find(entry => entry.index === index);
    const has = (entry, role) => Boolean(entry?.analysis.roles.has(role));
    const nominal = entry => has(entry, "noun") || has(entry, "subjectPronoun") || has(entry, "objectPronoun");
    const determiner = entry => ["article", "determiner", "possessiveDeterminer"].some(role => has(entry, role));
    const before = entries.filter(entry => entry.index < target).reverse();
    const after = entries.filter(entry => entry.index > target);
    const previous = before[0];
    const next = after[0];
    const adjacent = entry => entry && Math.abs(entry.index - target) === 1;
    const scale = distance => distance <= 1 ? 1 : 1 / (distance * distance);
    const evidence = [];
    const constructions = [];
    let whPosition = false;
    const add = (kind, profile, anchors = [], strength = 1) => {
      const unique = [...new Set(anchors.filter(Boolean).map(entry => entry.index))];
      const distance = unique.length ? Math.min(...unique.map(index => Math.abs(index - target))) : 1;
      const amount = strength * scale(distance);
      evidence.push({ kind, anchors: unique, distance, strength: amount, roles: profile });
      constructions.push({ name: kind, strength: amount });
    };
    const compete = (kind, hypotheses, anchors) => {
      const total = hypotheses.reduce((sum, hypothesis) => sum + hypothesis.weight, 0);
      const profile = {};
      for (const hypothesis of hypotheses) {
        for (const [role, support] of Object.entries(hypothesis.roles)) {
          profile[role] = (profile[role] || 0) + support * hypothesis.weight / total;
        }
      }
      add(kind, profile, anchors);
      evidence[evidence.length - 1].hypotheses = hypotheses.map(hypothesis => ({
        name: hypothesis.name, probability: hypothesis.weight / total,
      }));
    };
    const subject = { noun: 6, properNoun: 6, subjectPronoun: 6, pronoun: 2, adjective: 1 };
    const finite = { finiteVerb: 6, baseVerb: 4.8, beAuxiliary: 3, doAuxiliary: 2, haveAuxiliary: 2, modal: 2 };
    const object = { noun: 6, properNoun: 6, objectPronoun: 6, pronoun: 2, adjective: 2,
      article: 3, determiner: 3, possessiveDeterminer: 3, preposition: 2, adverb: 1.5 };
    const governed = auxiliary => has(auxiliary, "modal") || has(auxiliary, "doAuxiliary")
      ? { baseVerb: 8, adverb: 1 }
      : has(auxiliary, "haveAuxiliary") ? { pastParticiple: 8, adverb: 1 }
        : { adjective: 7, noun: 4, properNoun: 4, presentParticiple: 7, pastParticiple: 5, preposition: 3, adverb: 2 };

    // Question constructions fill positions, not every word in a question.
    // Missing words remain unknown; no answer identity is inspected.
    const first = at(start);
    const second = at(start + 1);
    const question = context.questionEvidence;
    const whFirst = has(first, "questionWord");
    const aux = has(first, "auxiliary") ? first
      : has(second, "auxiliary") && (whFirst || !first) ? second : null;
    if (question && target === start) {
      whPosition = true;
      if (has(second, "auxiliary")) add("WH-inversion-opening", { questionWord: 8, subjectPronoun: 0.6 }, [second]);
      else if (nominal(second)) {
        whPosition = false;
        add("yes-no-opening", { doAuxiliary: 7, modal: 7, beAuxiliary: 4, haveAuxiliary: 4 }, [second, after[1]]);
      } else add("question-opening", { questionWord: 7, doAuxiliary: 3, beAuxiliary: 3, modal: 3 }, [next]);
      return { evidence, constructions, whPosition };
    }
    if (question && aux && target > aux.index) {
      const subjectStart = aux.index + 1;
      // A visible determiner starts a noun phrase; its following visible head
      // belongs to the inverted subject, not to the main predicate.
      let subjectEnd = subjectStart;
      if (determiner(at(subjectStart))) {
        const head = entries.find(entry => entry.index > subjectStart && nominal(entry));
        subjectEnd = head?.index ?? subjectStart + 1;
      }
      if (target <= subjectEnd) {
        add("inverted-subject", subject, [aux, next]);
      } else {
        const subjectHead = at(subjectEnd);
        const anchor = subjectHead || aux;
        let profile = governed(aux);
        const predicate = before.find(entry => entry.index > subjectEnd && has(entry, "verb"));
        if (predicate) profile = object;
        if (adjacent(previous) && determiner(previous)) profile = { noun: 7, properNoun: 6, adjective: 3 };
        if (has(aux, "beAuxiliary") && determiner(next) && adjacent(next)) profile = { preposition: 8, adjective: 2, presentParticiple: 3 };
        add("inverted-" + (predicate ? "object-complement" : has(aux, "beAuxiliary") ? "BE-complement" : has(aux, "haveAuxiliary") ? "HAVE-participle" : "base-predicate"), profile,
          predicate ? [predicate, previous] : [anchor, aux]);
      }
      return { evidence, constructions, whPosition };
    }
    if (question && whFirst && target === start + 1) {
      const visibleMainVerb = after.some(entry => has(entry, "verb") && entry !== next);
      const uncertainTail = !next && context.sentenceEndIndex > target;
      // A following noun can be an inverted subject OR the object of a
      // subject-WH predicate. Preserve both readings; a later lexical verb
      // is the evidence that favors inversion.
      compete("WH-predicate-or-inversion", [
        { name: "subject-WH", weight: visibleMainVerb ? 1 : uncertainTail ? 2 : 4, roles: finite },
        { name: "WH-inversion", weight: visibleMainVerb ? 4 : uncertainTail ? 2 : 1,
          roles: { doAuxiliary: 7, modal: 6, beAuxiliary: 4, haveAuxiliary: 4 } },
      ], [first, next]);
      return { evidence, constructions, whPosition };
    }

    // Basic declarative/complement constructions. One scoped relationship is
    // selected for each anchor, with several possible roles in its profile.
    if (adjacent(previous) && determiner(previous)) {
      add("determiner-noun-phrase", nominal(next) && adjacent(next)
        ? { adjective: 7, noun: 4, properNoun: 3 }
        : { noun: 7, properNoun: 6, adjective: 3 }, [previous, next]);
    } else if (adjacent(previous) && (has(previous, "auxiliary") || previous.word === "to")) {
      let profile = previous.word === "to" ? { baseVerb: 8, adverb: 1 } : governed(previous);
      if (has(previous, "beAuxiliary") && determiner(next) && adjacent(next)) profile = { preposition: 8, presentParticiple: 3, adjective: 2 };
      add(previous.word === "to" ? "infinitive" : "auxiliary-complement", profile, [previous, next]);
    } else {
      // A known predicate blocks a more distant subject from reasserting that
      // every later blank is another verb. Determiners disambiguate noun/verb
      // words such as "pet" as noun-phrase heads.
      const isPredicate = entry => has(entry, "verb") && !determiner(at(entry.index - 1));
      const predicate = before.find(entry => isPredicate(entry) || has(entry, "auxiliary"));
      const inPrepositionalPhrase = entry => has(at(entry.index - 1), "preposition") ||
        (determiner(at(entry.index - 1)) && has(at(entry.index - 2), "preposition"));
      const subjectHead = entries.find(entry => entry.index < target && nominal(entry) &&
        !isPredicate(entry) && !inPrepositionalPhrase(entry));
      if (predicate && (!subjectHead || predicate.index > subjectHead.index)) {
        let profile = has(predicate, "auxiliary") ? governed(predicate) : object;
        if (adjacent(next) && determiner(next)) profile = { preposition: 8, adverb: 4, adjective: 1 };
        else if (adjacent(next) && nominal(next)) profile = { article: 8, determiner: 7, possessiveDeterminer: 7, adjective: 4, preposition: 2 };
        // After an intervening preposition, its object is expected.
        if (previous && has(previous, "preposition") && previous.index > predicate.index) {
          profile = adjacent(next) && nominal(next)
            ? { article: 8, determiner: 7, possessiveDeterminer: 7, adjective: 4 } : object;
        }
        add("predicate-complement", profile, [previous, next].filter(Boolean));
      } else if (previous && has(previous, "preposition")) {
        add("prepositional-object", { ...object, article: 3, determiner: 3, possessiveDeterminer: 3 }, [previous]);
      } else if (subjectHead) {
        if (subjectHead.distance > 1 && adjacent(next) && determiner(next)) {
          compete("unresolved-predicate-complement", [
            { name: "predicate-in-gap", weight: 3, roles: { preposition: 6, adverb: 3 } },
            { name: "predicate-at-target", weight: 1, roles: finite },
          ], [subjectHead, next]);
        } else {
          const profile = adjacent(next) && has(next, "adjective")
            ? { beAuxiliary: 8, finiteVerb: 2 } : finite;
          add("subject-predicate", profile, [subjectHead]);
          if (next && has(next, "preposition")) add("right-complement-boundary", { finiteVerb: 1.5, baseVerb: 1.2 }, [next]);
        }
      } else if (next && (has(next, "verb") || has(next, "auxiliary"))) {
        add("subject-before-predicate", subject, [next]);
      } else if (adjacent(next) && nominal(next)) {
        const prefix = { article: 8, determiner: 7, possessiveDeterminer: 7, adjective: 4 };
        if (target > (context.clauseStartIndex ?? start)) {
          compete("predicate-or-noun-phrase-prefix", [
            { name: "predicate-before-object", weight: 3, roles: finite },
            { name: "noun-phrase-prefix", weight: 1, roles: prefix },
          ], [next]);
        } else add("noun-phrase-prefix", prefix, [next]);
      }
    }
    if (!evidence.length && context.sentenceInitial) {
      add("declarative-opening", { article: 5, determiner: 4, possessiveDeterminer: 4, subjectPronoun: 3, noun: 1.5, properNoun: 1.5 });
    }
    return { evidence, constructions, whPosition };
  }

  function inferAiTargetRolesFromContext(context) {
    const weights = { ...AI_TARGET_ROLE_WEIGHTS };
    const analysis = collectAiGrammarEvidence(context);
    for (const evidence of analysis.evidence) {
      for (const [role, support] of Object.entries(evidence.roles)) weights[role] += support * evidence.strength;
    }
    // Position constraints cannot create negative weights or probabilities.
    if (!analysis.whPosition) weights.questionWord = 0.25;
    if (context.sentenceFinal) {
      for (const role of ["article", "determiner", "possessiveDeterminer", "conjunction"]) weights[role] = Math.max(0.1, weights[role] * 0.65);
    }
    return weights;
  }

  function getAiRoleFamilyWeights(weights) {
    // Subtypes remain visible: DO, BE, HAVE and modal are not one verb bucket.
    const families = {
      nominal: ["noun", "properNoun", "subjectPronoun", "objectPronoun", "pronoun"],
      lexicalVerb: ["baseVerb", "finiteVerb", "presentParticiple", "pastParticiple"],
      determiner: ["article", "determiner", "possessiveDeterminer"],
      be: ["beAuxiliary"], do: ["doAuxiliary"], have: ["haveAuxiliary"], modal: ["modal"],
      adjective: ["adjective"], adverb: ["adverb"], preposition: ["preposition"],
      conjunction: ["conjunction"], questionWord: ["questionWord"],
    };
    return Object.fromEntries(Object.entries(families).map(([family, roles]) =>
      [family, Math.max(...roles.map(role => weights[role] || 0), 0)]));
  }

  function inferAiTargetRoles(targetSlot) {
    const context = targetSlot?.context || getAiGrammarContext(targetSlot);
    const analysis = collectAiGrammarEvidence(context);
    const weights = inferAiTargetRolesFromContext(context);
    const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
    const ranked = Object.entries(weights).sort((a, b) => b[1] - a[1])
      .map(([role, weight]) => ({ role, weight, probability: weight / total }));
    const families = getAiRoleFamilyWeights(weights);
    // Evidence strength, not duplicated role labels, determines this bounded
    // low/moderate/strong diagnostic. Role ambiguity remains in the profile.
    const confidence = 1 + Math.min(2, (Math.max(...Object.values(families)) - 1) / 4);
    return { weights, ranked, confidence, families, evidence: analysis.evidence,
      constructions: analysis.constructions, whPosition: analysis.whPosition, context };
  }

  function getAiRoleCompatibility(candidate, targetRoles) {
    if (!targetRoles?.weights) return 1;
    const roles = classifyAiCandidateWord(candidate);
    if (!roles.size) return 0.7;
    const weights = targetRoles.weights;
    const maxWeight = Math.max(1, ...Object.values(weights));
    if (maxWeight <= 1) return roles.has("questionWord") ? 0.25 : 1;
    // Generic labels never let a past tense bypass a base-verb requirement.
    const specific = [...roles].filter(role => !["verb", "auxiliary", "pronoun"].includes(role) &&
      // An auxiliary's finite form is not evidence that it is a lexical verb.
      !(roles.has("auxiliary") && role === "finiteVerb"));
    const best = Math.max(1, ...specific.map(role => weights[role] || 1));
    const strength = Math.min(1, (maxWeight - 1) / 6);
    const fit = Math.max(0, (best - 1) / (maxWeight - 1));
    let score = (1 - strength) + strength * (0.4 + 2.6 * fit);
    if (roles.has("questionWord") && !targetRoles.whPosition) score *= 0.25;
    return score;
  }

  function scoreAiCandidateForGrammar(candidate, context) {
    const word = grammarWord(candidate);
    if (!word) return 0;
    const analysis = context.targetRoles || inferAiTargetRoles({ context });
    let score = getAiRoleCompatibility(candidate, analysis);
    // The only remaining extra factors describe lexical collocation/spelling,
    // not a second interpretation of the target's grammatical role.
    if (AI_GRAMMAR_PHRASE_BOOSTS.some(([before, words]) => context.previousWord === before && words.includes(word))) score *= 1.45;
    if (context.nextWord && (word === "a" || word === "an")) {
      const vowel = /^[aeiou]/.test(context.nextWord);
      score *= (word === "an") === vowel ? 1.08 : 0.82;
    }
    return score;
  }

  const ETTIN_CONTEXT_PRIOR_VERSION = 'ettin-context-prior-v1';
  const ETTIN_CONTEXT_PRIOR_BONUS = 0.20;
  const ENTITY_TYPE_RANKING_VERSION = 'entity-type-ranking-v1';
  const ENTITY_TYPE_RANKING_SUPPORT = 0.20;
  const ENTITY_SLOT_COMPATIBILITY_VERSION = 'entity-slot-compatibility-v1';
  const ENTITY_SLOT_COMPATIBILITY_MISMATCH_PENALTY = 0.20;
  const ENTITY_SLOT_COMPATIBILITY_BUYER_SUPPORT = 0.10;
  const DISCOURSE_PERSON_COMPATIBILITY_VERSION = 'discourse-person-compatibility-v1';
  const DISCOURSE_PERSON_COMPATIBILITY_SUPPORT = 0.10;
  const DISCOURSE_PERSON_COMPATIBILITY_MISMATCH_PENALTY = 0.25;
  const ETTIN_SPARSE_BREADTH_ENABLED = true;
  const ETTIN_SPARSE_BREADTH_MASS_TARGET = 0.80;
  const ETTIN_SPARSE_BREADTH_MAX_CANDIDATES = 8;
  const ETTIN_CONTEXT_PRIOR_REASONS = new Set([
    'question-opening-compatible',
    'visible-determiner-context',
    'public-subject-question-finite-verb',
    'public-subject-question-transitive-object',
    'strong-declarative-predicate-verb-slot',
  ]);

  function evaluateEntitySlotCompatibility(candidateTypes, hypotheses, enabled = ENTITY_SLOT_COMPATIBILITY_ENABLED) {
    const neutral = { status: 'neutral', type: '', confidence: 'NONE', adjustment: 0, support: 0, penalty: 0 };
    if (!enabled || !Array.isArray(candidateTypes) || !candidateTypes.length) return neutral;
    const usable = (hypotheses || []).filter(hypothesis => ENTITY_TYPE_ORDER.includes(hypothesis?.type) &&
      (hypothesis.confidence === 'STRONG' ||
        (hypothesis.confidence === 'SUPPORTED' &&
          ['purchase-location', 'buyer-subject-purchase'].includes(hypothesis.reason))));
    if (!usable.length) return neutral;
    const matches = usable.filter(hypothesis => candidateTypes.includes(hypothesis.type));
    if (matches.length) {
      const strongest = matches.find(hypothesis => hypothesis.confidence === 'STRONG') || matches[0];
      const buyerMatch = matches.some(hypothesis => hypothesis.reason === 'buyer-subject-purchase' &&
        hypothesis.type === 'PERSON_ANIMATE');
      const support = buyerMatch ? ENTITY_SLOT_COMPATIBILITY_BUYER_SUPPORT : 0;
      return { status: 'compatible', type: [...new Set(matches.map(hypothesis => hypothesis.type))].join(','),
        confidence: strongest.confidence, adjustment: support, support, penalty: 0 };
    }
    const strong = usable.filter(hypothesis => hypothesis.confidence === 'STRONG');
    if (!strong.length) return neutral;
    return { status: 'mismatch', type: [...new Set(strong.map(hypothesis => hypothesis.type))].join(','),
      confidence: 'STRONG', adjustment: -ENTITY_SLOT_COMPATIBILITY_MISMATCH_PENALTY,
      support: 0, penalty: ENTITY_SLOT_COMPATIBILITY_MISMATCH_PENALTY };
  }

  function combineEttinSlotCompatibilityScore(rawScore, contextualPriorBonus, entityTypeBonus, slotCompatibility,
      discourseCompatibility = { support: 0, penalty: 0 }) {
    const combinedSupport = Math.max(contextualPriorBonus, entityTypeBonus, slotCompatibility.support,
      discourseCompatibility.support);
    return { combinedSupport,
      effectiveScore: rawScore + combinedSupport - slotCompatibility.penalty - discourseCompatibility.penalty };
  }

  function ettinSimpleDeclarativeSubjectFrame(state) {
    const engine = globalThis.GGGHumanPlaytest;
    const index = state?.targetSlotIndex;
    if (!engine || !Number.isInteger(index) || !state?.slots?.[index] || state.slots[index].solved) return false;
    const { start, end } = entityTypeSentenceBounds(state, engine, index);
    // A complete three-slot S-V-O shape leaves no extra clause to interpret.
    // Longer clauses, internal punctuation and uncertain objects abstain.
    if (index !== start || end !== start + 2 || !/^[.]$/.test(state.slots[end].trailing || '')) return false;
    const sentence = state.slots.slice(start, end + 1);
    if (sentence.some((slot, offset) => !slot.letters?.length ||
        (offset < 2 && slot.trailing) ||
        (slot.gaps || []).some((gap, position) => gap && position < slot.letters.length))) return false;
    const predicate = sentence[1], object = sentence[2];
    if (!predicate.solved) return false;
    const verb = getHumanPlaytestAnalysis(engine.tokenAt(predicate));
    const verbRoles = new Set(verb.lexicalRoles || verb.roles || []);
    const directTransitive = new Set((engine.frameGroups?.DIRECT_TRANSITIVE || '').split(/\s+/));
    if (!verb.primaryVerb || !verb.transitive || !verbRoles.has('verb') || !verbRoles.has('finiteVerb') ||
        !['thirdSingular', 'pastTense'].some(role => verbRoles.has(role)) ||
        ['auxiliary', 'modal'].some(role => verbRoles.has(role)) ||
        !(verb.lemmas || []).some(lemma => directTransitive.has(lemma))) return false;
    // Noninitial public capitalization supports a nominal hidden object; a
    // hidden lowercase slot could instead contain another finite predicate.
    if (!object.solved) return object.letters.length > 1 && object.letters[0].capital === true;
    const objectWord = engine.tokenAt(object);
    const nominal = getHumanPlaytestAnalysis(objectWord);
    const objectRoles = new Set(nominal.lexicalRoles || nominal.roles || []);
    if (['finiteVerb', 'auxiliary', 'modal', 'questionWord', 'conjunction'].some(role => objectRoles.has(role))) return false;
    return ['noun', 'objectPronoun', 'possessivePronoun'].some(role => objectRoles.has(role)) ||
      (object.letters[0].capital === true &&
        globalThis.GGGProperNounBank?.resolveProperNounAuthorization(objectWord)?.authorized === true);
  }

  function buildEttinStage3Distribution(pool) {
    if (!pool || pool.predictionMode !== 'ettin-pilot') return { ok: false, reason: 'not-ettin-pool', entries: [] };
    if (!pool.attentionPlan?.boardKey || !pool.attentionPlan?.considered) return { ok: false, reason: 'missing-attention-plan', entries: [] };
    const currentState = getHumanPlaytestPublicState(pool.targetSlot);
    const currentBoardKey = globalThis.GGGHumanPlaytest.boardKey(currentState);
    if (currentBoardKey !== pool.publicBoardKey || currentBoardKey !== pool.attentionPlan.boardKey) {
      return { ok: false, reason: 'stale-board', entries: [] };
    }
    const selectedEvidence = pool.attentionPlan.considered.find(entry => entry.slotIndex === pool.targetSlot.slotIndex);
    const band = selectedEvidence?.band;
    const requestedK = { STRONG: 1, SUPPORTED: 3, WEAK: 5 }[band];
    if (!requestedK) return { ok: false, reason: 'missing-attention-band', entries: [] };
    const snapshot = buildEttinPublicSnapshot(currentState);
    const simpleDeclarativeSubject = ettinSimpleDeclarativeSubjectFrame(currentState);
    const seen = new Set(), exclusions = [], eligible = [];
    const scoredInputs = (pool.candidates || []).map((candidate, inputIndex) => ({ candidate, inputIndex }));
    for (const { candidate, inputIndex } of scoredInputs) {
      if (!Number.isInteger(candidate?.rank) || candidate.rank < 1 || !Number.isFinite(candidate.score) ||
          !Number.isFinite(candidate.probability) || candidate.probability < 0) {
        return { ok: false, reason: 'malformed-ettin-score', entries: [], exclusions };
      }
    }
    scoredInputs.sort((left, right) => left.candidate.rank - right.candidate.rank || left.inputIndex - right.inputIndex);
    for (const { candidate, inputIndex } of scoredInputs) {
      const normalized = normalizeAiCandidate(candidate?.word);
      if (!normalized) { exclusions.push({ reason: 'invalid-word', inputIndex }); continue; }
      if (candidate.probability === 0) { exclusions.push({ reason: 'zero-model-probability', inputIndex, word: candidate.word }); continue; }
      if (!isSafelySubmittableAiCandidate(candidate.word, pool.targetLength) ||
          !matchesAiRevealedLetters(candidate.word, pool.targetSlot) ||
          hasWrongAiGuessForSlot(pool.targetSlot.slotIndex, candidate.word) ||
          globalThis.GGGEttinProvider?.validateCandidate(snapshot, candidate.word)?.ok !== true) {
        exclusions.push({ reason: 'public-ineligible', inputIndex, word: candidate.word });
        continue;
      }
      if (simpleDeclarativeSubject) {
        const analysis = candidate.analysis || getHumanPlaytestAnalysis(candidate.word);
        if ((analysis.lexicalRoles || analysis.roles || []).includes('questionWord')) {
          exclusions.push({ reason: 'simple-declarative-question-word-block', inputIndex, word: candidate.word });
          continue;
        }
      }
      if (seen.has(normalized)) { exclusions.push({ reason: 'duplicate', inputIndex, word: candidate.word }); continue; }
      seen.add(normalized);
      eligible.push({ candidate, inputIndex });
    }
    eligible.sort((left, right) => left.candidate.rank - right.candidate.rank || left.inputIndex - right.inputIndex);
    const limit = Math.min(requestedK, eligible.length);
    const rawGroup = eligible.slice(0, limit);
    const rawTotal = rawGroup.reduce((total, entry) => total + entry.candidate.probability, 0);
    if (!rawGroup.length) return { ok: false, reason: 'no-eligible-ettin-candidates', entries: [], exclusions, band, requestedK };
    if (!Number.isFinite(rawTotal) || rawTotal <= 0) return { ok: false, reason: 'unusable-model-probabilities', entries: [], exclusions, band, requestedK };
    const rawStage3Probabilities = new Map(rawGroup.map(entry => [entry.candidate, entry.candidate.probability / rawTotal]));
    const strongEntityTypes = [...new Set((pool.entityTypeContext?.hypotheses || [])
      .filter(hypothesis => hypothesis?.confidence === 'STRONG' && ENTITY_TYPE_ORDER.includes(hypothesis.type))
      .map(hypothesis => hypothesis.type))];
    const slotCompatibilityHypotheses = ENTITY_SLOT_COMPATIBILITY_ENABLED
      ? (pool.entitySlotCompatibilityContext?.hypotheses || []).filter(hypothesis =>
        ENTITY_TYPE_ORDER.includes(hypothesis.type) &&
        (hypothesis.confidence === 'STRONG' ||
          (hypothesis.confidence === 'SUPPORTED' &&
            ['purchase-location', 'buyer-subject-purchase'].includes(hypothesis.reason))))
      : [];
    const effectiveCandidates = eligible.map(entry => {
      const proposalReasons = Array.isArray(entry.candidate.proposalReasons) ? entry.candidate.proposalReasons : [];
      const matchedContextualReasons = [...new Set(proposalReasons.filter(reason => ETTIN_CONTEXT_PRIOR_REASONS.has(reason)))];
      const contextualPriorBonus = band !== 'STRONG' && matchedContextualReasons.length ? ETTIN_CONTEXT_PRIOR_BONUS : 0;
      const candidateTypes = Object.keys(candidateEntityTypes(entry.candidate));
      const entityMatch = ENTITY_TYPE_RANKING_ENABLED
        ? candidateTypes.filter(type => strongEntityTypes.includes(type)) : [];
      const entityTypeBonus = entityMatch.length ? ENTITY_TYPE_RANKING_SUPPORT : 0;
      const slotCompatibility = evaluateEntitySlotCompatibility(candidateTypes,
        slotCompatibilityHypotheses, ENTITY_SLOT_COMPATIBILITY_ENABLED);
      const discoursePersonCompatibility = evaluateDiscoursePersonCompatibility(entry.candidate,
        pool.discoursePersonCompatibilityContext, globalThis.GGGHumanPlaytest,
        DISCOURSE_PERSON_COMPATIBILITY_ENABLED);
      const combinedScore = combineEttinSlotCompatibilityScore(entry.candidate.score,
        contextualPriorBonus, entityTypeBonus, slotCompatibility, discoursePersonCompatibility);
      return { ...entry, matchedContextualReasons, contextualPriorBonus, entityMatch, entityTypeBonus,
        slotCompatibility, discoursePersonCompatibility, combinedSupport: combinedScore.combinedSupport,
        effectiveScore: combinedScore.effectiveScore };
    }).sort((left, right) => right.effectiveScore - left.effectiveScore ||
      left.candidate.rank - right.candidate.rank || left.inputIndex - right.inputIndex);

    const targetSentence = pool.attentionPlan.publicBoard?.slots?.find(slot => slot.slotIndex === pool.targetSlot.slotIndex)?.sentence;
    const sparseSentence = Number.isInteger(targetSentence) &&
      !pool.attentionPlan.publicBoard.slots.some(slot => slot.sentence === targetSentence && slot.solved);
    let selectedBreadth = limit;
    let sparseBreadthActivated = false;
    let selectedProbabilityMass = null;
    if (ETTIN_SPARSE_BREADTH_ENABLED && band !== 'STRONG' && sparseSentence) {
      sparseBreadthActivated = true;
      const fullMax = effectiveCandidates[0].effectiveScore;
      const fullWeights = effectiveCandidates.map(entry => Math.exp(entry.effectiveScore - fullMax));
      const fullTotal = fullWeights.reduce((total, weight) => total + weight, 0);
      const breadthCeiling = Math.min(ETTIN_SPARSE_BREADTH_MAX_CANDIDATES, effectiveCandidates.length);
      let retainedWeight = fullWeights.slice(0, selectedBreadth).reduce((total, weight) => total + weight, 0);
      while (selectedBreadth < breadthCeiling && retainedWeight / fullTotal < ETTIN_SPARSE_BREADTH_MASS_TARGET) {
        retainedWeight += fullWeights[selectedBreadth];
        selectedBreadth++;
      }
      selectedProbabilityMass = retainedWeight / fullTotal;
    }
    const effectiveGroup = effectiveCandidates.slice(0, selectedBreadth);
    const effectiveMax = effectiveGroup[0].effectiveScore;
    const effectiveWeights = effectiveGroup.map(entry => Math.exp(entry.effectiveScore - effectiveMax));
    const effectiveTotal = effectiveWeights.reduce((total, weight) => total + weight, 0);
    if (!Number.isFinite(effectiveTotal) || effectiveTotal <= 0) return { ok: false, reason: 'unusable-effective-scores', entries: [], exclusions, band, requestedK };
    const effectiveStage3Probabilities = new Map(effectiveGroup.map((entry, index) => [entry.candidate, effectiveWeights[index] / effectiveTotal]));
    const rawTopK = new Set(rawGroup.map(entry => entry.candidate));
    const effectiveTopK = new Set(effectiveGroup.map(entry => entry.candidate));
    const effectiveRanks = new Map(effectiveCandidates.map((entry, index) => [entry.candidate, index + 1]));
    const candidateDiagnostics = effectiveCandidates.map(entry => ({
      word: entry.candidate.word,
      matchedContextualReasons: entry.matchedContextualReasons,
      rawEttinScore: entry.candidate.score,
      rawEttinProbability: entry.candidate.probability,
      rawEttinRank: entry.candidate.rank,
      contextualPriorBonus: entry.contextualPriorBonus,
      effectiveScore: entry.effectiveScore,
      effectiveRank: effectiveRanks.get(entry.candidate),
      rawTopKMembership: rawTopK.has(entry.candidate),
      effectiveTopKMembership: effectiveTopK.has(entry.candidate),
      rawStage3Probability: rawStage3Probabilities.get(entry.candidate) ?? 0,
      effectiveStage3Probability: effectiveStage3Probabilities.get(entry.candidate) ?? 0,
      ...(entry.entityTypeBonus > 0 ? { entityMatch: entry.entityMatch } : {}),
      ...(entry.slotCompatibility.status !== 'neutral' ? { slotCompatibility: [
        entry.slotCompatibility.type, entry.slotCompatibility.confidence,
        entry.slotCompatibility.status, entry.slotCompatibility.adjustment,
      ] } : {}),
      ...(entry.discoursePersonCompatibility.status !== 'neutral' ? { discoursePersonCompatibility: [
        entry.discoursePersonCompatibility.membership, entry.discoursePersonCompatibility.status,
        entry.discoursePersonCompatibility.support, entry.discoursePersonCompatibility.penalty,
      ] } : {}),
    }));
    logEttinPilot('ettin-stage3-ranked', pool.targetSlot, {
      contextualPriorVersion: ETTIN_CONTEXT_PRIOR_VERSION, attentionBand: band, k: requestedK,
      entityRankingVersion: ENTITY_TYPE_RANKING_VERSION, entityRankingEnabled: ENTITY_TYPE_RANKING_ENABLED,
      entityRankingBonus: ENTITY_TYPE_RANKING_SUPPORT, strongEntityTypes,
      entitySlotCompatibilityVersion: ENTITY_SLOT_COMPATIBILITY_VERSION,
      entitySlotCompatibilityEnabled: ENTITY_SLOT_COMPATIBILITY_ENABLED,
      entitySlotCompatibilityHypotheses: slotCompatibilityHypotheses.map(item => [item.type, item.confidence, item.reason]),
      discoursePersonCompatibilityVersion: DISCOURSE_PERSON_COMPATIBILITY_VERSION,
      discoursePersonCompatibilityEnabled: DISCOURSE_PERSON_COMPATIBILITY_ENABLED,
      discoursePersonHypothesis: pool.discoursePersonCompatibilityContext?.active ? [
        pool.discoursePersonCompatibilityContext.confidence,
        pool.discoursePersonCompatibilityContext.pronoun,
        pool.discoursePersonCompatibilityContext.role,
        pool.discoursePersonCompatibilityContext.reason,
      ] : null,
      baseK: requestedK, selectedBreadth, sparseBreadthActivated, selectedProbabilityMass,
      eligibleCandidateCount: candidateDiagnostics.length, candidates: candidateDiagnostics,
      ...(exclusions.some(entry => entry.reason === 'simple-declarative-question-word-block') ? {
        structuralExclusions: exclusions.filter(entry => entry.reason === 'simple-declarative-question-word-block')
          .map(entry => [entry.word, entry.reason]),
      } : {}),
    });
    const entries = effectiveGroup.map((entry, effectiveIndex) => ({
      candidate: entry.candidate,
      modelRank: entry.candidate.rank,
      eligibleRank: effectiveIndex + 1,
      modelScore: entry.candidate.score,
      modelProbability: entry.candidate.probability,
      selectionProbability: effectiveStage3Probabilities.get(entry.candidate),
      score: entry.candidate.score,
      probability: effectiveStage3Probabilities.get(entry.candidate),
      contextualPriorVersion: ETTIN_CONTEXT_PRIOR_VERSION,
      matchedContextualReasons: entry.matchedContextualReasons,
      contextualPriorApplied: entry.contextualPriorBonus > 0,
      contextualPriorBonus: entry.contextualPriorBonus,
      ...(entry.discoursePersonCompatibility.status !== 'neutral'
        ? { discoursePersonCompatibility: entry.discoursePersonCompatibility } : {}),
      effectiveScore: entry.effectiveScore,
      effectiveRank: effectiveRanks.get(entry.candidate),
      rawTopKMembership: rawTopK.has(entry.candidate),
      effectiveTopKMembership: effectiveTopK.has(entry.candidate),
      rawStage3Probability: rawStage3Probabilities.get(entry.candidate) ?? 0,
      effectiveStage3Probability: effectiveStage3Probabilities.get(entry.candidate),
    }));
    return { ok: true, entries, band, requestedK, selectedBreadth, sparseBreadthActivated,
      selectedProbabilityMass, groupSize: entries.length, exclusions,
      contextualPriorVersion: ETTIN_CONTEXT_PRIOR_VERSION };
  }

  function chooseEttinStage3Candidate(pool, draw = Math.random) {
    if (pool?.stage3Choice) return pool.stage3Choice;
    const distribution = pool?.stage3Distribution || buildEttinStage3Distribution(pool);
    if (!distribution.ok) {
      if (isEttinPilotMode() && pool?.targetSlot) logEttinPilot('stage3-selection-failed', pool.targetSlot, { reason: distribution.reason });
      return null;
    }
    pool.stage3Distribution = distribution;
    let selected = distribution.entries[distribution.entries.length - 1];
    if (distribution.entries.length > 1) {
      let roll = Number(draw());
      if (!Number.isFinite(roll) || roll < 0 || roll >= 1) roll = 0;
      for (const entry of distribution.entries) {
        roll -= entry.selectionProbability;
        if (roll < 0) { selected = entry; break; }
      }
    }
    pool.stage3Choice = selected;
    pool.stage3ChoiceId ||= `stage3:${HUMAN_PLAYTEST_TURN.opportunity}:${pool.publicBoardKey}:${distribution.band}:${selected.candidate.word}`;
    return selected;
  }

  function getAiCandidateDistribution(pool, guessNumber) {
    if (isEttinPilotMode()) {
      const distribution = pool?.stage3Distribution || buildEttinStage3Distribution(pool);
      if (!distribution.ok) return [];
      if (pool) pool.stage3Distribution = distribution;
      return distribution.entries.map(entry => ({ ...entry, candidate: entry.candidate }));
    }
    if (isHumanPlaytestMode()) return (rankHumanPlaytestPool(pool)?.band || []).map(e => ({
      candidate: e, grammarWeight: e.grammarWeight, weight: e.weight, probability: e.probability }));
    if (!pool?.candidates?.length) return [];
    const maximum = isAiMaximumAccuracyMode();
    // Fail closed on a stale normal pool rather than reuse answer-derived priors.
    if (maximum && pool.predictionMode !== "maximum-accuracy") return [];
    if (pool.targetSlot.group.classList.contains("revealed")) return [];
    const chance = maximum ? 0 : getCorrectGuessChance(guessNumber);
    if (chance === null) return [];
    const context = { ...getAiGrammarContext(pool.targetSlot), targetLength: pool.targetLength };
    context.targetRoles = inferAiTargetRoles(pool.targetSlot);
    const weighted = pool.candidates.filter(candidate => (
      (!maximum || candidate.sources.every(source => source === 1 || source === 4)) &&
      isSafelySubmittableAiCandidate(candidate.word, pool.targetLength) &&
      matchesAiRevealedLetters(candidate.word, pool.targetSlot) &&
      !hasWrongAiGuessForSlot(pool.targetSlot.slotIndex, candidate.word)
    )).map(candidate => {
      const grammarWeight = scoreAiCandidateForGrammar(candidate, context);
      return { candidate, grammarWeight, weight: candidate.sourcePrior * grammarWeight };
    });
    const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    if (!Number.isFinite(total) || total <= 0) return [];
    if (maximum) return weighted.map(entry => ({ ...entry, correctChance: 0,
      heuristicProbability: entry.weight / total, probability: entry.weight / total }));
    const answer = normalizeAiAnswer(pool.targetSlot.answer);
    const hasAnswer = weighted.some(entry => normalizeAiAnswer(entry.candidate.word) === answer);
    const assistance = hasAnswer ? chance / 100 : 0;
    // Heuristics first, difficulty second. c assists a fraction of otherwise
    // wrong guesses: P(answer) = q + c(1-q). Zero retains natural successes;
    // 100 guarantees the exact answer if it is valid. No correct/incorrect gate.
    return weighted.map(entry => {
      const isCorrect = normalizeAiAnswer(entry.candidate.word) === answer;
      const heuristicProbability = entry.weight / total;
      return { ...entry, isCorrect, correctChance: chance, heuristicProbability,
        probability: (1 - assistance) * heuristicProbability + (isCorrect ? assistance : 0) };
    });
  }

  function chooseFinalAiCandidate(pool, guessNumber) {
    if (isEttinPilotMode()) {
      const selected = chooseEttinStage3Candidate(pool);
      if (!selected) return null;
      const distribution = pool.stage3Distribution;
      const selectedCandidate = { ...selected.candidate, modelProbability: selected.modelProbability,
        selectionProbability: selected.selectionProbability, probability: selected.selectionProbability,
        publicBoardKey: pool.publicBoardKey,
        diagnostic: { provider: 'ETTIN', policyVersion: 'ettin-stage3-top-k-v1', band: distribution.band,
          requestedK: distribution.requestedK, groupSize: distribution.groupSize,
          contextualPriorVersion: selected.contextualPriorVersion,
          contextualPriorApplied: selected.contextualPriorApplied,
          matchedContextualReasons: selected.matchedContextualReasons,
          contextualPriorBonus: selected.contextualPriorBonus,
          effectiveScore: selected.effectiveScore, effectiveRank: selected.effectiveRank,
          rawTopKMembership: selected.rawTopKMembership, effectiveTopKMembership: selected.effectiveTopKMembership,
          rawStage3Probability: selected.rawStage3Probability,
          effectiveStage3Probability: selected.effectiveStage3Probability,
          modelProbability: selected.modelProbability, selectionProbability: selected.selectionProbability,
          score: selected.modelScore, modelRank: selected.modelRank, eligibleRank: selected.eligibleRank,
          choiceId: pool.stage3ChoiceId,
          group: distribution.entries.map(entry => ({ word: entry.candidate.word, modelRank: entry.modelRank,
            eligibleRank: entry.eligibleRank, score: entry.modelScore, modelProbability: entry.modelProbability,
            selectionProbability: entry.selectionProbability, contextualPriorApplied: entry.contextualPriorApplied,
            matchedContextualReasons: entry.matchedContextualReasons, contextualPriorBonus: entry.contextualPriorBonus,
            effectiveScore: entry.effectiveScore, effectiveRank: entry.effectiveRank,
            rawTopKMembership: entry.rawTopKMembership, effectiveTopKMembership: entry.effectiveTopKMembership,
            rawStage3Probability: entry.rawStage3Probability,
            effectiveStage3Probability: entry.effectiveStage3Probability })) } };
      return selectedCandidate;
    }
    if (isHumanPlaytestMode()) {
      const ranking = rankHumanPlaytestPool(pool);
      if (!ranking) return null;
      if (pool.boardKey && pool.boardKey !== globalThis.GGGHumanPlaytest.boardKey(ranking.state)) return null;
      const seed = globalThis.crypto?.getRandomValues
        ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 4294967296);
      const chosen = getHumanCandidateProvider().choose(ranking, seed,
        typeof recognizedResponder === 'string' ? recognizedResponder : null, guessNumber);
      if (chosen) {
        chosen.diagnostic.topSlotOpportunities = pool.opportunityLog || [{ slotIndex: pool.targetSlot.slotIndex,
          pattern: ranking.pattern, ...getHumanCandidateProvider().opportunity(ranking) }];
        if (pool.slotRandom) chosen.diagnostic.slotRandom = pool.slotRandom;
        chosen.publicBoardKey = globalThis.GGGHumanPlaytest.boardKey(ranking.state);
      }
      return chosen;
    }
    const distribution = getAiCandidateDistribution(pool, guessNumber);
    if (!distribution.length) return null;
    if (isAiMaximumAccuracyMode()) {
      const selected = rankAiMaximumCandidates(distribution)[0];
      return { ...selected.candidate, correctChance: 0, probability: selected.probability };
    }
    let roll = Math.random();
    let selected = distribution[distribution.length - 1];
    for (const entry of distribution) {
      roll -= entry.probability;
      if (roll < 0) { selected = entry; break; }
    }
    return { ...selected.candidate, isCorrect: selected.isCorrect,
      correctChance: selected.correctChance, probability: selected.probability };
  }

  function rankAiMaximumCandidates(distribution) {
    return distribution.slice().sort((a, b) => b.probability - a.probability ||
      (a.candidate.normalized < b.candidate.normalized ? -1 : a.candidate.normalized > b.candidate.normalized ? 1 : 0));
  }

  async function buildMaximumAccuracyAiPool() {
    let best = null;
    let bestProbability = -1;
    for (const slot of getEligibleAiSlots()) {
      const pool = await buildAiCandidatePool(slot);
      const top = rankAiMaximumCandidates(getAiCandidateDistribution(pool, aiGuessNumber))[0];
      // Stable slot-order ties; no length/personality/noise preferences.
      if (top && top.probability > bestProbability) {
        best = pool;
        bestProbability = top.probability;
      }
    }
    return best;
  }

  function finishAiGuessOpportunity() {
    if (handRaiseState !== HAND_RAISE_STATES.ANSWER_LOCKED || !AI_CHARACTERS.includes(recognizedResponder)) return false;
    resetHandRaiseState();
    aiGuessNumber += 1;
    aiTurnState = "idle";
    if (gameStarted && !isGameOver && !gameEnded) scheduleAiTurn(false);
    return true;
  }

  function finishHumanGuessOpportunity() {
    if (handRaiseState !== HAND_RAISE_STATES.ANSWER_LOCKED || recognizedResponder !== "human") return false;
    resetHandRaiseState();
    if (gameStarted && !isGameOver && !gameEnded) {
      aiTurnState = "idle";
      scheduleAiTurn(false);
    }
    return true;
  }

  function submitSelectedAiGuess() {
    const target = currentAiTargetSlot;
    const candidate = currentAiSelectedCandidate;
    const character = recognizedResponder;
    const submittedWord = isHumanPlaytestMode() && candidate?.submissionSurface
      ? candidate.submissionSurface
      : applyAiTargetCapitalization(candidate?.word, target);
    if (isHumanPlaytestMode()) {
      logHumanPlaytestTransition('submission-attempted');
      const problem = humanPlaytestCandidateProblem(currentAiCandidatePool, candidate);
      if (problem) {
        logHumanPlaytestTransition('submission-rejected-before-commit', problem);
        return cancelHumanPlaytestOpportunity(problem);
      }
    }
    if (
      handRaiseState !== HAND_RAISE_STATES.ANSWER_LOCKED ||
      !AI_CHARACTERS.includes(character) ||
      !target?.group ||
      !candidate?.word ||
      target.group.classList.contains("revealed") ||
      !isSafelySubmittableAiCandidate(candidate.word, target.length) ||
      !isSafelySubmittableAiCandidate(submittedWord, target.length) ||
      !matchesAiRevealedLetters(submittedWord, target) ||
      hasWrongAiGuessForSlot(target.slotIndex, submittedWord) ||
      getEligibleAiSlots().every((slot) => slot.group !== target.group)
    ) {
      if (currentAttempt.group) clearPreview(currentAttempt.group);
      console.debug("AI GUESS SKIPPED: selected target or candidate is invalid.", {
        word: candidate?.word || "",
        targetSlot: target?.slotIndex,
      });
      if (isHumanPlaytestMode()) {
        logHumanPlaytestTransition('submission-rejected-before-commit', 'invalid-turn-or-token');
        return cancelHumanPlaytestOpportunity('invalid-turn-or-token');
      }
      finishAiGuessOpportunity();
      return false;
    }

    if (isHumanPlaytestMode()) {
      if (isEttinPilotMode()) {
        const currentState = getHumanPlaytestPublicState(target);
        const currentKey = globalThis.GGGHumanPlaytest.boardKey(currentState);
        const valid = globalThis.GGGEttinProvider?.validateCandidate(buildEttinPublicSnapshot(currentState), submittedWord);
        if (candidate.publicBoardKey !== currentKey || !valid?.ok || !currentAiCandidatePool.candidates.some(e => e.normalized === candidate.normalized)) {
          const reason = candidate.publicBoardKey !== currentKey ? 'stale-board' : !valid?.ok ? `public-${valid?.reason || 'invalid'}` : 'candidate-no-longer-in-pool';
          logHumanPlaytestTransition('submission-rejected-before-commit', reason);
          return cancelHumanPlaytestOpportunity(reason);
        }
        logEttinPilot('candidate-revalidated', target, { phase: 'before-submit', selectedGuess: candidate.word });
        emitDiagnosticEvent('ai-decision', { predictionMode: 'ettin-pilot', provider: 'ETTIN', ...candidate.diagnostic,
          targetSlot: target.slotIndex, targetLength: target.length, guessedWord: submittedWord });
      } else {
        const ranking = rankHumanPlaytestPool(currentAiCandidatePool);
        // Recheck the current plausible set as well as letters/rejections. If an
        // asynchronous board change occurred, this opportunity ends; next turn
        // rebuilds every affected assessment. Never submit a stale recommendation.
        if (!ranking || candidate.publicBoardKey !== globalThis.GGGHumanPlaytest.boardKey(ranking.state) ||
            !ranking.band.some(e => e.normalized === candidate.normalized)) {
          const reason = !ranking ? 'empty-band' : candidate.publicBoardKey !== globalThis.GGGHumanPlaytest.boardKey(ranking.state) ? 'stale-board' : 'candidate-no-longer-in-band';
          logHumanPlaytestTransition('submission-rejected-before-commit', reason);
          return cancelHumanPlaytestOpportunity(reason);
        }
        getHumanCandidateProvider().noteAttempt(ranking);
        logPilotCandidate('candidate-revalidated', candidate, target, { phase: 'before-submit' });
        emitDiagnosticEvent('ai-decision', { predictionMode: 'human-playtest', ...candidate.diagnostic,
          targetSlot: target.slotIndex, targetLength: target.length, guessedWord: submittedWord });
      }
    }

    // Final safety boundary: absolute blocks always win, and name-only
    // spellings must still carry a valid name-only admission for this board.
    const blockPolicy = globalThis.vault4Dictionary;
    const blockPolicyProblem = blockPolicy.isAbsolutelyBlocked(submittedWord)
      ? 'absolute-block'
      : isHumanPlaytestMode() && currentAiCandidatePool?.targetSlot?.group !== target?.group
        ? 'target-mismatch'
      : stage1CandidateBlockPolicyProblem(
        candidate,
        currentAiCandidatePool,
        isHumanPlaytestMode() ? getHumanPlaytestPublicState(target) : null,
        submittedWord,
      );
    if (blockPolicyProblem) {
      if (isHumanPlaytestMode()) {
        logHumanPlaytestTransition('submission-rejected-before-commit', blockPolicyProblem);
        return cancelHumanPlaytestOpportunity(blockPolicyProblem);
      }
      finishAiGuessOpportunity();
      return false;
    }

    if (currentAttempt.group && currentAttempt.group !== target.group) clearPreview(currentAttempt.group);
    target.group.classList.add("selected");
    const aiAttempt = createAttempt(target.group, "ai");
    aiAttempt.aiGuessContext = { slotIndex: target.slotIndex, word: submittedWord };
    aiAttempt.typedCharacters = isHumanPlaytestMode()
      ? Array.from(submittedWord.replace(/[^A-Za-z]/g, '')).filter((_, i) => !isBlockRevealed(target.group.querySelectorAll('.letter-block')[i])).join('')
      : submittedWord;
    currentAttempt = aiAttempt;
    renderAttemptPreview(aiAttempt);
    if (isEttinPilotMode()) logEttinPilot('guess-submitted', target, { submittedGuess: submittedWord,
      selectedScore: candidate.score, selectedModelProbability: candidate.modelProbability,
      selectedSelectionProbability: candidate.selectionProbability, selectedRank: candidate.diagnostic?.modelRank });
    else logPilotCandidate('guess-submitted', candidate, target, { submittedGuess: submittedWord });
    submitGuess(aiAttempt, submittedWord, { character });
    return true;
  }

  function hasWrongAiGuessForSlot(slotId, word) {
    const normalizedWord = normalizeAiCandidate(word);
    if (!normalizedWord) return false;
    if (!isHumanPlaytestMode() && aiLogicSettings?.rules?.allowSameWordDifferentSlot === false) {
      return Array.from(wrongAiGuessesBySlot.values()).some((words) => words.has(normalizedWord));
    }
    return wrongAiGuessesBySlot.get(String(slotId))?.has(normalizedWord) || false;
  }

  function recordWrongAiGuessForSlot(slotId, word) {
    const normalizedWord = normalizeAiCandidate(word);
    if (!normalizedWord) return false;
    const key = String(slotId);
    if (!wrongAiGuessesBySlot.has(key)) wrongAiGuessesBySlot.set(key, new Set());
    const words = wrongAiGuessesBySlot.get(key);
    if (words.has(normalizedWord)) return false;
    words.add(normalizedWord);
    return true;
  }

  function clearAiWrongGuessMemory() {
    wrongAiGuessesBySlot.clear();
    resetEttinAttention();
    if (isHumanPlaytestMode()) { globalThis.GGGHumanPlaytest?.reset(); getHumanCandidateProvider()?.reset(); HUMAN_PLAYTEST_TURN.publicClueTimes = new Map(); HUMAN_PLAYTEST_TURN.emptyBoardKey = null; }
  }

  function clearRaisedAiHand() {
    cancelTeacherRecognition();
    Object.values(aiHandIndicators).forEach((indicator) => {
      if (!indicator) return;
      indicator.hidden = true;
      indicator.classList.remove("visible");
      indicator.setAttribute("aria-hidden", "true");
    });
    raisedHandCharacter = null;
  }

  function resetHandRaiseState() {
    if (isHumanPlaytestMode()) { HUMAN_PLAYTEST_TURN.generation++; HUMAN_PLAYTEST_TURN.prepared = null; }
    clearRaisedAiHand();
    humanHandRaised = false;
    recognizedResponder = null;
    currentAiTargetSlot = null;
    currentAiCandidatePool = null;
    currentAiSelectedCandidate = null;
    currentAiAttemptShouldBeCorrect = null;
    handRaiseState = HAND_RAISE_STATES.OPEN;
    setTeacherMessage("");
    updateHumanRaiseHandButton();
  }

  async function recognizeAiResponder(character) {
    if (handRaiseState !== HAND_RAISE_STATES.AI_HAND_PENDING || raisedHandCharacter !== character) return false;
    if (isHumanPlaytestMode()) return recognizePreparedHumanPlaytestResponder(character);
    clearRaisedAiHand();
    recognizedResponder = character;
    emitDiagnosticEvent("teacher-recognition", { responder: character });
    humanHandRaised = false;
    currentAiTargetSlot = chooseAiTargetSlot();
    if (!currentAiTargetSlot) {
      console.debug("AI HAND RESOLVED WITHOUT TARGET: no eligible unsolved puzzle slots.");
      resetHandRaiseState();
      aiGuessNumber += 1;
      aiTurnState = "idle";
      scheduleAiTurn(false);
      return false;
    }
    handRaiseState = HAND_RAISE_STATES.ANSWER_LOCKED;
    cancelAiTurn();
    setTeacherMessage(`Go ahead, ${AI_CHARACTER_NAMES[character]}`);
    updateHumanRaiseHandButton();
    console.debug("AI TARGET SLOT:", currentAiTargetSlot.slotIndex, "Length", currentAiTargetSlot.length);
    try {
      const builtPool = isHumanPlaytestMode() ? await buildHumanPlaytestTurnPool(currentAiTargetSlot) : isAiMaximumAccuracyMode()
        ? await buildMaximumAccuracyAiPool() : await buildAiCandidatePool(currentAiTargetSlot);
      if (handRaiseState === HAND_RAISE_STATES.ANSWER_LOCKED && recognizedResponder === character) {
        currentAiCandidatePool = builtPool;
        if (builtPool) currentAiTargetSlot = builtPool.targetSlot;
        console.debug("AI CANDIDATE POOL BUILT:", {
          candidates: currentAiCandidatePool?.candidates.length || 0,
        });
        if (!currentAiCandidatePool?.candidates.length) {
          console.debug("AI ANSWERING OPPORTUNITY RESOLVED WITHOUT CANDIDATES.");
          resolveCurrentAnswerForTesting();
        } else {
          currentAiSelectedCandidate = chooseFinalAiCandidate(currentAiCandidatePool, aiGuessNumber);
          if (!currentAiSelectedCandidate) {
            console.debug("AI CANDIDATE SELECTION SKIPPED: no valid chance or candidate.");
            resolveCurrentAnswerForTesting();
          } else {
            if (isHumanPlaytestMode()) {
              submitSelectedAiGuess();
              return true;
            }
            try {
              const distribution = getAiCandidateDistribution(currentAiCandidatePool, aiGuessNumber);
              const eligibleSlotsForLog = getEligibleAiSlots();
              const slotWeightsForLog = eligibleSlotsForLog.map((slot) => getAiSlotSelectionWeight(slot, aiGuessNumber <= 6, Array.from(document.querySelectorAll(".word-group"))));
              const slotWeightTotalForLog = slotWeightsForLog.reduce((sum, weight) => sum + weight, 0);
              const selectedEntry = distribution.find((entry) => entry.candidate.normalized === currentAiSelectedCandidate.normalized);
              const targetRoleProfile = inferAiTargetRoles(currentAiTargetSlot);
              emitDiagnosticEvent("ai-decision", {
                predictionMode: isAiMaximumAccuracyMode() ? "maximum-accuracy" : "normal",
                guessNumber: aiGuessNumber,
                character,
                targetSlot: currentAiTargetSlot.slotIndex,
                targetLength: currentAiTargetSlot.length,
                targetSlotWeight: isAiMaximumAccuracyMode() ? null : getAiSlotSelectionWeight(currentAiTargetSlot, aiGuessNumber <= 6, Array.from(document.querySelectorAll(".word-group"))),
                targetSlotProbability: isAiMaximumAccuracyMode() ? 1 : slotWeightTotalForLog > 0 ? slotWeightsForLog[eligibleSlotsForLog.findIndex((slot) => slot.slotIndex === currentAiTargetSlot.slotIndex)] / slotWeightTotalForLog : null,
                targetRoles: targetRoleProfile.ranked.slice(0, 6),
                targetRoleConfidence: targetRoleProfile.confidence,
                candidateCount: currentAiCandidatePool.candidates?.length || 0,
                selectedCandidate: selectedEntry ? {
                  word: selectedEntry.candidate.word,
                  roles: [...classifyAiCandidateWord(selectedEntry.candidate)],
                  sources: selectedEntry.candidate.sources,
                  sourcePrior: selectedEntry.candidate.sourcePrior,
                  priorEvidence: selectedEntry.candidate.priorEvidence,
                  grammarScore: selectedEntry.grammarWeight,
                  heuristicProbability: selectedEntry.heuristicProbability,
                  correctGuessAssistance: selectedEntry.correctChance,
                  finalProbability: selectedEntry.probability,
                } : { word: currentAiSelectedCandidate.word },
                matchedRevealedLetters: matchesAiRevealedLetters(currentAiSelectedCandidate.word, currentAiTargetSlot),
                previouslyRejected: hasWrongAiGuessForSlot(currentAiTargetSlot.slotIndex, currentAiSelectedCandidate.word),
                candidatePreview: distribution.sort((a, b) => b.probability - a.probability).slice(0, 20).map((entry) => ({ word: entry.candidate.word, roles: [...classifyAiCandidateWord(entry.candidate)], sources: entry.candidate.sources, sourcePrior: entry.candidate.sourcePrior, grammarScore: entry.grammarWeight, heuristicProbability: entry.heuristicProbability, finalProbability: entry.probability })),
              });
            } catch (error) { console.debug("Gameplay decision diagnostic failed", error); }
            currentAiAttemptShouldBeCorrect = currentAiSelectedCandidate.isCorrect;
            console.debug("AI CANDIDATE SELECTED INTERNALLY:", {
              source: currentAiSelectedCandidate.sources,
              isCorrect: currentAiSelectedCandidate.isCorrect,
            });
            submitSelectedAiGuess();
          }
        }
      }
    } catch (error) {
      console.error("AI candidate pool could not be built.", error);
      resolveCurrentAnswerForTesting();
    }
    return true;
  }

  function raiseAiHand(character) {
    if (!gameStarted || raisedHandCharacter || handRaiseState !== HAND_RAISE_STATES.OPEN || humanHandRaised) return false;
    if (isHumanPlaytestMode()) {
      const prepared = HUMAN_PLAYTEST_TURN.prepared;
      const problem = !prepared || prepared.character !== character ? 'no-valid-slot' : humanPlaytestCandidateProblem(prepared.pool, prepared.candidate);
      if (problem) return cancelHumanPlaytestOpportunity(problem);
    }
    const indicator = aiHandIndicators[character];
    if (!indicator) return false;
    clearRaisedAiHand();
    raisedHandCharacter = character;
    emitDiagnosticEvent("ai-hand-raised", { character, guessNumber: aiGuessNumber });
    handRaiseState = HAND_RAISE_STATES.AI_HAND_PENDING;
    if (isHumanPlaytestMode()) logHumanPlaytestTransition('hand-raised');
    indicator.hidden = false;
    indicator.classList.add("visible");
    indicator.setAttribute("aria-hidden", "false");
    recognitionTimer = setTimeout(() => { void recognizeAiResponder(character); }, humanPlaytestDelay(750));
    return true;
  }

  function raiseHumanHand() {
    if (!gameStarted || isGameOver || gameEnded || handRaiseState === HAND_RAISE_STATES.ANSWER_LOCKED) return false;
    if (handRaiseState === HAND_RAISE_STATES.AI_HAND_PENDING) {
      if (isHumanPlaytestMode()) { logHumanPlaytestTransition('opportunity-cancelled', 'human-interrupted'); resetHandRaiseState(); }
      else clearRaisedAiHand();
    }
    if (handRaiseState !== HAND_RAISE_STATES.OPEN) return false;
    if (isHumanPlaytestMode()) { HUMAN_PLAYTEST_TURN.generation++; HUMAN_PLAYTEST_TURN.prepared = null; }
    humanHandRaised = true;
    emitDiagnosticEvent("human-hand-raised", { guessNumber: aiGuessNumber });
    recognizedResponder = "human";
    emitDiagnosticEvent("teacher-recognition", { responder: "human" });
    handRaiseState = HAND_RAISE_STATES.ANSWER_LOCKED;
    cancelAiTurn();
    setActiveManualGuesser("human");
    setTeacherMessage("Go ahead!");
    updateHumanRaiseHandButton();
    return true;
  }

  function resolveCurrentAnswerForTesting() {
    if (handRaiseState !== HAND_RAISE_STATES.ANSWER_LOCKED || !recognizedResponder) return false;
    const wasAiAttempt = recognizedResponder !== "human";
    resetHandRaiseState();
    if (wasAiAttempt) aiGuessNumber += 1;
    aiTurnState = "idle";
    if (gameStarted && !isGameOver && !gameEnded) scheduleAiTurn(false);
    return true;
  }

  globalThis.resolveCurrentAnswerForTesting = resolveCurrentAnswerForTesting;
  globalThis.resolveRaisedAiHandForTesting = resolveCurrentAnswerForTesting;
  globalThis.getEligibleAiSlotsForTesting = getEligibleAiSlots;
  globalThis.getUsableWordLengthProfileForTesting = getUsableWordLengthProfile;
  globalThis.getCurrentAiTargetSlotForTesting = () => currentAiTargetSlot;
  globalThis.getCurrentAiCandidatePoolForTesting = () => currentAiCandidatePool;
  globalThis.loadPuzzleAtIndexForTesting = loadPuzzleAtIndex;
  globalThis.buildEttinAttentionPlanForTesting = buildEttinAttentionPlan;
  globalThis.buildEttinPilotTurnPoolForTesting = buildEttinPilotTurnPool;
  globalThis.buildEttinStage3DistributionForTesting = buildEttinStage3Distribution;
  globalThis.chooseEttinStage3CandidateForTesting = chooseEttinStage3Candidate;
  globalThis.getEttinAttentionStateForTesting = () => ETTIN_ATTENTION;
  globalThis.buildAiCandidatePoolForTesting = buildAiCandidatePool;
  globalThis.getCorrectGuessChanceForTesting = getCorrectGuessChance;
  globalThis.chooseFinalAiCandidateForTesting = chooseFinalAiCandidate;
  globalThis.hasWrongAiGuessForSlot = hasWrongAiGuessForSlot;
  globalThis.recordWrongAiGuessForSlot = recordWrongAiGuessForSlot;
  globalThis.clearAiWrongGuessMemory = clearAiWrongGuessMemory;
  globalThis.getHumanPlaytestDelayForTesting = humanPlaytestDelay;
  humanRaiseHandBtn?.addEventListener("click", raiseHumanHand);

  function chooseAiTimingRange(ranges) {
    if (!Array.isArray(ranges) || ranges.length === 0) return null;
    const totalChance = ranges.reduce((total, range) => total + Number(range.chance), 0);
    if (!Number.isFinite(totalChance) || totalChance <= 0) return null;
    let roll = Math.random() * totalChance;
    for (const range of ranges) {
      roll -= Number(range.chance);
      if (roll < 0) return range;
    }
    return ranges[ranges.length - 1];
  }

  function timingSettingsAreUsable() {
    const first = aiLogicSettings?.timing?.firstGuess;
    const later = aiLogicSettings?.timing?.betweenGuesses;
    const valid = (ranges) => Array.isArray(ranges) &&
      ranges.length > 0 &&
      ranges.every((range) => (
        Number.isInteger(range.minSeconds) &&
        Number.isInteger(range.maxSeconds) &&
        range.minSeconds >= 0 &&
        range.minSeconds <= range.maxSeconds &&
        Number.isFinite(range.chance) &&
        range.chance >= 0 &&
        range.chance <= 100
      )) &&
      ranges.reduce((total, range) => total + range.chance, 0) === 100;
    return valid(first) && valid(later);
  }

  function updateStartGameButton() {
    if (!startGameBtn) return;
    startGameBtn.textContent = gameStarted ? "Game Started" : "Start Game";
    startGameBtn.disabled = gameStarted || runtimeCheckInProgress;
  }

  function showRuntimeMarker(status = "ready", serverBuildId = "") {
    if (!runtimeBuildMarker) return;
    const buildId = loadedRuntime?.buildId || "unknown";
    if (status === "stale") {
      runtimeBuildMarker.textContent = `STALE GAME BUILD — page ${buildId}; server ${serverBuildId || "unknown"}. Reload before testing.`;
      runtimeBuildMarker.style.color = "#b00020";
      runtimeBuildMarker.style.fontWeight = "700";
      return;
    }
    if (status === "unavailable") {
      runtimeBuildMarker.textContent = `BUILD ${buildId} — server could not be verified.`;
      runtimeBuildMarker.style.color = "#b00020";
      runtimeBuildMarker.style.fontWeight = "700";
      return;
    }
    runtimeBuildMarker.textContent = `${isHumanPlaytestMode() ? 'HUMAN PLAYTEST ON · ' : ''}${isSituationPilotMode() ? 'SITUATION PILOT · ' : ''}DEV BUILD ${buildId}`;
    runtimeBuildMarker.style.color = "";
    runtimeBuildMarker.style.fontWeight = "";
  }

  async function verifyRuntimeFreshness() {
    if (!loadedRuntime?.gameJsHash || !loadedRuntime?.buildId) {
      showRuntimeMarker("unavailable");
      setMessage("This page has no verified runtime identity. Reload the game before testing.");
      return false;
    }
    try {
      const response = await fetch(`/api/runtime-info?check=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Runtime check failed: ${response.status}`);
      const current = await response.json();
      if (current.gameJsHash !== loadedRuntime.gameJsHash || current.buildId !== loadedRuntime.buildId) {
        showRuntimeMarker("stale", current.buildId);
        setMessage(`STALE GAME BUILD. This page is running ${loadedRuntime.buildId}; the server is running ${current.buildId}. Reload before testing.`);
        return false;
      }
      showRuntimeMarker("ready");
      return true;
    } catch (error) {
      showRuntimeMarker("unavailable");
      setMessage("The current game build could not be verified. Check the local server and reload before testing.");
      console.debug("Runtime freshness check failed", error);
      return false;
    }
  }

  async function startGame() {
    if (gameStarted || runtimeCheckInProgress) return;
    runtimeCheckInProgress = true;
    updateStartGameButton();
    if (!await verifyRuntimeFreshness()) {
      runtimeCheckInProgress = false;
      updateStartGameButton();
      return;
    }
    if (!puzzleArea?.querySelector(".word-group")) {
      setMessage("The puzzle is not ready yet.");
      runtimeCheckInProgress = false;
      updateStartGameButton();
      return;
    }
    if (!aiLogicSettingsLoaded || !timingSettingsAreUsable()) {
      setMessage("AI settings are not ready yet.");
      runtimeCheckInProgress = false;
      updateStartGameButton();
      return;
    }
    cancelAiTurn();
    resetHandRaiseState();
    clearAiWrongGuessMemory();
    aiGuessNumber = 1;
    aiTurnState = "idle";
    gameStarted = true;
    emitDiagnosticEvent("start", {
      ...(isHumanPlaytestMode() ? { predictionMode: 'human-playtest' } : {}),
      puzzleNumber: typeof puzzleList[currentPuzzleIndex] === "string"
        ? Number(String(puzzleList[currentPuzzleIndex]).match(/puzzle-(\d+)/)?.[1] || currentPuzzleIndex + 1)
        : Number(puzzleList[currentPuzzleIndex]?.number || currentPuzzleIndex + 1),
      ...(isHumanPlaytestMode() ? {} : { puzzleText: currentPuzzleText }),
      modeFlags: { humanPlaytestMode: isHumanPlaytestMode(), ettinPilot: isEttinPilotMode(), situationPilot: isSituationPilotMode() },
      runtimeMode: isEttinPilotMode() ? 'ettin-pilot' : isHumanPlaytestMode() ? 'human-playtest' : 'normal',
      puzzleIdentity: { index: currentPuzzleIndex, number: typeof puzzleList[currentPuzzleIndex] === "string" ? Number(String(puzzleList[currentPuzzleIndex]).match(/puzzle-(\d+)/)?.[1] || currentPuzzleIndex + 1) : Number(puzzleList[currentPuzzleIndex]?.number || currentPuzzleIndex + 1), source: typeof puzzleList[currentPuzzleIndex] === "string" ? puzzleList[currentPuzzleIndex] : 'inline-puzzle-list', custom: typeof puzzleList[currentPuzzleIndex] !== 'string' && Boolean(puzzleList[currentPuzzleIndex]?.custom || puzzleList[currentPuzzleIndex]?.source === 'custom') },
      settings: typeof structuredClone === "function" ? structuredClone(aiLogicSettings) : aiLogicSettings,
      runtime: loadedRuntime,
    });
    runtimeCheckInProgress = false;
    updateStartGameButton();
    setMessage("");
    scheduleAiTurn(true);
  }

  startGameBtn?.addEventListener("click", startGame);
  showRuntimeMarker("ready");
  updateStartGameButton();

  function scheduleAiTurn(firstTurn) {
    if (!gameStarted) return;
    if (!aiLogicSettingsLoaded || !timingSettingsAreUsable()) {
      console.error("AI turn engine is paused because timing settings are unavailable or invalid.");
      return;
    }
    if (aiTurnTimer !== null || aiTurnState === "executing" || handRaiseState !== HAND_RAISE_STATES.OPEN || raisedHandCharacter || isGameOver || gameEnded) return;
    const ranges = firstTurn
      ? aiLogicSettings.timing.firstGuess
      : aiLogicSettings.timing.betweenGuesses;
    const range = chooseAiTimingRange(ranges);
    if (!range) return;
    const delaySeconds = range.minSeconds + Math.floor(Math.random() * (range.maxSeconds - range.minSeconds + 1));
    aiTurnState = "waiting";
    aiTurnTimer = setTimeout(() => {
      aiTurnTimer = null;
      runAutomaticStudentTurn();
    }, gameplayPacingDelay(delaySeconds * 1000));
  }

  function runAutomaticStudentTurn() {
    if (!gameStarted || isGameOver || gameEnded || aiTurnState !== "waiting" || handRaiseState !== HAND_RAISE_STATES.OPEN) {
      aiTurnState = "stopped";
      return;
    }
    aiTurnState = "executing";
    const character = AI_CHARACTERS[Math.floor(Math.random() * AI_CHARACTERS.length)];
    if (isHumanPlaytestMode()) { void prepareHumanPlaytestOpportunity(character); return; }
    if (!raiseAiHand(character)) {
      aiTurnState = "stopped";
      return;
    }
    aiTurnState = "idle";
    console.debug("AI HAND RAISED:", AI_CHARACTER_NAMES[character], "Attempt", aiGuessNumber);
  }

  function updatePlayerScore(character) {
    const scoreElement = playerScoreElements[character];
    if (!scoreElement) return;
    scoreElement.textContent = `${playerScores[character] || 0} points`;
  }

  function updateMyPoints() {
    if (myPointsValue) myPointsValue.textContent = `${score} points`;
  }

  function resetPlayerScores() {
    Object.keys(playerScores).forEach((character) => {
      playerScores[character] = 0;
      updatePlayerScore(character);
    });
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
    clearTemporaryPreviewBlocks(group.querySelectorAll(".letter-block"));
    clearCapitalizationEditing(group);
  }

  function clearTemporaryPreviewBlocks(blocks) {
    Array.from(blocks || []).forEach((b) => {
      if (!isBlockRevealed(b)) {
        b.textContent = "";
        b.classList.remove("typing-preview");
      }
    });
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
      !gameStarted ||
      handRaiseState !== HAND_RAISE_STATES.ANSWER_LOCKED ||
      recognizedResponder !== "human" ||
      isAiTurnActive ||
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
    emitStudentEvent("ggg:student-thinking", {
      character: getActiveTestCharacter(),
    });
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
    if (
      !gameStarted ||
      handRaiseState !== HAND_RAISE_STATES.ANSWER_LOCKED ||
      recognizedResponder !== "human"
    ) return false;
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
    finishPendingHintDisplay('game-or-puzzle-ended');
  }

  function showWrongGuessFeedback(attempt, answeringCharacter = "") {
    const feedback = {
      group: attempt.group,
      selectionSource: attempt.selectionSource,
      aiGuessContext: attempt.aiGuessContext || null,
      answeringCharacter,
      blocks: getHiddenBlocks(attempt.group),
      temporaryPreviewBlocks: getHiddenBlocks(attempt.group),
      timer: null,
      displayDuration: answeringCharacter === "human" ? WRONG_GUESS_DISPLAY_MS : humanPlaytestIncorrectGuessDisplayDelay(),
      endsAt: performance.now() + (answeringCharacter === "human" ? WRONG_GUESS_DISPLAY_MS : humanPlaytestIncorrectGuessDisplayDelay()),
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
    if (!attempt.aiGuessContext) {
      attempt.typedCharacters = "";
      renderAttemptPreview(attempt);
    }
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
      if (feedback.aiGuessContext) {
        clearTemporaryPreviewBlocks(feedback.temporaryPreviewBlocks);
        clearCapitalizationEditing(feedback.group);
        currentAttempt = createAttempt();
      }
      finishPendingHintDisplay();
      processWrongGuess(feedback.group, feedback.selectionSource, attempt.hintDiagnostics);
      if (feedback.aiGuessContext) finishAiGuessOpportunity();
      else if (feedback.answeringCharacter === "human") finishHumanGuessOpportunity();
    }, feedback.displayDuration);
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
    {
      flashCapitalizationErrors = true,
      character = getActiveTestCharacter(),
    } = {}
  ) {
    if (!gameStarted) return;
    if (isGameOver) return;
    if (gameEnded) return;
    if (
      handRaiseState !== HAND_RAISE_STATES.ANSWER_LOCKED ||
      !recognizedResponder ||
      character !== recognizedResponder
    ) {
      console.debug("GUESS REJECTED: no matching recognized responder owns this turn.");
      return;
    }
    if (attempt.committedResult || HINT_DISPLAY.pending) return;
    if (attempt !== currentAttempt || !attempt.group) {
      setMessage("Click a word first.");
      return;
    }

    const group = attempt.group;
    const submittedToken = (rawGuess || "").trim();
    // The legacy renderer scores letter blocks. Validate the complete public
    // token first, then adapt its letters to that renderer only in playtest AI.
    const playtestAiToken = isHumanPlaytestMode() && character !== 'human';
    if (playtestAiToken) {
      const slotIndex = Array.from(document.querySelectorAll('.word-group')).indexOf(group);
      const slot = getHumanPlaytestPublicState({ slotIndex }).slots[slotIndex];
      if (!globalThis.GGGHumanPlaytest.matchesToken(submittedToken, slot)) return;
    }
    const guess = playtestAiToken ? submittedToken.replace(/[^A-Za-z]/g, '') : submittedToken;
    if (!guess) return;

    if (isSituationPilotMode() && character === 'human') {
      const target = { slotIndex: Array.from(document.querySelectorAll('.word-group')).indexOf(group) };
      logPilotCandidate('human-candidate-selected', null, target, { selectedGuess: submittedToken, actor: 'human', isAi: false });
      logPilotCandidate('guess-submitted', null, target, { submittedGuess: submittedToken, actor: 'human', isAi: false });
    }
    const actual = getActualWord(group);
    const blocks = Array.from(group.querySelectorAll(".letter-block"));
    const diagnosticBefore = {
      targetSlot: Array.from(document.querySelectorAll(".word-group")).indexOf(group),
      targetLength: blocks.length,
      actualAnswer: actual,
      revealedLetters: blocks.map((block) => isBlockRevealed(block) ? block.textContent : ""),
      neighboringWords: Array.from(document.querySelectorAll(".word-group")).map((candidate) => candidate.classList.contains("revealed") ? getActualWord(candidate) : ""),
    };
    const recordDiagnosticGuess = (result, points, revealedAfter) => {
      if (isSituationPilotMode()) logPilotCandidate('guess-result', character === 'human' ? null : currentAiSelectedCandidate, { slotIndex: diagnosticBefore.targetSlot }, { correctnessAfterSubmission: result, actor: character, isAi: character !== 'human' });
      const hintDiagnostics = applyCommittedHintResult(attempt, result);
      if (isEttinPilotMode() && character !== 'human') noteEttinAttentionCommit(diagnosticBefore.targetSlot, result);
      if (playtestAiToken) logHumanPlaytestTransition("guess-committed");
      emitDiagnosticEvent("guess", {
      ...diagnosticBefore, ...hintDiagnostics, guessedWord: playtestAiToken ? submittedToken : guess, responder: character, isAi: character !== "human", result, points, revealedAfter,
      });
      if (isEttinPilotMode()) logEttinPilot('ettin-public-change', { slotIndex: diagnosticBefore.targetSlot, length: blocks.length }, { cause: 'guess', result });
    };
    
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
      emitStudentEvent("ggg:student-guess", {
        character,
        guess: playtestAiToken ? submittedToken : guess,
        location: group.dataset.wordLocation,
        result: "correct",
        displayDuration: character === "human" ? 2000 : humanPlaytestGuessDisplayDelay(),
      });
      clearPreview(group);

      let newlyRevealed = 0;
      blocks.forEach((b) => {
        if (!isBlockRevealed(b)) newlyRevealed++;
        revealBlock(b);
      });

      const earnedPoints = newlyRevealed * 10;
      recordDiagnosticGuess("correct", earnedPoints, blocks.map((block) => isBlockRevealed(block) ? block.textContent : ""));
      if (character === "human") {
        score += earnedPoints;
        updateMyPoints();
      } else if (Object.prototype.hasOwnProperty.call(playerScores, character)) {
        playerScores[character] += earnedPoints;
        updatePlayerScore(character);
      }

      group.classList.remove("selected");
      group.classList.add("revealed");
      currentAttempt = createAttempt();
      updatePartialUnderlineForGroup(group);
      setMessage("Correct!");

      if (checkWin()) {
        emitDiagnosticEvent("complete", { scores: { ...playerScores, human: score }, winner: getWinnerResultMessage() });
        endGame();
      } else if (character !== "human" && handRaiseState === HAND_RAISE_STATES.ANSWER_LOCKED) {
        setTimeout(() => finishAiGuessOpportunity(), humanPlaytestGuessDisplayDelay());
      } else if (character === "human" && handRaiseState === HAND_RAISE_STATES.ANSWER_LOCKED) {
        finishHumanGuessOpportunity();
      }
      return;
    }

    // ---------- WRONG (VALID) ----------
    emitStudentEvent("ggg:student-guess", {
      character,
      guess: playtestAiToken ? submittedToken : guess,
      location: group.dataset.wordLocation,
      result: "incorrect",
      displayDuration: character === "human" ? 2000 : humanPlaytestIncorrectGuessDisplayDelay(),
    });
    if (isHumanPlaytestMode()) {
      const slot = getHumanPlaytestPublicState({ slotIndex: diagnosticBefore.targetSlot }).slots[diagnosticBefore.targetSlot];
      recordWrongAiGuessForSlot(diagnosticBefore.targetSlot, playtestAiToken ? submittedToken : globalThis.GGGHumanPlaytest.tokenAt(slot, guess));
    } else if (
      character !== "human" &&
      handRaiseState === HAND_RAISE_STATES.ANSWER_LOCKED &&
      currentAiTargetSlot?.group === group
    ) {
      recordWrongAiGuessForSlot(currentAiTargetSlot.slotIndex, guess);
    }
    // Capture the submitted preview before a hint changes public letters.
    // Hint completion is synchronous; the display timer owns only cleanup.
    showWrongGuessFeedback(attempt, character);
    recordDiagnosticGuess("incorrect", 0, blocks.map((block) => isBlockRevealed(block) ? block.textContent : ""));
  }

  function processWrongGuess(group, selectionSource, hintDiagnostics = null) {
    if (selectionSource === "hover") {
      if (hoveredGroup === group) {
        group.classList.add("hovered");
      } else {
        group.classList.remove("selected");
      }
      if (currentAttempt.group === group) currentAttempt = createAttempt();
    }

    if (hintDiagnostics?.hintTriggered) setMessage(hintDiagnostics.hintCompleted ? 'Hint revealed!' : 'No eligible hints remaining.');
    // Display cleanup owns no hint state. A committed result already updated
    // the streak and completed any hint, even if this timer was cancelled.
    if (checkWin()) endGame();
  }

  function applyCommittedHintResult(attempt, result) {
    if (attempt.committedResult || !['correct', 'incorrect'].includes(result)) return attempt.hintDiagnostics || {};
    attempt.committedResult = result;
    const diagnostic = { wrongStreakBefore: strikeCount, hintThreshold: MAX_STRIKES,
      hintTriggered: false, hintCompleted: false, hintTriggeredAtCommit: false, hintPendingDisplay: false };
    if (result === 'correct') { strikeCount = 0; hintRevealCount = 0; }
    else {
      strikeCount++;
      if (strikeCount >= MAX_STRIKES) {
        diagnostic.hintTriggered = true;
        diagnostic.hintTriggeredAtCommit = true;
        const allGroups = document.querySelectorAll('.word-group');
        hintRevealCount++;
        const hint = Hints.evaluate({ allGroups, hintRevealCount });
        const block = hint?.action === 'revealOne' && allGroups[hint.groupIndex]?.querySelectorAll('.letter-block')[hint.letterIndex];
        if (block && !isBlockRevealed(block)) {
          diagnostic.hintLocation = { slot: hint.groupIndex, letterIndex: hint.letterIndex };
          diagnostic.hintId = ++HINT_DISPLAY.sequence;
          diagnostic.hintPendingDisplay = true;
          HINT_DISPLAY.pending = { block, diagnostic };
          // Real guesses have an observation preview. Tests/non-preview callers
          // may apply immediately; neither path advances the counter here.
          if (typeof wrongFeedback === 'undefined' || !wrongFeedback) finishPendingHintDisplay();
        } else diagnostic.hintReason = 'no-unrevealed-letters';
        strikeCount = 0;
      }
    }
    diagnostic.wrongStreakAfter = strikeCount;
    attempt.hintDiagnostics = diagnostic;
    return diagnostic;
  }

  function finishPendingHintDisplay(cancelReason = null) {
    const pending = HINT_DISPLAY.pending;
    if (!pending) return false;
    if (!cancelReason && typeof wrongFeedback !== 'undefined' && wrongFeedback) return false;
    HINT_DISPLAY.pending = null; // release once, before publishing diagnostics
    const { block, diagnostic } = pending;
    const hintSlotIndex = diagnostic.hintLocation?.slot;
    const hintTarget = hintSlotIndex == null ? null : { slotIndex: hintSlotIndex };
    const beforeState = hintTarget ? getHumanPlaytestPublicState(hintTarget) : null;
    const boardKeyBefore = beforeState ? globalThis.GGGHumanPlaytest.boardKey(beforeState) : null;
    diagnostic.hintPendingDisplay = false;
    if (cancelReason || block.isConnected === false) {
      emitDiagnosticEvent('hint-display', { hintId: diagnostic.hintId, hintVisible: false, reason: cancelReason || 'stale-puzzle' });
      return false;
    }
    // The wrong snapshot and temporary text have both been cleared first.
    revealBlock(block);
    diagnostic.hintCompleted = true;
    updateAllPartialUnderlines();
    const afterState = hintTarget ? getHumanPlaytestPublicState(hintTarget) : null;
    const boardKeyAfter = afterState ? globalThis.GGGHumanPlaytest.boardKey(afterState) : null;
    emitDiagnosticEvent('hint-display', { hintId: diagnostic.hintId, wrongPreviewCleared: true,
      hintVisible: true, hintCompleted: true, hintLocation: diagnostic.hintLocation, revealedLetter: block.textContent || null,
      revealedPosition: diagnostic.hintLocation?.letterIndex ?? null, opportunity: HUMAN_PLAYTEST_TURN.opportunity,
      boardKeyBefore, boardKeyAfter });
    if (isEttinPilotMode()) logEttinPilot('ettin-public-change', { slotIndex: diagnostic.hintLocation.slot,
      length: block.closest('.word-group').querySelectorAll('.letter-block').length }, { cause: 'hint', hintId: diagnostic.hintId,
      hintLocation: diagnostic.hintLocation, revealedLetter: block.textContent || null, revealedPosition: diagnostic.hintLocation?.letterIndex ?? null,
      boardKeyBefore, boardKeyAfter, opportunity: HUMAN_PLAYTEST_TURN.opportunity });
    return true;
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
    if (isGameOver || isAiTurnActive) {
      if (isAiTurnActive && isGameplayInputEvent(event)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return;
    }

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
    cancelAiTurn();
    resetHandRaiseState();
    clearAiWrongGuessMemory();
    gameStarted = false;
    updateStartGameButton();
    aiGuessNumber = 1;
    aiTurnState = "idle";
    emitStudentEvent("ggg:student-reset");
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
    setActiveManualGuesser("human");
    updateMyPoints();
    resetPlayerScores();
    gameEnded = false;
    isAiTurnActive = false;
    setMessage("");
    if (endGameBtn) endGameBtn.disabled = false;
    const words = text.split(/\s+/).filter(Boolean);
    const wordLocations = getWordLocations(text);
    let wordLocationIndex = 0;
    applyPuzzleBlockScale(words);

    words.forEach((word) => {
      const group = document.createElement("div");
      group.className = "word-group";
      group.tabIndex = -1;

      if (!/^[A-Za-z]+:$/.test(word)) {
        group.dataset.wordLocation = wordLocations[wordLocationIndex] || "";
        wordLocationIndex += 1;
      }

            group.addEventListener("pointerover", (event) => {
        if (group.contains(event.relatedTarget)) return;
        if (isGameOver || isAiTurnActive) return;
        if (group.classList.contains("revealed")) return;

        hoveredGroup = group;
        if (!getSelectedGroup()) {
          group.classList.add("hovered");
          group.classList.add("selected");
        }
      });

            group.addEventListener("pointerout", (event) => {
        if (isAiTurnActive) return;
        if (group.contains(event.relatedTarget)) return;
        if (hoveredGroup === group) hoveredGroup = null;
        if (group.classList.contains("hovered")) {
          group.classList.remove("hovered");
          group.classList.remove("selected");
        }
      });

            group.addEventListener("click", () => {
        if (isGameOver || isAiTurnActive) return;
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

  // ---------- INIT ----------
  async function init() {
    await loadPuzzleList();
    loadNextPuzzle();
  }

  init();
});
