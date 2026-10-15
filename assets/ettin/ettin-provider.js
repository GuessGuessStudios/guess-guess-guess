import { AutoModelForMaskedLM, AutoTokenizer, env } from './transformers.min.js';

const MODEL_ID = 'onnx-community/ettin-encoder-32m-ONNX';
const MODEL_DTYPE = 'q4';
const EXPERIMENTAL_FIRST_PIECE_ALPHA = 0.60;
const ETTIN_SOFT_MIN_SCORING_ENABLED = true;
const MAX_RESCUE = Math.log(2);
const ETTIN_EXACT_INPUT_REUSE_ENABLED = true;
const ETTIN_EXACT_INPUT_REUSE_LIMIT_BYTES = 16 * 1024 * 1024;
const MASK = '[MASK]';
const MODEL_ROOT = '/assets/ettin/models/';
const WASM_ROOT = new URL('./onnx/', import.meta.url).href;

env.localModelPath = MODEL_ROOT;
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.backends ||= {};
env.backends.onnx ||= {};
env.backends.onnx.wasm ||= {};
env.backends.onnx.wasm.wasmPaths = {
  mjs: new URL('ort-wasm-simd-threaded.mjs', WASM_ROOT).href,
  wasm: new URL('ort-wasm-simd-threaded.wasm', WASM_ROOT).href,
};

let tokenizerPromise;
let modelPromise;
let state = { status: 'not_requested', loadMs: null, error: null };

function emit(detail) {
  try { globalThis.dispatchEvent(new CustomEvent('ggg-ettin-state', { detail })); } catch {}
}

function fail(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  throw error;
}

function idsOf(encoded) {
  if (!encoded?.input_ids?.data) fail('TOKENIZER_OUTPUT', 'Tokenizer returned no input_ids.');
  return Array.from(encoded.input_ids.data, Number);
}

function prefixOf(full, prefix) {
  return prefix.length <= full.length && prefix.every((value, i) => value === full[i]);
}

function occurrences(haystack, needle) {
  const found = [];
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    if (needle.every((value, j) => value === haystack[i + j])) found.push(i);
  }
  return found;
}

async function boundaryPrefix(tokenizer, fullIds, text, end) {
  const raw = text.slice(0, end);
  const direct = idsOf(await tokenizer(raw, { add_special_tokens: false }));
  if (prefixOf(fullIds, direct)) return direct;
  const trimmed = raw.replace(/\s+$/u, '');
  if (trimmed !== raw) {
    const retry = idsOf(await tokenizer(trimmed, { add_special_tokens: false }));
    if (prefixOf(fullIds, retry)) return retry;
  }
  fail('PREFIX_ALIGNMENT', 'Target character boundary is not a tokenizer prefix.', { end });
}

function alphaCount(value) { return Array.from(value).filter(c => /[A-Za-z]/.test(c)).length; }
function coreOf(token) {
  const leading = token.match(/^[^A-Za-z_]+/)?.[0] || '';
  const rest = token.slice(leading.length);
  const trailing = rest.match(/[^A-Za-z_]+$/)?.[0] || '';
  return { leading, core: rest.slice(0, rest.length - trailing.length), trailing };
}
function patternLength(pattern) { return alphaCount(pattern) + Array.from(pattern).filter(c => c === '_').length; }
function partial(pattern) { return /[A-Za-z]/.test(pattern) && /_/.test(pattern); }
function normalized(value) { return String(value).toLocaleLowerCase(); }

function slotMap(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.visible_tokens) || !Array.isArray(snapshot.slots)) fail('INVALID_SNAPSHOT', 'Public snapshot shape is invalid.');
  if (typeof snapshot.target_slot_id !== 'string') fail('MISSING_TARGET_BINDING', 'target_slot_id is required.');
  const ids = new Set(), indexes = new Set(), byId = new Map();
  for (const slot of snapshot.slots) {
    if (!slot || typeof slot !== 'object') fail('INVALID_SLOT', 'Slot binding is not an object.');
    if (typeof slot.slot_id !== 'string' || ids.has(slot.slot_id)) fail('DUPLICATE_SLOT_ID', 'Slot IDs must be unique.');
    if (!Number.isInteger(slot.token_index) || slot.token_index < 0 || slot.token_index >= snapshot.visible_tokens.length) fail('INVALID_TOKEN_INDEX', `${slot.slot_id} has an invalid token_index.`);
    if (indexes.has(slot.token_index)) fail('DUPLICATE_TOKEN_INDEX', 'Token indices must be unique.');
    if (!Number.isInteger(slot.length) || slot.length < 1 || typeof slot.pattern !== 'string' || typeof slot.capitalization !== 'string' || typeof slot.case_pattern !== 'string' || !/^[Ul]+$/.test(slot.case_pattern) || slot.case_pattern.length !== slot.length || typeof slot.punctuation !== 'string' || typeof slot.solved !== 'boolean') fail('INVALID_SLOT_METADATA', `${slot.slot_id} metadata is inconsistent.`);
    const visible = coreOf(String(snapshot.visible_tokens[slot.token_index]));
    if (slot.solved) {
      if (visible.core.includes('_') || alphaCount(visible.core) !== slot.length) fail('SOLVED_SLOT_CONTRADICTION', `${slot.slot_id} solved metadata disagrees with visible text.`);
    } else if (visible.core.toLocaleLowerCase() !== slot.pattern.toLocaleLowerCase() || visible.core.length !== slot.pattern.length || patternLength(slot.pattern) !== slot.length) {
      fail('UNRESOLVED_SLOT_CONTRADICTION', `${slot.slot_id} pattern metadata disagrees with visible text.`);
    }
    ids.add(slot.slot_id); indexes.add(slot.token_index); byId.set(slot.slot_id, slot);
  }
  const target = byId.get(snapshot.target_slot_id);
  if (!target) fail('MISSING_TARGET_BINDING', 'Target slot binding is missing.');
  if (target.solved) fail('SOLVED_TARGET', 'A solved slot cannot be the target.');
  return { byId, target };
}

function validateCandidate(snapshot, candidate) {
  const { target } = slotMap(snapshot);
  if (typeof candidate !== 'string' || !/^[A-Za-z]+(?:['-][A-Za-z]+)*$/.test(candidate)) return { ok: false, reason: 'candidate-not-a-word' };
  const letters = Array.from(candidate).filter(c => /[A-Za-z]/.test(c));
  if (letters.length !== target.length) return { ok: false, reason: 'target-length' };
  const caseFlags = Array.from(target.case_pattern, marker => marker === 'U');
  if (!globalThis.GGGHumanPlaytest?.matchesCasePattern(candidate, caseFlags)) return { ok: false, reason: 'case-pattern-mismatch' };
  const patternLetters = Array.from(target.pattern).filter(c => /[A-Za-z_]/.test(c));
  for (let i = 0; i < patternLetters.length; i++) if (/[A-Za-z]/.test(patternLetters[i]) && letters[i]?.toLocaleLowerCase() !== patternLetters[i].toLocaleLowerCase()) return { ok: false, reason: 'revealed-letter-mismatch' };
  const rejected = new Set([...(snapshot.public_rejections || []), ...(target.public_rejections || [])].map(normalized));
  if (rejected.has(normalized(candidate))) return { ok: false, reason: 'public-rejection' };
  return { ok: true };
}

function renderBoard(snapshot, candidate, suffix = '') {
  const { byId, target } = slotMap(snapshot);
  const valid = validateCandidate(snapshot, candidate);
  if (!valid.ok) fail('CANDIDATE_REJECTED', valid.reason);
  const tokens = [...snapshot.visible_tokens];
  let targetStart = -1, targetEnd = -1, partialNeighborEvidencePresent = false;
  const maskedNeighborTokenIndices = [];
  for (let index = 0; index < tokens.length; index++) {
    const binding = [...byId.values()].find(slot => slot.token_index === index);
    if (!binding) continue;
    const original = tokens[index];
    const parts = coreOf(original);
    if (binding.slot_id === target.slot_id) {
      const rendered = candidate;
      const prefix = tokens.slice(0, index).join(' ');
      targetStart = prefix.length + (index ? 1 : 0) + parts.leading.length;
      targetEnd = targetStart + rendered.length;
      tokens[index] = parts.leading + rendered + parts.trailing;
    } else if (!binding.solved) {
      partialNeighborEvidencePresent ||= partial(binding.pattern);
      maskedNeighborTokenIndices.push(index);
      tokens[index] = parts.leading + MASK + parts.trailing;
    }
  }
  if (targetStart < 0 || targetEnd <= targetStart) fail('TARGET_NOT_RENDERED', 'Target occurrence was not rendered.');
  return { text: tokens.join(' ') + suffix, targetStart, targetEnd, targetIndex: target.token_index, maskedNeighborTokenIndices, partial_neighbor_evidence_present: partialNeighborEvidencePresent, partial_neighbor_evidence_consumed_by_ettin: false };
}

async function locateTargetSpan(tokenizer, rendered) {
  const fullNoSpecial = idsOf(await tokenizer(rendered.text, { add_special_tokens: false }));
  const startPrefix = await boundaryPrefix(tokenizer, fullNoSpecial, rendered.text, rendered.targetStart);
  const endPrefix = await boundaryPrefix(tokenizer, fullNoSpecial, rendered.text, rendered.targetEnd);
  if (endPrefix.length <= startPrefix.length) fail('EMPTY_TARGET_SPAN', 'Target span contains no model tokens.');
  const special = idsOf(await tokenizer(rendered.text));
  const alignment = occurrences(special, fullNoSpecial);
  if (alignment.length !== 1) fail('SPECIAL_ALIGNMENT', `Expected one special-token alignment, found ${alignment.length}.`);
  const offset = alignment[0];
  const span = [offset + startPrefix.length, offset + endPrefix.length];
  if (span[0] < offset || span[1] > offset + fullNoSpecial.length || span[1] <= span[0]) fail('SPAN_BOUNDS', 'Target span is outside the model sequence.');
  return { input: await tokenizer(rendered.text), token_span: span, token_ids: fullNoSpecial.slice(startPrefix.length, endPrefix.length) };
}

function logProbability(logits, position, tokenId, vocabularySize) {
  const offset = position * vocabularySize;
  let max = -Infinity;
  for (let i = 0; i < vocabularySize; i++) max = Math.max(max, Number(logits[offset + i]));
  let sum = 0;
  for (let i = 0; i < vocabularySize; i++) sum += Math.exp(Number(logits[offset + i]) - max);
  return Number(logits[offset + tokenId]) - max - Math.log(sum);
}

function softmax(scores) {
  const max = Math.max(...scores), values = scores.map(score => Math.exp(score - max)), total = values.reduce((a, b) => a + b, 0);
  return values.map(value => value / total);
}

function aggregateBoundedSoftMin(pieceLogProbs) {
  if (pieceLogProbs.length === 1) return pieceLogProbs[0];
  const pieceCount = pieceLogProbs.length;
  const firstPiece = pieceLogProbs[0];
  let weakestPiece = firstPiece, allPiecesEqual = true;
  for (const pieceLogP of pieceLogProbs) {
    weakestPiece = Math.min(weakestPiece, pieceLogP);
    if (pieceLogP !== firstPiece) allPiecesEqual = false;
  }
  if (allPiecesEqual) return firstPiece;
  const tau = MAX_RESCUE / Math.log(pieceCount);
  let sumExp = 0;
  for (const pieceLogP of pieceLogProbs) {
    sumExp += Math.exp(-(pieceLogP - weakestPiece) / tau);
  }
  return weakestPiece + tau * Math.log(pieceCount) - tau * Math.log(sumExp);
}

function exactModelInputKey(input) {
  if (!input || typeof input !== 'object') fail('MODEL_INPUT_CONTRACT', 'Model input must be a tensor map.');
  const names = Object.keys(input).sort();
  if (!names.length) fail('MODEL_INPUT_CONTRACT', 'Model input has no tensors.');
  const canonical = [];
  for (const name of names) {
    const tensor = input[name];
    if (!tensor || typeof tensor.type !== 'string' || !Array.isArray(tensor.dims) || !ArrayBuffer.isView(tensor.data) || tensor.data instanceof DataView) {
      fail('MODEL_INPUT_CONTRACT', `Model input tensor ${name} cannot be represented exactly.`);
    }
    let elementCount = 1;
    for (const dimension of tensor.dims) {
      if (!Number.isSafeInteger(dimension) || dimension < 0) fail('MODEL_INPUT_CONTRACT', `Model input tensor ${name} has invalid dimensions.`);
      elementCount *= dimension;
      if (!Number.isSafeInteger(elementCount)) fail('MODEL_INPUT_CONTRACT', `Model input tensor ${name} dimensions exceed safe bounds.`);
    }
    if (elementCount !== tensor.data.length) fail('MODEL_INPUT_CONTRACT', `Model input tensor ${name} dimensions do not match its data.`);
    const values = Array.from(tensor.data, value => {
      if (typeof value === 'bigint') return value.toString(10);
      if (typeof value !== 'number' || !Number.isFinite(value)) fail('MODEL_INPUT_CONTRACT', `Model input tensor ${name} contains an unsupported value.`);
      return Object.is(value, -0) ? '-0' : String(value);
    });
    canonical.push([name, tensor.type, tensor.data.constructor.name, tensor.dims, values]);
  }
  const key = JSON.stringify(canonical);
  return { key, estimatedKeyBytes: key.length * 2 };
}

function validateLogitsOutput(output, inputIds) {
  const logits = output?.logits;
  if (!(logits?.data instanceof Float32Array) || !Array.isArray(logits.dims) || logits.dims.length !== 3) {
    fail('MODEL_OUTPUT_CONTRACT', 'ETTIN logits must be a rank-three Float32 tensor.');
  }
  const [batchSize, sequenceLength, vocabularySize] = logits.dims;
  if (batchSize !== 1 || sequenceLength !== inputIds.dims[1] || !Number.isSafeInteger(vocabularySize) || vocabularySize < 1 || logits.data.length !== batchSize * sequenceLength * vocabularySize) {
    fail('MODEL_OUTPUT_CONTRACT', 'ETTIN logits dimensions do not match the model input.');
  }
  return { logits, sequenceLength, vocabularySize };
}

function copyMaskedLogitRows(logits, inputIds, maskTokenId, sequenceLength, vocabularySize) {
  const rows = new Map();
  for (let position = 0; position < sequenceLength; position++) {
    if (Number(inputIds.data[position]) !== Number(maskTokenId)) continue;
    const start = position * vocabularySize;
    rows.set(position, new Float32Array(logits.data.subarray(start, start + vocabularySize)));
  }
  return rows;
}

function disposeLogits(output) {
  if (typeof output?.logits?.dispose === 'function') output.logits.dispose();
}

async function ready() {
  if (state.status === 'ready') return { ...state };
  if (state.status === 'failed') throw Object.assign(new Error(state.error?.message || 'ETTIN failed to load.'), state.error);
  state = { status: 'loading', loadMs: null, error: null }; emit({ ...state });
  const started = performance.now();
  try {
    tokenizerPromise ||= AutoTokenizer.from_pretrained(MODEL_ID, { local_files_only: true });
    modelPromise ||= AutoModelForMaskedLM.from_pretrained(MODEL_ID, { dtype: MODEL_DTYPE, local_files_only: true });
    await Promise.all([tokenizerPromise, modelPromise]);
    state = { status: 'ready', loadMs: Number((performance.now() - started).toFixed(3)), error: null };
    emit({ ...state });
    return { ...state };
  } catch (error) {
    state = { status: 'failed', loadMs: Number((performance.now() - started).toFixed(3)), error: { code: error.code || 'MODEL_LOAD_FAILED', message: String(error.message || error) } };
    emit({ ...state });
    throw error;
  }
}

async function scoreCandidatesInternal(snapshot, candidates, suffix = '') {
  const load = await ready();
  const tokenizer = await tokenizerPromise, model = await modelPromise;
  const started = performance.now(), scored = [];
  const reuseCache = new Map();
  const reuseEnabled = ETTIN_EXACT_INPUT_REUSE_ENABLED;
  let retainedPayloadBytes = 0;
  try {
    for (const candidate of candidates) {
      const rendered = renderBoard(snapshot, candidate.word || candidate, suffix);
      const span = await locateTargetSpan(tokenizer, rendered);
      let total = 0, firstPieceLogP = null;
      const pieceLogProbs = ETTIN_SOFT_MIN_SCORING_ENABLED ? [] : null;
      for (let position = span.token_span[0]; position < span.token_span[1]; position++) {
        const maskedOriginals = [];
        let output = null;
        try {
          for (let future = position; future < span.token_span[1]; future++) {
            const original = span.input.input_ids.data[future];
            maskedOriginals.push(original);
            span.input.input_ids.data[future] = BigInt(Number(tokenizer.mask_token_id));
          }
          let pieceLogP;
          if (!reuseEnabled) {
            output = await model(span.input);
            pieceLogP = logProbability(output.logits.data, position, Number(maskedOriginals[0]), output.logits.dims.at(-1));
          } else {
            const inputIdentity = exactModelInputKey(span.input);
            let rows = reuseCache.get(inputIdentity.key);
            if (rows) {
              const row = rows.get(position);
              if (!(row instanceof Float32Array)) fail('MALFORMED_REUSE_ENTRY', `Exact-input cache is missing logits row ${position}.`);
              const targetId = Number(maskedOriginals[0]);
              if (!Number.isInteger(targetId) || targetId < 0 || targetId >= row.length) fail('INVALID_TARGET_TOKEN_ID', 'Target token ID is outside the logits vocabulary.');
              pieceLogP = logProbability(row, 0, targetId, row.length);
            } else {
              output = await model(span.input);
              const validated = validateLogitsOutput(output, span.input.input_ids);
              const targetId = Number(maskedOriginals[0]);
              if (!Number.isInteger(targetId) || targetId < 0 || targetId >= validated.vocabularySize) fail('INVALID_TARGET_TOKEN_ID', 'Target token ID is outside the logits vocabulary.');
              const maskedPositions = [];
              for (let maskedPosition = 0; maskedPosition < validated.sequenceLength; maskedPosition++) {
                if (Number(span.input.input_ids.data[maskedPosition]) === Number(tokenizer.mask_token_id)) maskedPositions.push(maskedPosition);
              }
              if (!maskedPositions.includes(position)) fail('MISSING_MASKED_LOGITS_ROW', `Model input position ${position} was not masked.`);
              const rowBytes = maskedPositions.length * (validated.vocabularySize * Float32Array.BYTES_PER_ELEMENT + 128);
              const retainedBytes = inputIdentity.estimatedKeyBytes + rowBytes + 256;
              if (retainedPayloadBytes + retainedBytes <= ETTIN_EXACT_INPUT_REUSE_LIMIT_BYTES) {
                rows = copyMaskedLogitRows(validated.logits, span.input.input_ids, tokenizer.mask_token_id, validated.sequenceLength, validated.vocabularySize);
                if (!rows.has(position)) fail('MISSING_MASKED_LOGITS_ROW', `Copied logits are missing masked position ${position}.`);
                reuseCache.set(inputIdentity.key, rows);
                retainedPayloadBytes += retainedBytes;
                pieceLogP = logProbability(rows.get(position), 0, targetId, validated.vocabularySize);
              } else {
                pieceLogP = logProbability(validated.logits.data, position, targetId, validated.vocabularySize);
              }
            }
          }
          total += pieceLogP;
          if (pieceLogProbs) pieceLogProbs.push(pieceLogP);
          if (position === span.token_span[0]) firstPieceLogP = pieceLogP;
        } finally {
          maskedOriginals.forEach((original, offset) => { span.input.input_ids.data[position + offset] = original; });
          if (output && reuseEnabled) {
            try { disposeLogits(output); } catch {}
          }
        }
      }
      const pieceCount = span.token_ids.length;
      let score;
      if (ETTIN_SOFT_MIN_SCORING_ENABLED) {
        score = aggregateBoundedSoftMin(pieceLogProbs);
      } else {
        score = total / pieceCount;
        if (EXPERIMENTAL_FIRST_PIECE_ALPHA !== null && pieceCount > 1) {
          const continuationMean = (total - firstPieceLogP) / (pieceCount - 1);
          score = EXPERIMENTAL_FIRST_PIECE_ALPHA * firstPieceLogP + (1 - EXPERIMENTAL_FIRST_PIECE_ALPHA) * continuationMean;
        }
      }
      scored.push({ ...candidate, score, targetSpan: span.token_span, ettinRenderedText: rendered.text, ettinTargetStart: rendered.targetStart, ettinTargetEnd: rendered.targetEnd, ettinMaskedNeighborTokenIndices: rendered.maskedNeighborTokenIndices, partial_neighbor_evidence_present: rendered.partial_neighbor_evidence_present, partial_neighbor_evidence_consumed_by_ettin: false });
    }
    const probabilities = softmax(scored.map(item => item.score));
    scored.forEach((item, i) => { item.probability = probabilities[i]; });
    scored.sort((a, b) => b.probability - a.probability || a.word.localeCompare(b.word));
    scored.forEach((item, i) => { item.rank = i + 1; });
    return { candidates: scored, loadMs: load.loadMs, scoringMs: Number((performance.now() - started).toFixed(3)), status: 'scored' };
  } finally {
    for (const rows of reuseCache.values()) rows.clear();
    reuseCache.clear();
    retainedPayloadBytes = 0;
  }
}

async function scoreCandidates(snapshot, candidates) {
  return scoreCandidatesInternal(snapshot, candidates);
}

async function scoreCandidatesShadow(snapshot, candidates, suffix) {
  if (typeof suffix !== 'string' || !suffix) fail('INVALID_SHADOW_SUFFIX', 'Shadow suffix is required.');
  return scoreCandidatesInternal(snapshot, candidates, suffix);
}

globalThis.GGGEttinProvider = Object.freeze({ version: 'ettin-live-v1', ready, scoreCandidates, scoreCandidatesShadow, validateCandidate, getState: () => ({ ...state }) });
