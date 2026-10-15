(function (global) {
  "use strict";

  const DICTIONARY_SOURCE = "assets/dictionary/en_US-size-60.txt";
  const BLOCKED_SOURCE = "vaults/vault-4-blocked.json";

  class Vault4Dictionary {
    constructor() {
      this.dictionary = new global.DictionaryManager({
        id: "esdb-en-us-size-60",
        name: "Local ESDB dictionary",
        wordListUrl: DICTIONARY_SOURCE,
      });
      this.absoluteBlockedWords = new Set();
      this.recognizedNameOnlyWords = new Set();
      this.ready = false;
      this.readyPromise = null;
    }

    normalize(word) {
      return String(word ?? "").trim().toLowerCase();
    }

    isAbsolutelyBlocked(word) {
      // Fail closed until the shared global list has finished loading.
      return !this.ready || this.absoluteBlockedWords.has(this.normalize(word));
    }

    isRecognizedNameOnlyRestricted(word) {
      return this.ready && this.recognizedNameOnlyWords.has(this.normalize(word));
    }

    canAdmitNameOnlyCandidate(word, { recognizedName = false, targetPermitsName = false } = {}) {
      if (!this.ready || this.isAbsolutelyBlocked(word)) return false;
      if (!this.isRecognizedNameOnlyRestricted(word)) return true;
      return recognizedName === true && targetPermitsName === true;
    }

    filterAbsolutelyBlockedCandidates(candidates) {
      return [...candidates].filter(candidate => !this.isAbsolutelyBlocked(
        typeof candidate === "string" ? candidate : candidate?.word,
      ));
    }

    async load() {
      if (this.readyPromise) return this.readyPromise;
      this.readyPromise = Promise.all([
        this.dictionary.load(),
        fetch(BLOCKED_SOURCE).then((response) => {
          if (!response.ok) throw new Error(`Vault 4 blocked list could not be loaded: ${response.status}`);
          return response.json();
        }),
      ]).then(([, policy]) => {
        if (!Array.isArray(policy.absoluteWords) || !Array.isArray(policy.recognizedNameOnlyWords)) {
          throw new Error("Vault 4 block policy has an invalid format.");
        }
        this.absoluteBlockedWords = new Set(
          policy.absoluteWords.map((word) => this.normalize(word)).filter(Boolean),
        );
        this.recognizedNameOnlyWords = new Set(
          policy.recognizedNameOnlyWords.map((word) => this.normalize(word)).filter(Boolean),
        );
        this.ready = true;
        return this;
      });
      return this.readyPromise;
    }

    getCandidates({
      usableLengths = [],
      vault1Words = [],
      vault2Words = [],
      vault3Words = [],
      vault5Words = [],
      guessedWords = [],
      includeProperNames = false,
    } = {}) {
      if (!this.ready) throw new Error("Vault4Dictionary.load() must finish first.");
      const lengths = new Set(usableLengths.filter((length) => Number.isInteger(length) && length > 0));
      const excluded = new Set([
        ...vault1Words,
        ...vault2Words,
        ...vault3Words,
        ...vault5Words,
        ...guessedWords,
      ].map((word) => this.normalize(word)));
      const candidates = [];
      lengths.forEach((length) => {
        const words = [...this.dictionary.getWordsByLength(length),
          ...(includeProperNames ? this.dictionary.getProperWordsByLength(length) : [])];
        words.forEach((word) => {
          const normalized = this.normalize(word);
          if (!this.isAbsolutelyBlocked(normalized) && !excluded.has(normalized)) {
            candidates.push(word);
          }
        });
      });
      return [...new Set(candidates)];
    }

    getStats() {
      if (!this.ready) throw new Error("Vault4Dictionary.load() must finish first.");
      return {
        dictionaryEntries: this.dictionary.getStats().acceptedWordCount,
        indexedLengths: [...this.dictionary.wordsByLength.keys()].sort((a, b) => a - b),
        blockedWords: this.absoluteBlockedWords.size,
      };
    }
  }

  const vault4Dictionary = new Vault4Dictionary();
  global.Vault4Dictionary = Vault4Dictionary;
  global.vault4Dictionary = vault4Dictionary;
  global.isAbsolutelyBlocked = (word) => vault4Dictionary.isAbsolutelyBlocked(word);
  global.getVault4Candidates = (options) => vault4Dictionary.getCandidates(options);
  global.getVault4Guess = (options) => vault4Dictionary.getCandidates(options)[0] || null;
  global.vault4Ready = vault4Dictionary.load();
})(window);
