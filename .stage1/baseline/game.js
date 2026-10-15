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
  const closeAdminPanelBtn = document.getElementById("closeAdminPanelBtn");
  const adminMainMenu = document.getElementById("adminMainMenu");
  const wordBankPuzzleSelector = document.getElementById("wordBankPuzzleSelector");
  const vault1WordList = document.getElementById("vault1WordList");
  const vault2WordList = document.getElementById("vault2WordList");
  const vault3WordList = document.getElementById("vault3WordList");
  const vault4Status = document.getElementById("vault4Status");
  const vault5WordList = document.getElementById("vault5WordList");
  const vault5Status = document.getElementById("vault5Status");
  const editVault3Btn = document.getElementById("editVault3Btn");
  const vault3EditPanel = document.getElementById("vault3EditPanel");
  const vault3EditWordList = document.getElementById("vault3EditWordList");
  const vault3NewWordInput = document.getElementById("vault3NewWordInput");
  const addVault3WordBtn = document.getElementById("addVault3WordBtn");
  const saveVault3Btn = document.getElementById("saveVault3Btn");
  const cancelVault3Btn = document.getElementById("cancelVault3Btn");
  const vault3EditStatus = document.getElementById("vault3EditStatus");
  const editVault5Btn = document.getElementById("editVault5Btn");
  const vault5EditPanel = document.getElementById("vault5EditPanel");
  const vault5EditWordList = document.getElementById("vault5EditWordList");
  const vault5NewWordInput = document.getElementById("vault5NewWordInput");
  const addVault5WordBtn = document.getElementById("addVault5WordBtn");
  const saveVault5Btn = document.getElementById("saveVault5Btn");
  const cancelVault5Btn = document.getElementById("cancelVault5Btn");
  const vault5EditStatus = document.getElementById("vault5EditStatus");
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
  const aiLogicDashboardForm = document.getElementById("aiLogicDashboardForm");
  const aiLogicStatus = document.getElementById("aiLogicStatus");
  const resetAiLogicBtn = document.getElementById("resetAiLogicBtn");
  const cancelAiLogicBtn = document.getElementById("cancelAiLogicBtn");
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

  function getSettingValue(settings, path) {
    return path.split(".").reduce((value, key) => value?.[key], settings);
  }

  function setSettingValue(settings, path, value) {
    const keys = path.split(".");
    const last = keys.pop();
    const target = keys.reduce((value, key) => value[key], settings);
    target[last] = value;
  }

  function populateAiLogicControls(settings) {
    document.querySelectorAll("#aiLogicDashboardForm [data-setting]").forEach((control) => {
      const value = getSettingValue(settings, control.dataset.setting);
      if (control.type === "checkbox") control.checked = Boolean(value);
      else control.value = value ?? "";
    });
  }

  function collectAiLogicControls() {
    const settings = cloneAiSettings(aiLogicSettings);
    document.querySelectorAll("#aiLogicDashboardForm [data-setting]").forEach((control) => {
      const value = control.type === "checkbox" ? control.checked : Number(control.value);
      setSettingValue(settings, control.dataset.setting, value);
    });
    return settings;
  }

  function validateAiLogicSettings(settings) {
    const percentages = [];
    const validateNumber = (value, label, integer, minimum) => {
      if (!Number.isFinite(value) || (integer && !Number.isInteger(value)) || value < minimum) {
        return label + " must be a" + (integer ? " whole" : "") + " number of at least " + minimum + ".";
      }
      return "";
    };
    const validateRanges = (ranges, label, sumRequired = true) => {
      const errors = [];
      ranges.forEach((range, index) => {
        const min = range.minSeconds ?? range.minLength;
        const max = range.maxSeconds ?? range.maxLength;
        const minimum = range.minSeconds !== undefined ? 0 : 1;
        errors.push(validateNumber(min, label + " range " + (index + 1) + " start", true, minimum));
        if (max !== undefined) {
          errors.push(validateNumber(max, label + " range " + (index + 1) + " end", true, minimum));
          if (Number.isFinite(min) && Number.isFinite(max) && min > max) errors.push(label + " range " + (index + 1) + " starts after it ends.");
        }
        errors.push(validateNumber(range.chance, label + " range " + (index + 1) + " chance", false, 0));
        percentages.push(range.chance);
      });
      const ordered = ranges.map((range) => ({
        min: range.minSeconds ?? range.minLength,
        max: range.maxSeconds ?? range.maxLength,
      })).sort((a, b) => a.min - b.min);
      for (let index = 1; index < ordered.length; index++) {
        if (Number.isFinite(ordered[index - 1].max) && ordered[index - 1].max >= ordered[index].min) {
          errors.push(label + " ranges overlap.");
          break;
        }
      }
      if (sumRequired && ranges.reduce((total, range) => total + range.chance, 0) !== 100) {
        errors.push(label + " percentages must total 100%.");
      }
      return errors.filter(Boolean);
    };
    const errors = [
      ...validateRanges(settings.timing.firstGuess, "First Guess Timing"),
      ...validateRanges(settings.timing.betweenGuesses, "Delay Between Guesses"),
      ...validateRanges(settings.wordLength.early.ranges, "Early word length"),
      ...validateRanges(settings.wordLength.later.ranges, "Later word length"),
    ];
    [...settings.correctGuess.entries, settings.correctGuess.continuation].forEach((entry) => {
      errors.push(validateNumber(entry.fromGuess, "Guess number", true, 1));
      errors.push(validateNumber(entry.chance, "Correct guess chance", false, 0));
      if (entry.chance < 0 || entry.chance > 100) errors.push("Correct guess percentages must be between 0 and 100.");
    });
    const guessNumbers = settings.correctGuess.entries.map((entry) => entry.fromGuess);
    if (new Set(guessNumbers).size !== guessNumbers.length || guessNumbers.some((value, index) => index > 0 && value <= guessNumbers[index - 1])) {
      errors.push("Correct guess numbers must be positive and increasing.");
    }
    if (settings.correctGuess.continuation.fromGuess <= guessNumbers.at(-1)) {
      errors.push("The continuation threshold must be after the listed guess numbers.");
    }
    errors.push(validateNumber(settings.wordLength.early.fromGuess, "Early guess range start", true, 1));
    errors.push(validateNumber(settings.wordLength.early.toGuess, "Early guess range end", true, 1));
    errors.push(validateNumber(settings.wordLength.later.fromGuess, "Later guess range start", true, 1));
    if (settings.wordLength.early.fromGuess > settings.wordLength.early.toGuess) errors.push("Early guess range starts after it ends.");
    if (settings.wordLength.later.fromGuess <= settings.wordLength.early.toGuess) errors.push("Later guess range must start after the early guess range.");
    settings.timing.firstGuess.concat(settings.timing.betweenGuesses).forEach((range) => {
      if (range.chance < 0 || range.chance > 100) errors.push("Timing percentages must be between 0 and 100.");
    });
    settings.wordLength.early.ranges.concat(settings.wordLength.later.ranges).forEach((range) => {
      if (range.chance < 0 || range.chance > 100) errors.push("Word-length percentages must be between 0 and 100.");
    });
    return errors.filter(Boolean)[0] || "";
  }

  async function loadAiLogicSettings() {
    if (!aiLogicDashboardForm) return;
    try {
      const response = await fetch("/api/ai-logic-settings");
      if (!response.ok) throw new Error("Saved AI settings could not be loaded.");
      aiLogicSettings = await response.json();
      aiLogicSettingsLoaded = true;
      populateAiLogicControls(aiLogicSettings);
    } catch (error) {
      aiLogicSettingsLoaded = false;
      aiLogicSettings = cloneAiSettings(AI_LOGIC_DEFAULTS);
      populateAiLogicControls(aiLogicSettings);
      if (aiLogicStatus) aiLogicStatus.textContent = error.message;
    }
  }

  async function saveAiLogicSettings(event) {
    event.preventDefault();
    const settings = collectAiLogicControls();
    const validationError = validateAiLogicSettings(settings);
    if (validationError) {
      if (aiLogicStatus) aiLogicStatus.textContent = validationError;
      return;
    }
    try {
      const response = await fetch("/api/ai-logic-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "AI settings could not be saved.");
      aiLogicSettings = result.settings;
      populateAiLogicControls(aiLogicSettings);
      if (aiLogicStatus) aiLogicStatus.textContent = "AI settings saved.";
    } catch (error) {
      if (aiLogicStatus) aiLogicStatus.textContent = error.message || "AI settings could not be saved.";
    }
  }

  if (aiLogicDashboardForm) {
    aiLogicDashboardForm.addEventListener("submit", saveAiLogicSettings);
    loadAiLogicSettings();
  }
  resetAiLogicBtn?.addEventListener("click", () => {
    populateAiLogicControls(AI_LOGIC_DEFAULTS);
    if (aiLogicStatus) aiLogicStatus.textContent = "Defaults restored. Click Save Settings to keep them.";
  });
  cancelAiLogicBtn?.addEventListener("click", () => {
    populateAiLogicControls(aiLogicSettings);
    if (aiLogicStatus) aiLogicStatus.textContent = "Unsaved changes discarded.";
  });

  let vault1Words = [];

  async function loadGlobalVault1() {
    if (!vault1WordList) return;
    try {
      const response = await fetch("vaults/vault-1.json");
      if (!response.ok) throw new Error(`Vault 1 failed to load: ${response.status}`);
      const vault = await response.json();
      const words = Array.isArray(vault.words) ? vault.words : [];
      vault1Words = words;
      vault1WordList.replaceChildren(...words.map((word) => {
        const item = document.createElement("span");
        item.className = "vault-word";
        item.textContent = word;
        return item;
      }));
    } catch (error) {
      console.error("Vault 1 failed to load.", error);
      vault1WordList.textContent = "Vault 1 words could not be loaded.";
    }
  }

  loadGlobalVault1();

  let vault2ByPuzzle = {};

  function renderVault2() {
    if (!vault2WordList) return;
    const selectedIndex = Number(wordBankPuzzleSelector?.value || 0);
    const source = puzzleList[selectedIndex];
    const puzzleNumber = typeof source === "string"
      ? Number(source.match(/puzzle-(\d+)/)?.[1] || selectedIndex + 1)
      : Number(source?.number || selectedIndex + 1);
    const words = vault2ByPuzzle[String(puzzleNumber)];
    vault2WordList.replaceChildren();
    if (!Array.isArray(words)) {
      vault2WordList.textContent = `No Vault 2 data for Puzzle ${puzzleNumber}.`;
      return;
    }
    words.forEach((word) => {
      const item = document.createElement("span");
      item.className = "vault-word";
      item.textContent = word;
      vault2WordList.appendChild(item);
    });
  }

  async function loadPuzzleVault2() {
    if (!vault2WordList) return;
    try {
      const response = await fetch("vaults/vault-2.json");
      if (!response.ok) throw new Error(`Vault 2 failed to load: ${response.status}`);
      const vault = await response.json();
      vault2ByPuzzle = vault.puzzles && typeof vault.puzzles === "object" ? vault.puzzles : {};
      renderVault2();
    } catch (error) {
      console.error("Vault 2 failed to load.", error);
      vault2WordList.textContent = "Vault 2 words could not be loaded.";
    }
  }

  if (wordBankPuzzleSelector) {
    wordBankPuzzleSelector.addEventListener("change", renderVault2);
  }

  loadPuzzleVault2();

  let vault3ByPuzzle = {};

  function selectedWordBankPuzzleNumber() {
    const selectedIndex = Number(wordBankPuzzleSelector?.value || 0);
    const source = puzzleList[selectedIndex];
    return typeof source === "string"
      ? Number(source.match(/puzzle-(\d+)/)?.[1] || selectedIndex + 1)
      : Number(source?.number || selectedIndex + 1);
  }

  function renderVault3() {
    if (!vault3WordList) return;
    const puzzleNumber = selectedWordBankPuzzleNumber();
    const words = vault3ByPuzzle[String(puzzleNumber)];
    vault3WordList.replaceChildren();
    if (!Array.isArray(words)) {
      vault3WordList.textContent = `No Vault 3 data for Puzzle ${puzzleNumber}.`;
      return;
    }
    words.forEach((word) => {
      const item = document.createElement("span");
      item.className = "vault-word";
      item.textContent = word;
      vault3WordList.appendChild(item);
    });
  }

  async function loadPuzzleVault3() {
    if (!vault3WordList) return;
    try {
      const response = await fetch("vaults/vault-3.json");
      if (!response.ok) throw new Error(`Vault 3 failed to load: ${response.status}`);
      const vault = await response.json();
      vault3ByPuzzle = vault.puzzles && typeof vault.puzzles === "object" ? vault.puzzles : {};
      renderVault3();
    } catch (error) {
      console.error("Vault 3 failed to load.", error);
      vault3WordList.textContent = "Vault 3 words could not be loaded.";
    }
  }

  if (wordBankPuzzleSelector) {
    wordBankPuzzleSelector.addEventListener("change", renderVault3);
  }

  loadPuzzleVault3();

  let vault5ByPuzzle = {};

  function renderVault5() {
    if (!vault5WordList) return;
    const puzzleNumber = selectedWordBankPuzzleNumber();
    const words = vault5ByPuzzle[String(puzzleNumber)];
    vault5WordList.replaceChildren();
    if (!Array.isArray(words)) {
      vault5WordList.textContent = `No Vault 5 data for Puzzle ${puzzleNumber}.`;
      return;
    }
    words.forEach((word) => {
      const item = document.createElement("span");
      item.className = "vault-word";
      item.textContent = word;
      vault5WordList.appendChild(item);
    });
  }

  async function loadPuzzleVault5() {
    if (!vault5WordList) return;
    try {
      const response = await fetch("vaults/vault-5.json");
      if (!response.ok) throw new Error(`Vault 5 failed to load: ${response.status}`);
      const vault = await response.json();
      vault5ByPuzzle = vault.puzzles && typeof vault.puzzles === "object" ? vault.puzzles : {};
      renderVault5();
    } catch (error) {
      console.error("Vault 5 failed to load.", error);
      vault5WordList.textContent = "Vault 5 words could not be loaded.";
    }
  }

  if (wordBankPuzzleSelector) {
    wordBankPuzzleSelector.addEventListener("change", renderVault5);
  }

  loadPuzzleVault5();

  const manualVaultState = { 3: null, 5: null };
  const manualVaultPuzzle = { 3: null, 5: null };

  function manualVaultConfig(vaultNumber) {
    return vaultNumber === 3
      ? {
        source: vault3ByPuzzle,
        panel: vault3EditPanel,
        button: editVault3Btn,
        list: vault3EditWordList,
        input: vault3NewWordInput,
        status: vault3EditStatus,
        outerStatus: vault3Status,
        add: addVault3WordBtn,
        save: saveVault3Btn,
        cancel: cancelVault3Btn,
      }
      : {
        source: vault5ByPuzzle,
        panel: vault5EditPanel,
        button: editVault5Btn,
        list: vault5EditWordList,
        input: vault5NewWordInput,
        status: vault5EditStatus,
        outerStatus: vault5Status,
        add: addVault5WordBtn,
        save: saveVault5Btn,
        cancel: cancelVault5Btn,
      };
  }

  function renderManualVaultEditor(vaultNumber) {
    const config = manualVaultConfig(vaultNumber);
    if (!config.list || !Array.isArray(manualVaultState[vaultNumber])) return;
    config.list.replaceChildren();
    manualVaultState[vaultNumber].forEach((word, index) => {
      const row = document.createElement("div");
      row.className = "vault-edit-row";
      const label = document.createElement("span");
      label.textContent = word;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Delete";
      remove.addEventListener("click", () => {
        manualVaultState[vaultNumber].splice(index, 1);
        renderManualVaultEditor(vaultNumber);
      });
      row.append(label, remove);
      config.list.appendChild(row);
    });
  }

  function openManualVaultEditor(vaultNumber) {
    const config = manualVaultConfig(vaultNumber);
    const puzzleNumber = selectedWordBankPuzzleNumber();
    manualVaultPuzzle[vaultNumber] = puzzleNumber;
    manualVaultState[vaultNumber] = [...(config.source[String(puzzleNumber)] || [])];
    config.panel?.classList.remove("hidden");
    config.button?.classList.add("hidden");
    if (config.status) config.status.textContent = "";
    if (config.input) config.input.value = "";
    renderManualVaultEditor(vaultNumber);
  }

  function cancelManualVaultEditor(vaultNumber) {
    const config = manualVaultConfig(vaultNumber);
    manualVaultState[vaultNumber] = null;
    manualVaultPuzzle[vaultNumber] = null;
    config.panel?.classList.add("hidden");
    config.button?.classList.remove("hidden");
    if (config.status) config.status.textContent = "";
    if (config.input) config.input.value = "";
  }

  function addManualVaultWord(vaultNumber) {
    const config = manualVaultConfig(vaultNumber);
    const word = config.input?.value.trim() || "";
    if (!word) {
      if (config.status) config.status.textContent = "Enter a word first.";
      return;
    }
    const duplicate = manualVaultState[vaultNumber].some((item) => item.toLocaleLowerCase() === word.toLocaleLowerCase());
    if (duplicate) {
      if (config.status) config.status.textContent = "That word is already listed.";
      return;
    }
    manualVaultState[vaultNumber].push(word);
    config.input.value = "";
    if (config.status) config.status.textContent = "Word added. Save Changes to keep it.";
    renderManualVaultEditor(vaultNumber);
  }

  async function saveManualVault(vaultNumber) {
    const config = manualVaultConfig(vaultNumber);
    const puzzleNumber = manualVaultPuzzle[vaultNumber];
    if (!Number.isInteger(puzzleNumber) || !Array.isArray(manualVaultState[vaultNumber])) return;
    if (config.save) config.save.disabled = true;
    if (config.status) config.status.textContent = "Saving changes…";
    try {
      const response = await fetch(`/api/vaults?vault=${vaultNumber}&number=${puzzleNumber}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: manualVaultState[vaultNumber] }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Vault update failed");
      config.source[String(puzzleNumber)] = result.words;
      if (vaultNumber === 3) renderVault3();
      else renderVault5();
      if (config.outerStatus) config.outerStatus.textContent = `Vault ${vaultNumber} updated successfully.`;
      cancelManualVaultEditor(vaultNumber);
    } catch (error) {
      if (config.status) config.status.textContent = error.message || "Vault update failed.";
    } finally {
      if (config.save) config.save.disabled = false;
    }
  }

  editVault3Btn?.addEventListener("click", () => openManualVaultEditor(3));
  addVault3WordBtn?.addEventListener("click", () => addManualVaultWord(3));
  saveVault3Btn?.addEventListener("click", () => saveManualVault(3));
  cancelVault3Btn?.addEventListener("click", () => cancelManualVaultEditor(3));
  editVault5Btn?.addEventListener("click", () => openManualVaultEditor(5));
  addVault5WordBtn?.addEventListener("click", () => addManualVaultWord(5));
  saveVault5Btn?.addEventListener("click", () => saveManualVault(5));
  cancelVault5Btn?.addEventListener("click", () => cancelManualVaultEditor(5));

  async function loadVault4Status() {
    if (!vault4Status || !globalThis.vault4Ready) return;
    try {
      await globalThis.vault4Ready;
      const stats = globalThis.vault4Dictionary.getStats();
      vault4Status.textContent = `Dictionary active · Entries: ${stats.dictionaryEntries.toLocaleString()} · Blocked words: ${stats.blockedWords}`;
    } catch (error) {
      console.error("Vault 4 failed to load.", error);
      vault4Status.textContent = "Dictionary unavailable.";
    }
  }

  loadVault4Status();

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
    adminAccessForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (true) return; // Historical admin access disabled: credential redacted; inference unchanged.
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

  if (closeAdminPanelBtn) closeAdminPanelBtn.addEventListener("click", closeAdminPanel);

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
      if (result.vault2Words && vault2ByPuzzle) vault2ByPuzzle[String(editingPuzzle.number)] = result.vault2Words;
      if (result.vault3Cleared && vault3ByPuzzle) delete vault3ByPuzzle[String(editingPuzzle.number)];
      renderVault2();
      renderVault3();
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

  function refreshWordBankPuzzleSelector() {
    if (!wordBankPuzzleSelector) return;
    const existing = wordBankPuzzleSelector.value;
    wordBankPuzzleSelector.innerHTML = "";
    puzzleList.forEach((source, index) => {
      const number = typeof source === "string"
        ? String(source.match(/puzzle-(\d+)/)?.[1] || index + 1).padStart(3, "0")
        : String(source.number).padStart(3, "0");
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `Puzzle ${number}`;
      wordBankPuzzleSelector.appendChild(option);
    });
    if ([...wordBankPuzzleSelector.options].some((option) => option.value === existing)) {
      wordBankPuzzleSelector.value = existing;
    }
    renderVault2();
    renderVault3();
    renderVault5();
    if (editPuzzlePanel && !editPuzzlePanel.classList.contains("hidden")) populateEditPuzzleSelector();
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
      refreshWordBankPuzzleSelector();
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
      refreshWordBankPuzzleSelector();
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
  function isAiMaximumAccuracyMode() {
    return /(?:^\?|&)aiMode=maximum-accuracy(?:&|$)/.test(window.location?.search || "");
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
        ...(isAiMaximumAccuracyMode() ? {} : { answer: getActualWord(group) }),
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
    return isAiMaximumAccuracyMode() || aiLogicSettings?.rules?.noCaseMistakes ? value.toLocaleLowerCase() : value;
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
    if (!isUsableAiCandidate(word, targetLength)) return false;
    return /^[A-Za-z]+$/.test(String(word).trim());
  }

  function matchesAiRevealedLetters(word, targetSlot) {
    const letters = String(word).toLowerCase();
    return Array.from(targetSlot.group.querySelectorAll(".letter-block")).every((block, index) => (
      !isBlockRevealed(block) || letters[index] === block.textContent.toLowerCase()
    ));
  }

  function applyAiTargetCapitalization(word, targetSlot) {
    const displayWord = String(word ?? "").trim();
    if ((!isAiMaximumAccuracyMode() && aiLogicSettings?.rules?.noCaseMistakes !== true) || !targetSlot?.group) {
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

  function getAiCandidateDistribution(pool, guessNumber) {
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
    const submittedWord = applyAiTargetCapitalization(candidate?.word, target);
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
      finishAiGuessOpportunity();
      return false;
    }

    if (currentAttempt.group && currentAttempt.group !== target.group) clearPreview(currentAttempt.group);
    target.group.classList.add("selected");
    const aiAttempt = createAttempt(target.group, "ai");
    aiAttempt.aiGuessContext = { slotIndex: target.slotIndex, word: submittedWord };
    aiAttempt.typedCharacters = submittedWord;
    currentAttempt = aiAttempt;
    renderAttemptPreview(aiAttempt);
    submitGuess(aiAttempt, submittedWord, { character });
    return true;
  }

  function hasWrongAiGuessForSlot(slotId, word) {
    const normalizedWord = normalizeAiCandidate(word);
    if (!normalizedWord) return false;
    if (aiLogicSettings?.rules?.allowSameWordDifferentSlot === false) {
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
      const builtPool = isAiMaximumAccuracyMode()
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
    const indicator = aiHandIndicators[character];
    if (!indicator) return false;
    clearRaisedAiHand();
    raisedHandCharacter = character;
    emitDiagnosticEvent("ai-hand-raised", { character, guessNumber: aiGuessNumber });
    handRaiseState = HAND_RAISE_STATES.AI_HAND_PENDING;
    indicator.hidden = false;
    indicator.classList.add("visible");
    indicator.setAttribute("aria-hidden", "false");
    recognitionTimer = setTimeout(() => { void recognizeAiResponder(character); }, 750);
    return true;
  }

  function raiseHumanHand() {
    if (!gameStarted || isGameOver || gameEnded || handRaiseState === HAND_RAISE_STATES.ANSWER_LOCKED) return false;
    if (handRaiseState === HAND_RAISE_STATES.AI_HAND_PENDING) clearRaisedAiHand();
    if (handRaiseState !== HAND_RAISE_STATES.OPEN) return false;
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
  globalThis.buildAiCandidatePoolForTesting = buildAiCandidatePool;
  globalThis.getCorrectGuessChanceForTesting = getCorrectGuessChance;
  globalThis.chooseFinalAiCandidateForTesting = chooseFinalAiCandidate;
  globalThis.hasWrongAiGuessForSlot = hasWrongAiGuessForSlot;
  globalThis.recordWrongAiGuessForSlot = recordWrongAiGuessForSlot;
  globalThis.clearAiWrongGuessMemory = clearAiWrongGuessMemory;
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
    runtimeBuildMarker.textContent = `DEV BUILD ${buildId}`;
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
      puzzleNumber: typeof puzzleList[currentPuzzleIndex] === "string"
        ? Number(String(puzzleList[currentPuzzleIndex]).match(/puzzle-(\d+)/)?.[1] || currentPuzzleIndex + 1)
        : Number(puzzleList[currentPuzzleIndex]?.number || currentPuzzleIndex + 1),
      puzzleText: currentPuzzleText,
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
    }, delaySeconds * 1000);
  }

  function runAutomaticStudentTurn() {
    if (!gameStarted || isGameOver || gameEnded || aiTurnState !== "waiting" || handRaiseState !== HAND_RAISE_STATES.OPEN) {
      aiTurnState = "stopped";
      return;
    }
    aiTurnState = "executing";
    const character = AI_CHARACTERS[Math.floor(Math.random() * AI_CHARACTERS.length)];
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
      displayDuration: answeringCharacter === "human" ? WRONG_GUESS_DISPLAY_MS : AI_GUESS_DISPLAY_MS,
      endsAt: performance.now() + (answeringCharacter === "human" ? WRONG_GUESS_DISPLAY_MS : AI_GUESS_DISPLAY_MS),
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
      processWrongGuess(feedback.group, feedback.selectionSource);
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
    if (attempt !== currentAttempt || !attempt.group) {
      setMessage("Click a word first.");
      return;
    }

    const group = attempt.group;
    const guess = (rawGuess || "").trim();
    if (!guess) return;

    const actual = getActualWord(group);
    const blocks = Array.from(group.querySelectorAll(".letter-block"));
    const diagnosticBefore = {
      targetSlot: Array.from(document.querySelectorAll(".word-group")).indexOf(group),
      targetLength: blocks.length,
      actualAnswer: actual,
      revealedLetters: blocks.map((block) => isBlockRevealed(block) ? block.textContent : ""),
      neighboringWords: Array.from(document.querySelectorAll(".word-group")).map((candidate) => candidate.classList.contains("revealed") ? getActualWord(candidate) : ""),
    };
    const recordDiagnosticGuess = (result, points, revealedAfter) => emitDiagnosticEvent("guess", {
      ...diagnosticBefore, guessedWord: guess, responder: character, isAi: character !== "human", result, points, revealedAfter,
    });
    
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
        guess,
        location: group.dataset.wordLocation,
        result: "correct",
        displayDuration: character === "human" ? 2000 : AI_GUESS_DISPLAY_MS,
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

      strikeCount = 0;
      hintRevealCount = 0;

      group.classList.remove("selected");
      group.classList.add("revealed");
      currentAttempt = createAttempt();
      updatePartialUnderlineForGroup(group);
      setMessage("Correct!");

      if (checkWin()) {
        emitDiagnosticEvent("complete", { scores: { ...playerScores, human: score }, winner: getWinnerResultMessage() });
        endGame();
      } else if (character !== "human" && handRaiseState === HAND_RAISE_STATES.ANSWER_LOCKED) {
        setTimeout(() => finishAiGuessOpportunity(), AI_GUESS_DISPLAY_MS);
      } else if (character === "human" && handRaiseState === HAND_RAISE_STATES.ANSWER_LOCKED) {
        finishHumanGuessOpportunity();
      }
      return;
    }

    // ---------- WRONG (VALID) ----------
    emitStudentEvent("ggg:student-guess", {
      character,
      guess,
      location: group.dataset.wordLocation,
      result: "incorrect",
      displayDuration: character === "human" ? 2000 : AI_GUESS_DISPLAY_MS,
    });
    recordDiagnosticGuess("incorrect", 0, blocks.map((block) => isBlockRevealed(block) ? block.textContent : ""));
    if (
      character !== "human" &&
      handRaiseState === HAND_RAISE_STATES.ANSWER_LOCKED &&
      currentAiTargetSlot?.group === group
    ) {
      recordWrongAiGuessForSlot(currentAiTargetSlot.slotIndex, guess);
    }
    showWrongGuessFeedback(attempt, character);
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
      setMessage("Wrong.");
      return;
    }

    // ---------- STRIKE THRESHOLD → HINT ----------
    strikeCount = 0;

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
