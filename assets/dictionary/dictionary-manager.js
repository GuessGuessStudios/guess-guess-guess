// Offline dictionary access for future game features.
// This file is deliberately not loaded by the normal game yet.
(function (global) {
  "use strict";

  const DEFAULT_SOURCE = Object.freeze({
    id: "esdb-en-us-size-60",
    name: "English Speller Database (ESDB / SCOWL)",
    release: "2026.02.25",
    vocabularySize: 60,
    spelling: "American English",
    wordListUrl: "assets/dictionary/en_US-size-60.txt",
  });

  class DictionaryManager {
    constructor(source = DEFAULT_SOURCE) {
      this.source = Object.freeze({ ...source });
      this.acceptedWords = new Set();
      this.wordsByLength = new Map();
      this.properWordsByLength = new Map();
      this.properWords = new Set();
      this.distinctiveProperWords = new Set();
      this.ready = false;
    }

    normalize(word) {
      return String(word ?? "").trim().toLowerCase();
    }

    async load() {
      const response = await fetch(this.source.wordListUrl);
      if (!response.ok) {
        throw new Error(`Dictionary could not be loaded: ${response.status}`);
      }

      this.loadText(await response.text());
      return this;
    }

    loadText(text) {
      const acceptedWords = new Set();
      const wordsByLength = new Map();
      const properWordsByLength = new Map();
      const properWords = new Set();
      const distinctiveProperWords = new Set();

      String(text).split(/\r?\n/).forEach((entry) => {
        const rawEntry = String(entry ?? "").trim();
        const word = this.normalize(rawEntry);
        // Keep the source's capitalized lexical surfaces separately. Normal
        // dictionary acceptance/fallback remains lowercase-only as before.
        if (/^[A-Za-z]+$/.test(rawEntry) && rawEntry !== rawEntry.toLowerCase()) {
          properWords.add(word);
          if (/[A-Z]/.test(rawEntry.slice(1))) distinctiveProperWords.add(word);
          if (!properWordsByLength.has(word.length)) properWordsByLength.set(word.length, []);
          properWordsByLength.get(word.length).push(rawEntry);
        }
        // The source includes uppercase names/acronyms, possessive forms,
        // and dictionary notation. Vault 4 admits ordinary lowercase words
        // made only of letters.
        if (!word || rawEntry !== rawEntry.toLowerCase() || !/^[a-z]+$/.test(word) || acceptedWords.has(word)) return;

        acceptedWords.add(word);

        if (!wordsByLength.has(word.length)) wordsByLength.set(word.length, []);
        wordsByLength.get(word.length).push(word);
      });

      wordsByLength.forEach((words) => Object.freeze(words));
      this.acceptedWords = acceptedWords;
      this.wordsByLength = wordsByLength;
      properWordsByLength.forEach(words => Object.freeze(words));
      this.properWordsByLength = properWordsByLength;
      this.properWords = properWords;
      this.distinctiveProperWords = distinctiveProperWords;
      this.ready = true;
      return this;
    }

    isAccepted(word) {
      this.requireReady();
      return this.acceptedWords.has(this.normalize(word));
    }

    getWordsByLength(letterCount) {
      this.requireReady();
      if (!Number.isInteger(letterCount) || letterCount < 1) return [];
      return this.wordsByLength.get(letterCount) || [];
    }

    getProperWordsByLength(letterCount) {
      this.requireReady();
      return this.properWordsByLength.get(letterCount) || [];
    }

    isProperWord(word) {
      this.requireReady();
      return this.properWords.has(this.normalize(word));
    }

    isDistinctiveProperWord(word) {
      this.requireReady();
      return this.distinctiveProperWords.has(this.normalize(word));
    }

    getStats() {
      this.requireReady();
      return Object.freeze({
        acceptedWordCount: this.acceptedWords.size,
        indexedLengthCount: this.wordsByLength.size,
        source: this.source,
      });
    }

    requireReady() {
      if (!this.ready) throw new Error("DictionaryManager.load() must finish first.");
    }
  }

  global.DictionaryManager = DictionaryManager;
  global.DEFAULT_DICTIONARY_SOURCE = DEFAULT_SOURCE;
})(window);
