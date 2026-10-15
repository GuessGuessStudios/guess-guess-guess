const http = require("node:http");
const fs = require("node:fs");
const fsp = fs.promises;
const path = require("node:path");
const { createHash, randomUUID, randomBytes, timingSafeEqual } = require("node:crypto");
const SERVER_REVISION = createHash("sha256").update(fs.readFileSync(__filename)).digest("hex");
let editQueue = Promise.resolve();
let playtestLogQueue = Promise.resolve();

const PROJECT_ROOT = __dirname;
const PUZZLES_DIR = path.join(PROJECT_ROOT, "puzzles");
const IMAGES_DIR = path.join(PROJECT_ROOT, "assets", "images");
const PUZZLE_LIST_PATH = path.join(PUZZLES_DIR, "puzzle-list.json");
const VAULT_1_PATH = path.join(PROJECT_ROOT, "vaults", "vault-1.json");
const VAULT_2_PATH = path.join(PROJECT_ROOT, "vaults", "vault-2.json");
const VAULT_3_PATH = path.join(PROJECT_ROOT, "vaults", "vault-3.json");
const VAULT_5_PATH = path.join(PROJECT_ROOT, "vaults", "vault-5.json");
const AI_SETTINGS_PATH = path.join(PROJECT_ROOT, "ai-logic-settings.json");
const GAMEPLAY_LOGS_DIR = path.join(PROJECT_ROOT, "gameplay-logs");
const GAME_JS_PATH = path.join(PROJECT_ROOT, "game.js");
const FORENSIC_RUNTIME_FILES = {
  gameJs: GAME_JS_PATH,
  humanPlaytestJs: path.join(PROJECT_ROOT, "human-playtest.js"),
  ettinProviderJs: path.join(PROJECT_ROOT, "assets", "ettin", "ettin-provider.js"),
  candidateProvidersJs: path.join(PROJECT_ROOT, "candidate-providers.js"),
  languageResource: path.join(PROJECT_ROOT, "assets", "language", "human-playtest-language.json"),
  dictionary: path.join(PROJECT_ROOT, "assets", "dictionary", "en_US-size-60.txt"),
};
const PORT = Number(process.env.PORT || 8765);
const HOST = "127.0.0.1";
const ADMIN_PASSWORD_HASH = process.env.GGG_ADMIN_PASSWORD
  ? createHash("sha256").update(process.env.GGG_ADMIN_PASSWORD).digest() : null;
const ADMIN_SESSION_MS = 8 * 60 * 60 * 1000;
const ADMIN_COOKIE = "ggg_admin_session";
const adminSessions = new Map();

function isLocalAdminRequest(request) {
  const port = request.socket.localPort;
  const host = request.headers.host;
  const localPeer = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.socket.remoteAddress);
  return localPeer && [`127.0.0.1:${port}`, `localhost:${port}`].includes(host) &&
    request.headers.origin === `http://${host}` &&
    (!request.headers["sec-fetch-site"] || request.headers["sec-fetch-site"] === "same-origin");
}

function adminSessionId(request) {
  const cookies = (request.headers.cookie || "").split(";").map(part => part.trim());
  const values = cookies.filter(part => part.startsWith(`${ADMIN_COOKIE}=`));
  if (values.length !== 1) return null;
  const value = values[0].slice(ADMIN_COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(value) ? value : null;
}

function hasAdminSession(request) {
  if (!ADMIN_PASSWORD_HASH) return false;
  const id = adminSessionId(request);
  const expires = adminSessions.get(id);
  if (!expires || expires <= Date.now()) {
    adminSessions.delete(id);
    return false;
  }
  return true;
}

function setAdminCookie(response, id, maxAge) {
  // Local HTTP only; Secure would prevent this cookie working on all supported local hosts.
  response.setHeader("Set-Cookie", `${ADMIN_COOKIE}=${id}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${maxAge}`);
}

async function loginAdmin(request, response) {
  try {
    if (!ADMIN_PASSWORD_HASH || request.headers["content-type"]?.split(";")[0] !== "application/json") {
      sendJson(response, 401, { error: "Administrator login failed." });
      return;
    }
    const payload = JSON.parse((await requestBody(request, 4096)).toString("utf8"));
    if (typeof payload?.password !== "string" ||
        !timingSafeEqual(createHash("sha256").update(payload.password).digest(), ADMIN_PASSWORD_HASH)) {
      sendJson(response, 401, { error: "Administrator login failed." });
      return;
    }
    for (const [id, expires] of adminSessions) {
      if (expires <= Date.now()) adminSessions.delete(id);
    }
    adminSessions.delete(adminSessionId(request));
    if (adminSessions.size >= 100) adminSessions.delete(adminSessions.keys().next().value);
    const id = randomBytes(32).toString("hex");
    adminSessions.set(id, Date.now() + ADMIN_SESSION_MS);
    setAdminCookie(response, id, ADMIN_SESSION_MS / 1000);
    sendJson(response, 200, { ok: true });
  } catch {
    // Never echo parser errors or request contents: they may contain the password.
    sendJson(response, 401, { error: "Administrator login failed." });
  }
}

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
  });
  response.end(JSON.stringify(payload));
}

function getRuntimeInfo() {
  const gameJsHash = createHash("sha256").update(fs.readFileSync(GAME_JS_PATH)).digest("hex");
  const forensicFileHashes = Object.fromEntries(Object.entries(FORENSIC_RUNTIME_FILES)
    .filter(([, filePath]) => fs.existsSync(filePath))
    .map(([name, filePath]) => [name, createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")]));
  return {
    service: "guess-guess-guess",
    root: PROJECT_ROOT,
    serverRevision: SERVER_REVISION,
    gameJsHash,
    buildId: gameJsHash.slice(0, 12),
    forensicFileHashes,
    pid: process.pid,
  };
}

function requestBody(request, maxBytes = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Image is larger than the 25 MB limit"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function puzzleNumberFromPath(value) {
  const match = String(value).match(/puzzle-(\d+)/);
  return match ? Number(match[1]) : 0;
}

async function readPuzzleNumbers() {
  const entries = await fsp.readdir(PUZZLES_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /^puzzle-\d+\.json$/.test(entry.name))
    .map((entry) => puzzleNumberFromPath(entry.name));
}

async function nextPuzzleNumber(legacyNumbers) {
  const fileNumbers = await readPuzzleNumbers();
  const requestedLegacyNumbers = Array.isArray(legacyNumbers)
    ? legacyNumbers.map(Number).filter(Number.isInteger)
    : [];
  return Math.max(0, ...fileNumbers, ...requestedLegacyNumbers) + 1;
}

function deriveVault2Words(text) {
  return String(text)
    .split(/\s+/)
    .map((token) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(Boolean);
}

function normalizeWordSet(words) {
  return new Set(words.map((word) => word.toLocaleLowerCase()));
}

function wordLengthsFromText(text) {
  return new Set(deriveVault2Words(text).map((word) => word.length));
}

function properNounLengths(puzzleNumber, vault1, vault2, vault5) {
  const existing = vault5.puzzles?.[String(puzzleNumber)];
  if (Array.isArray(existing) && existing.length) return new Set(existing.map((word) => word.length));
  const structural = normalizeWordSet(Array.isArray(vault1.words) ? vault1.words : []);
  return new Set((vault2.puzzles?.[String(puzzleNumber)] || [])
    .filter((word) => /^[A-ZÀ-ÖØ-Þ]/.test(word) && !structural.has(word.toLocaleLowerCase()))
    .map((word) => word.length));
}

function safeProjectImagePath(imageReference) {
  if (typeof imageReference !== "string" || !imageReference.startsWith("assets/images/")) return null;
  const imagePath = path.resolve(PROJECT_ROOT, imageReference);
  if (!imagePath.startsWith(`${IMAGES_DIR}${path.sep}`)) return null;
  return imagePath;
}

async function referencedImageByOtherPuzzles(imageReference, editedNumber) {
  const entries = await fsp.readdir(PUZZLES_DIR, { withFileTypes: true });
  const expectedPath = safeProjectImagePath(imageReference);
  if (!expectedPath) return false;
  for (const entry of entries) {
    if (!entry.isFile() || !/^puzzle-\d+\.json$/.test(entry.name)) continue;
    if (puzzleNumberFromPath(entry.name) === editedNumber) continue;
    try {
      const puzzle = JSON.parse(await fsp.readFile(path.join(PUZZLES_DIR, entry.name), "utf8"));
      if (safeProjectImagePath(puzzle.image) === expectedPath) return true;
    } catch {
      // If references cannot be verified, preserve the image.
      return true;
    }
  }
  return false;
}

async function updatePuzzle(request, response) {
  const url = new URL(request.url, `http://${HOST}:${PORT}`);
  const number = Number(url.searchParams.get("number"));
  const text = String(url.searchParams.get("text") || "").trim();
  const extension = String(url.searchParams.get("extension") || "").toLowerCase().replace(/^jpeg$/, "jpg");
  const removeImage = !extension && url.searchParams.get("removeImage") === "1";
  if (!Number.isSafeInteger(number) || number < 1 || !text || (extension && !["jpg", "png"].includes(extension))) {
    sendJson(response, 400, { error: "Invalid puzzle update data" });
    return;
  }

  const puzzleName = `puzzle-${String(number).padStart(3, "0")}`;
  const jsonPath = path.join(PUZZLES_DIR, `${puzzleName}.json`);
  const tempSuffix = `edit-${randomUUID()}`;
  const jsonTempPath = `${jsonPath}.${tempSuffix}`;
  const vault2TempPath = `${VAULT_2_PATH}.${tempSuffix}`;
  const vault3TempPath = `${VAULT_3_PATH}.${tempSuffix}`;
  let imageTempPath = null;
  let imagePath = null;
  let imageCommitted = false;
  let jsonCommitted = false;
  let vault2Committed = false;
  let vault3Committed = false;
  let originalJsonBuffer = null;
  let originalVault2Buffer = null;
  let originalVault3Buffer = null;
  let originalImageBuffer = null;
  let originalImagePath = null;

  try {
    originalJsonBuffer = await fsp.readFile(jsonPath);
    const originalPuzzle = JSON.parse(originalJsonBuffer.toString("utf8"));
    const originalImageReference = originalPuzzle.image || "";
    originalImagePath = safeProjectImagePath(originalImageReference);
    originalImageBuffer = originalImagePath ? await fsp.readFile(originalImagePath) : null;
    const replacementImageExists = Boolean(extension);
    const imageChanged = replacementImageExists || (removeImage && Boolean(originalImageReference));
    if (replacementImageExists) {
      imagePath = path.join(IMAGES_DIR, `${puzzleName}.${extension}`);
      if (imagePath === originalImagePath && await referencedImageByOtherPuzzles(originalImageReference, number)) {
        // Keep a shared file's bytes intact, including same-extension replacements.
        imagePath = path.join(IMAGES_DIR, `${puzzleName}-${tempSuffix}.${extension}`);
      }
      imageTempPath = `${imagePath}.${tempSuffix}`;
      if (imagePath !== originalImagePath) {
        try {
          await fsp.access(imagePath);
          throw new Error("The replacement image filename is already in use");
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }
      const imageData = await requestBody(request);
      if (!imageData.length) throw new Error("Replacement image was empty");
      const mime = request.headers["content-type"]?.split(";")[0];
      const png = imageData.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      const jpeg = imageData[0] === 255 && imageData[1] === 216 && imageData[2] === 255;
      if ((extension === "png" && (!png || mime !== "image/png")) ||
          (extension === "jpg" && (!jpeg || mime !== "image/jpeg"))) {
        throw new Error("Please choose a valid JPG or PNG image.");
      }
      await fsp.writeFile(imageTempPath, imageData);
    }

    const updatedPuzzle = {
      ...originalPuzzle,
      title: originalPuzzle.title || `Puzzle ${String(number).padStart(3, "0")}`,
      text,
      ...(replacementImageExists ? { image: `assets/images/${path.basename(imagePath)}` } : {}),
    };
    if (removeImage) delete updatedPuzzle.image;
    const textChanged = String(originalPuzzle.text || "") !== text;
    if (!textChanged && !imageChanged) {
      sendJson(response, 200, { image: originalImageReference || null, vault3Cleared: false });
      return;
    }
    originalVault2Buffer = await fsp.readFile(VAULT_2_PATH);
    originalVault3Buffer = await fsp.readFile(VAULT_3_PATH);
    const vault2 = JSON.parse(originalVault2Buffer.toString("utf8"));
    const vault3 = JSON.parse(originalVault3Buffer.toString("utf8"));
    if (!vault2.puzzles || typeof vault2.puzzles !== "object" || !vault3.puzzles || typeof vault3.puzzles !== "object") {
      throw new Error("Vault data is invalid");
    }
    if (textChanged) vault2.puzzles[String(number)] = deriveVault2Words(text);
    const vault3Cleared = textChanged || imageChanged;
    if (vault3Cleared) delete vault3.puzzles[String(number)];

    await fsp.writeFile(jsonTempPath, `${JSON.stringify(updatedPuzzle, null, 2)}\n`);
    if (textChanged) await fsp.writeFile(vault2TempPath, `${JSON.stringify(vault2, null, 2)}\n`);
    if (vault3Cleared) await fsp.writeFile(vault3TempPath, `${JSON.stringify(vault3, null, 2)}\n`);
    if (replacementImageExists) {
      await fsp.rename(imageTempPath, imagePath);
      imageCommitted = true;
    }
    await fsp.rename(jsonTempPath, jsonPath);
    jsonCommitted = true;
    if (textChanged) {
      await fsp.rename(vault2TempPath, VAULT_2_PATH);
      vault2Committed = true;
    }
    if (vault3Cleared) {
      await fsp.rename(vault3TempPath, VAULT_3_PATH);
      vault3Committed = true;
    }

    let oldImageDeleted = false;
    if (imageChanged && originalImagePath && originalImagePath !== imagePath) {
      // Cleanup is post-commit: a cleanup failure must not undo a successful save.
      try {
        const shared = await referencedImageByOtherPuzzles(originalImageReference, number);
        if (!shared) {
          await fsp.rm(originalImagePath, { force: true });
          oldImageDeleted = true;
        }
      } catch (error) { console.error("Saved puzzle; retained old image:", error.message); }
    }
    sendJson(response, 200, {
      puzzle: `puzzles/${puzzleName}.json`,
      image: updatedPuzzle.image || null,
      vault2Words: vault2.puzzles[String(number)],
      vault3Cleared,
      oldImageDeleted,
    });
  } catch (error) {
    console.error("Puzzle edit failed:", error);
    await Promise.all([
      jsonTempPath, vault2TempPath, vault3TempPath, imageTempPath,
    ].filter(Boolean).map((file) => fsp.rm(file, { force: true })));
    // Restore committed files from the original bytes if a later commit step failed.
    try {
      if (jsonCommitted) await fsp.writeFile(jsonPath, originalJsonBuffer);
    } catch {}
    try {
      if (vault2Committed) await fsp.writeFile(VAULT_2_PATH, originalVault2Buffer);
    } catch {}
    try {
      if (vault3Committed) await fsp.writeFile(VAULT_3_PATH, originalVault3Buffer);
    } catch {}
    if (imageCommitted && imagePath) {
      try {
        if (imagePath === originalImagePath && originalImageBuffer) await fsp.writeFile(imagePath, originalImageBuffer);
        else await fsp.rm(imagePath, { force: true });
      } catch {}
    }
    sendJson(response, 500, { error: error.message || "Could not update puzzle" });
  }
}

async function updateManualVault(request, response) {
  const url = new URL(request.url, `http://${HOST}:${PORT}`);
  const vaultNumber = Number(url.searchParams.get("vault"));
  const puzzleNumber = Number(url.searchParams.get("number"));
  if (![3, 5].includes(vaultNumber) || !Number.isSafeInteger(puzzleNumber) || puzzleNumber < 1) {
    sendJson(response, 400, { error: "Only Vault 3 or Vault 5 and a valid puzzle number can be edited" });
    return;
  }

  const puzzlePath = path.join(PUZZLES_DIR, `puzzle-${String(puzzleNumber).padStart(3, "0")}.json`);
  const vaultPath = vaultNumber === 3 ? VAULT_3_PATH : VAULT_5_PATH;
  const tempPath = `${vaultPath}.manual-${randomUUID()}`;
  try {
    const [puzzle, vault1, vault2, vault] = await Promise.all([
      fsp.readFile(puzzlePath, "utf8").then(JSON.parse),
      fsp.readFile(VAULT_1_PATH, "utf8").then(JSON.parse),
      fsp.readFile(VAULT_2_PATH, "utf8").then(JSON.parse),
      fsp.readFile(vaultPath, "utf8").then(JSON.parse),
    ]);
    const payload = JSON.parse((await requestBody(request)).toString("utf8"));
    const words = payload?.words;
    if (!Array.isArray(words) || words.some((word) => typeof word !== "string")) {
      throw new Error("Words must be an array of text values");
    }
    const trimmedWords = words.map((word) => word.trim());
    if (trimmedWords.some((word) => !word)) throw new Error("Words cannot be empty");
    const normalizedWords = trimmedWords.map((word) => word.toLocaleLowerCase());
    if (new Set(normalizedWords).size !== normalizedWords.length) {
      throw new Error("Duplicate words are not allowed");
    }
    const correctWords = normalizeWordSet(Array.isArray(vault2.puzzles?.[String(puzzleNumber)])
      ? vault2.puzzles[String(puzzleNumber)] : []);
    if (trimmedWords.some((word) => correctWords.has(word.toLocaleLowerCase()))) {
      throw new Error("A correct Vault 2 word cannot be added here");
    }
    const allowedLengths = vaultNumber === 3
      ? wordLengthsFromText(puzzle.text)
      : properNounLengths(puzzleNumber, vault1, vault2, vault);
    if (trimmedWords.some((word) => !allowedLengths.has(word.length))) {
      throw new Error(`Words must match an allowed ${vaultNumber === 5 ? "proper-noun " : ""}slot length`);
    }
    if (vaultNumber === 3) {
      const structuralWords = normalizeWordSet(Array.isArray(vault1.words) ? vault1.words : []);
      if (trimmedWords.some((word) => structuralWords.has(word.toLocaleLowerCase()))) {
        throw new Error("Vault 1 structural words cannot be added to Vault 3");
      }
    }
    if (!vault.puzzles || typeof vault.puzzles !== "object") throw new Error("Vault data is invalid");
    vault.puzzles[String(puzzleNumber)] = trimmedWords;
    await fsp.writeFile(tempPath, `${JSON.stringify(vault, null, 2)}\n`);
    await fsp.rename(tempPath, vaultPath);
    sendJson(response, 200, { vault: vaultNumber, puzzle: puzzleNumber, words: trimmedWords });
  } catch (error) {
    await fsp.rm(tempPath, { force: true }).catch(() => {});
    sendJson(response, 400, { error: error.message || "Could not update vault" });
  }
}

async function updateAiLogicSettings(request, response) {
  const tempPath = `${AI_SETTINGS_PATH}.tmp-${randomUUID()}`;
  try {
    const payload = JSON.parse((await requestBody(request)).toString("utf8"));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("AI settings must be an object");
    }
    await fsp.writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`);
    await fsp.rename(tempPath, AI_SETTINGS_PATH);
    sendJson(response, 200, { settings: payload });
  } catch (error) {
    await fsp.rm(tempPath, { force: true }).catch(() => {});
    sendJson(response, 400, { error: error.message || "Could not save AI settings" });
  }
}

async function saveGameplayLog(request, response) {
  const payload = JSON.parse((await requestBody(request)).toString("utf8"));
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || !payload.session || !Array.isArray(payload.events)) {
    throw new Error("Gameplay log must contain session and events");
  }
  await fsp.mkdir(GAMEPLAY_LOGS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const sessionId = String(payload.session.sessionId || randomUUID()).replace(/[^a-zA-Z0-9_-]/g, "-");
  const logPath = path.join(GAMEPLAY_LOGS_DIR, `gameplay-${stamp}-${sessionId.slice(0, 8)}.json`);
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;
  await fsp.writeFile(logPath, serialized, { flag: "wx" });
  await fsp.writeFile(path.join(GAMEPLAY_LOGS_DIR, "latest.json"), serialized);
  sendJson(response, 201, { file: `gameplay-logs/${path.basename(logPath)}`, latest: "gameplay-logs/latest.json" });
}

async function saveHumanPlaytestLog(request, response) {
  const payload = JSON.parse((await requestBody(request)).toString('utf8'));
  if (payload?.session?.predictionMode !== 'human-playtest' || !Array.isArray(payload.events) ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(payload.session.sessionId)) throw new Error('Invalid playtest log');
  const directory = path.join(GAMEPLAY_LOGS_DIR, 'human-playtest');
  const file = `gameplay-${payload.session.sessionId}.json`;
  const serialized = JSON.stringify(payload, null, 2) + '\n';
  const operation = playtestLogQueue.then(async () => {
    await fsp.mkdir(directory, { recursive: true });
    for (const name of [file, 'latest.json']) {
      const temporary = path.join(directory, name + '.tmp-' + randomUUID());
      await fsp.writeFile(temporary, serialized);
      await fsp.rename(temporary, path.join(directory, name));
    }
  });
  playtestLogQueue = operation.catch(() => {});
  await operation;
  sendJson(response, 201, { file: `gameplay-logs/human-playtest/${file}` });
}

async function savePuzzle(request, response) {
  const url = new URL(request.url, `http://${HOST}:${PORT}`);
  const number = Number(url.searchParams.get("number"));
  const text = String(url.searchParams.get("text") || "").trim();
  const extension = String(url.searchParams.get("extension") || "").toLowerCase();
  if (!Number.isInteger(number) || number < 1 || !text || !["jpg", "png"].includes(extension)) {
    sendJson(response, 400, { error: "Invalid puzzle or image data" });
    return;
  }

  const puzzleName = `puzzle-${String(number).padStart(3, "0")}`;
  const imagePath = path.join(IMAGES_DIR, `${puzzleName}.${extension}`);
  const jsonPath = path.join(PUZZLES_DIR, `${puzzleName}.json`);
  const imageTempPath = `${imagePath}.tmp-${process.pid}`;
  const jsonTempPath = `${jsonPath}.tmp-${process.pid}`;
  const listTempPath = `${PUZZLE_LIST_PATH}.tmp-${process.pid}`;
  let imageCommitted = false;
  let jsonCommitted = false;

  try {
    const existingNumbers = await readPuzzleNumbers();
    const imageAlreadyExists = await Promise.all(["jpg", "png"].map(async (candidate) => {
      try { await fsp.access(path.join(IMAGES_DIR, `${puzzleName}.${candidate}`)); return true; } catch { return false; }
    }));
    if (existingNumbers.includes(number) || imageAlreadyExists.some(Boolean)) {
      sendJson(response, 409, { error: "That puzzle number already exists" });
      return;
    }
    const imageData = await requestBody(request);
    if (!imageData.length) throw new Error("Image data was empty");

    const puzzle = {
      title: `Puzzle ${String(number).padStart(3, "0")}`,
      text,
      image: `assets/images/${puzzleName}.${extension}`,
    };
    const list = JSON.parse(await fsp.readFile(PUZZLE_LIST_PATH, "utf8"));
    if (!Array.isArray(list) || list.some((entry) => puzzleNumberFromPath(entry) === number)) {
      throw new Error("Puzzle list is invalid or already contains that number");
    }
    list.push(`puzzles/${puzzleName}.json`);

    await fsp.writeFile(imageTempPath, imageData);
    await fsp.writeFile(jsonTempPath, `${JSON.stringify(puzzle, null, 2)}\n`);
    await fsp.writeFile(listTempPath, `${JSON.stringify(list, null, 2)}\n`);
    await fsp.rename(imageTempPath, imagePath);
    imageCommitted = true;
    await fsp.rename(jsonTempPath, jsonPath);
    jsonCommitted = true;
    await fsp.rename(listTempPath, PUZZLE_LIST_PATH);
    sendJson(response, 201, { puzzle: `puzzles/${puzzleName}.json`, image: puzzle.image });
  } catch (error) {
    await Promise.all([imageTempPath, jsonTempPath, listTempPath].map((file) => fsp.rm(file, { force: true })));
    await Promise.all([
      imageCommitted ? fsp.rm(imagePath, { force: true }) : Promise.resolve(),
      jsonCommitted ? fsp.rm(jsonPath, { force: true }) : Promise.resolve(),
    ]);
    sendJson(response, 500, { error: error.message || "Could not save puzzle" });
  }
}

async function serveStatic(request, response, pathname) {
  const relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  const filePath = path.resolve(PROJECT_ROOT, relativePath);
  if (filePath !== PROJECT_ROOT && !filePath.startsWith(`${PROJECT_ROOT}${path.sep}`)) {
    response.writeHead(403); response.end("Forbidden"); return;
  }
  try {
    const stats = await fsp.stat(filePath);
    if (!stats.isFile()) throw new Error("Not a file");
    const extension = path.extname(filePath).toLowerCase();
    const developmentHeaders = [".html", ".js", ".json"].includes(extension)
      ? { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0", "Pragma": "no-cache", "Expires": "0" }
      : {};
    if (relativePath === "index.html") {
      const runtime = getRuntimeInfo();
      const source = await fsp.readFile(filePath, "utf8");
      const pageRuntime = { ...runtime, serverRevisionAtLoad: runtime.serverRevision, pageLoadedAt: new Date().toISOString() };
      const bootstrap = `<script>window.__GGG_RUNTIME__=${JSON.stringify(pageRuntime)};</script>`;
      const versionedGameScript = `<script src="game.js?v=${runtime.buildId}"></script>`;
      const html = source.replace('<script src="game.js"></script>', `${bootstrap}${versionedGameScript}`);
      response.writeHead(200, { "Content-Type": MIME_TYPES[extension] || "application/octet-stream", ...developmentHeaders });
      response.end(html);
      return;
    }
    response.writeHead(200, { "Content-Type": MIME_TYPES[extension] || "application/octet-stream", ...developmentHeaders });
    fs.createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404); response.end("Not found");
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${HOST}:${PORT}`);
  try {
    const adminWrite = (request.method === "POST" && url.pathname === "/api/puzzles") ||
      (request.method === "PUT" && ["/api/puzzles", "/api/vaults", "/api/ai-logic-settings"].includes(url.pathname));
    const adminAuth = request.method === "POST" && ["/api/admin/login", "/api/admin/logout"].includes(url.pathname);
    if ((adminWrite || adminAuth) && !isLocalAdminRequest(request)) {
      sendJson(response, 403, { error: "Administrator request denied." });
      return;
    }
    if (adminWrite && !hasAdminSession(request)) {
      sendJson(response, 401, { error: "Administrator login required." });
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/admin/login") {
      await loginAdmin(request, response);
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/admin/logout") {
      adminSessions.delete(adminSessionId(request));
      setAdminCookie(response, "", 0);
      sendJson(response, 200, { ok: true });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/next-puzzle-number") {
      const legacyNumbers = JSON.parse(url.searchParams.get("legacyNumbers") || "[]");
      sendJson(response, 200, { number: await nextPuzzleNumber(legacyNumbers) });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/server-info") {
      sendJson(response, 200, { ...getRuntimeInfo(), revision: SERVER_REVISION });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/runtime-info") {
      sendJson(response, 200, getRuntimeInfo());
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/puzzles") {
      const operation = editQueue.then(() => savePuzzle(request, response));
      editQueue = operation.catch(() => {});
      await operation;
      return;
    }
    if (request.method === "PUT" && url.pathname === "/api/puzzles") {
      const operation = editQueue.then(() => updatePuzzle(request, response));
      editQueue = operation.catch(() => {});
      await operation;
      return;
    }
    if (request.method === "PUT" && url.pathname === "/api/vaults") {
      const operation = editQueue.then(() => updateManualVault(request, response));
      editQueue = operation.catch(() => {});
      await operation;
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/ai-logic-settings") {
      sendJson(response, 200, JSON.parse(await fsp.readFile(AI_SETTINGS_PATH, "utf8")));
      return;
    }
    if (request.method === "PUT" && url.pathname === "/api/ai-logic-settings") {
      const operation = editQueue.then(() => updateAiLogicSettings(request, response));
      editQueue = operation.catch(() => {});
      await operation;
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/gameplay-logs") {
      await saveGameplayLog(request, response);
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/human-playtest-logs') {
      await saveHumanPlaytestLog(request, response);
      return;
    }
    if (request.method === "GET") {
      await serveStatic(request, response, url.pathname);
      return;
    }
    response.writeHead(405); response.end("Method not allowed");
  } catch (error) {
    sendJson(response, 400, { error: error.message || "Request failed" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Guess Guess Guess running at http://${HOST}:${PORT}`);
});
