(function (global) {
  "use strict";

  const SOURCE = "assets/language/proper-noun-bank.json";
  const FORMAT = "ggg-proper-noun-bank-v1";
  const normalize = value => String(value ?? "").normalize("NFC").trim().toLowerCase()
    .replace(/[\u2018\u2019\u02bc\uff07]/g, "'")
    .replace(/[\u2010\u2011]/g, "-");
  const normalizeSurfacePunctuation = value => String(value ?? "").normalize("NFC").trim()
    .replace(/[\u2018\u2019\u02bc\uff07]/g, "'")
    .replace(/[\u2010\u2011]/g, "-");
  const tokenLetters = value => (normalize(value).match(/[a-z]/g) || []).length;
  const singleToken = value => /^[a-z]+(?:['-][a-z]+)*$/.test(normalize(value));

  let resourcePromise = null;
  let revision = null;
  let categories = new Map();
  let activeLookup = new Map();
  let lengthIndex = new Map();

  function validateAndIndex(data) {
    if (!data || data.format !== FORMAT || !Number.isInteger(data.revision) || data.revision < 1 ||
        !Array.isArray(data.categories) || !Array.isArray(data.entries)) {
      throw new Error("Proper-noun bank has an invalid format or top-level structure.");
    }
    const categoryIndex = new Map();
    for (const category of data.categories) {
      if (!category || typeof category.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category.id) ||
          typeof category.label !== "string" || !category.label.trim() || categoryIndex.has(category.id)) {
        throw new Error("Proper-noun bank contains an invalid or duplicate category.");
      }
      categoryIndex.set(category.id, Object.freeze({ id: category.id, label: category.label.trim() }));
    }
    const ids = new Set(), normalizedOwners = new Map(), active = new Map(), entries = [];
    for (const raw of data.entries) {
      if (!raw || typeof raw.id !== "string" || !raw.id.trim() || ids.has(raw.id) ||
          typeof raw.display !== "string" || !raw.display.trim() || typeof raw.active !== "boolean" ||
          !Array.isArray(raw.categories) || !raw.categories.length ||
          raw.categories.some(id => typeof id !== "string" || !categoryIndex.has(id)) ||
          new Set(raw.categories).size !== raw.categories.length ||
          (raw.aliases !== undefined && (!Array.isArray(raw.aliases) || raw.aliases.some(alias => typeof alias !== "string" || !alias.trim()))) ||
          (raw.regionTags !== undefined && (!Array.isArray(raw.regionTags) || raw.regionTags.some(tag => typeof tag !== "string" || !tag.trim()))) ||
          (raw.languageTags !== undefined && (!Array.isArray(raw.languageTags) || raw.languageTags.some(tag => typeof tag !== "string" || !tag.trim()))) ||
          (raw.origin !== undefined && typeof raw.origin !== "string")) {
        throw new Error("Proper-noun bank contains an invalid entry, category reference, or duplicate entry ID.");
      }
      ids.add(raw.id);
      const forms = [...new Set([raw.display, ...(raw.aliases || [])].map(surface => surface.trim().normalize("NFC")))];
      if (forms.some(form => !normalize(form))) throw new Error(`Proper-noun bank entry ${raw.id} has an empty lookup form.`);
      for (const form of forms) {
        const lookup = normalize(form);
        const owner = normalizedOwners.get(lookup);
        if (owner && owner !== raw.id) throw new Error(`Proper-noun bank lookup conflict for “${form}”.`);
        normalizedOwners.set(lookup, raw.id);
      }
      const entry = Object.freeze({
        id: raw.id,
        display: raw.display.trim().normalize("NFC"),
        categories: Object.freeze([...raw.categories]),
        accessCategory: raw.categories[0],
        aliases: Object.freeze([...(raw.aliases || [])].map(alias => alias.trim().normalize("NFC"))),
        active: raw.active,
        regionTags: Object.freeze([...(raw.regionTags || [])]),
        languageTags: Object.freeze([...(raw.languageTags || [])]),
        origin: typeof raw.origin === "string" ? raw.origin : null,
      });
      entries.push(entry);
      if (entry.active) for (const form of forms) active.set(normalize(form), entry);
    }
    const byLength = new Map();
    for (const entry of entries) {
      if (!entry.active) continue;
      const seenForEntry = new Set();
      const sourceSurfaces = [entry.display, ...entry.aliases].sort((left, right) => {
        const asciiPunctuation = value => (value.match(/[\u2018\u2019\u02bc\uff07\u2010\u2011]/g) || []).length;
        return asciiPunctuation(left) - asciiPunctuation(right);
      });
      for (const sourceSurface of sourceSurfaces) {
        const surface = normalizeSurfacePunctuation(sourceSurface);
        const lookup = normalize(surface);
        const caseMask = [...surface].filter(character => /^[A-Za-z]$/.test(character))
          .map(character => character === character.toLowerCase() ? 'l' : 'U').join('');
        const surfaceKey = `${lookup}\u0000${caseMask}`;
        if (!singleToken(lookup) || seenForEntry.has(surfaceKey)) continue;
        seenForEntry.add(surfaceKey);
        const length = tokenLetters(lookup);
        if (!byLength.has(length)) byLength.set(length, []);
        byLength.get(length).push(Object.freeze({ word: lookup, orthographicSurface: surface, entryId: entry.id, display: entry.display,
          categories: entry.categories, accessCategory: entry.accessCategory,
          matchedSurface: surface, bankRevision: data.revision }));
      }
    }
    byLength.forEach(forms => Object.freeze(forms));
    revision = data.revision;
    categories = categoryIndex;
    activeLookup = active;
    lengthIndex = byLength;
  }

  async function ready() {
    if (!resourcePromise) {
      resourcePromise = global.fetch(SOURCE).then(response => {
        if (!response.ok) throw new Error(`Proper-noun bank failed to load: HTTP ${response.status}.`);
        return response.json();
      }).then(validateAndIndex).catch(error => {
        const failure = new Error(`Proper-noun bank unavailable: ${error.message || error}`);
        failure.code = "PROPER_NOUN_BANK_LOAD_FAILED";
        console.error(failure.message);
        throw failure;
      });
    }
    return resourcePromise;
  }

  function resolveProperNounAuthorization(word, { publicEntity = false } = {}) {
    const key = normalize(word);
    const bankEntry = activeLookup.get(key) || null;
    const engine = global.GGGHumanPlaytest;
    const familiarity = Number(engine?.nameFamiliarity?.(key) || 0);
    const sources = [];
    if (bankEntry) sources.push("proper-noun-bank");
    if (familiarity > 0) sources.push("legacy-recognized-name");
    if (publicEntity === true) sources.push("public-entity");
    const authorizationSource = sources[0] || null;
    return {
      authorized: sources.length > 0,
      authorizationSource,
      authorizationSources: sources,
      bankEntryId: bankEntry?.id || null,
      categories: bankEntry ? [...bankEntry.categories] : [],
      accessCategory: bankEntry?.accessCategory || (familiarity > 0 ? "first-names" : publicEntity ? "public-entities" : null),
      matchedSurface: bankEntry ? key : null,
      bankDisplay: bankEntry?.display || null,
      legacyNameFamiliarity: familiarity,
      bankRevision: bankEntry ? revision : null,
    };
  }

  function candidateForms(length) {
    if (!Number.isInteger(length) || length < 1) return [];
    return [...(lengthIndex.get(length) || [])];
  }

  function interleaveByAccessCategory(candidates, boardKey, compare) {
    const groups = new Map();
    for (const candidate of candidates) {
      const category = candidate.properNounAccessCategory || "uncategorized-proper-noun";
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(candidate);
    }
    const names = [...groups.keys()].sort((left, right) => left.localeCompare(right, "en"));
    if (names.length < 2) return candidates;
    for (const queue of groups.values()) {
      const uniqueEntries = new Map();
      for (const candidate of queue) {
        if (!candidate.properNounBankEntryId) continue;
        const previous = uniqueEntries.get(candidate.properNounBankEntryId);
        const canonical = normalize(candidate.properNounBankMatchedSurface) === normalize(candidate.properNounBankDisplay);
        const previousCanonical = previous && normalize(previous.properNounBankMatchedSurface) === normalize(previous.properNounBankDisplay);
        if (!previous || (canonical && !previousCanonical)) uniqueEntries.set(candidate.properNounBankEntryId, candidate);
      }
      const entries = [...uniqueEntries.values()];
      const nonBank = queue.filter(candidate => !candidate.properNounBankEntryId);
      queue.splice(0, queue.length, ...entries, ...nonBank);
      queue.sort(compare);
    }
    let hash = 2166136261;
    for (const character of String(boardKey || "")) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
    const offset = hash % names.length;
    const orderedNames = names.slice(offset).concat(names.slice(0, offset));
    const output = [], cursors = new Map(orderedNames.map(name => [name, 0]));
    while (true) {
      let added = false;
      for (const name of orderedNames) {
        const queue = groups.get(name), cursor = cursors.get(name);
        if (cursor >= queue.length) continue;
        const candidate = queue[cursor];
        cursors.set(name, cursor + 1);
        output.push(candidate);
        added = true;
        // Aliases are separate spellings, but one bank entry gets one place
        // in this category's round-robin stream.
        if (candidate.properNounBankEntryId) {
          let next = cursors.get(name);
          while (next < queue.length && queue[next].properNounBankEntryId === candidate.properNounBankEntryId) next++;
          cursors.set(name, next);
        }
      }
      if (!added) break;
    }
    return output;
  }

  global.GGGProperNounBank = Object.freeze({
    format: FORMAT,
    source: SOURCE,
    normalize,
    ready,
    revision: () => revision,
    categories: () => [...categories.values()],
    lookup: word => activeLookup.get(normalize(word)) || null,
    resolveProperNounAuthorization,
    candidateForms,
    interleaveByAccessCategory,
  });
})(globalThis);
