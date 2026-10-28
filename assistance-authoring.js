// Shared editor/server validation. This does not participate in inference.
(function (global) {
  'use strict';
  const punctuation = value => value.replace(/[’‘]/g, "'").replace(/[‐‑]/g, '-');
  function slots(text) {
    // renderPuzzle omits speaker labels, but retains punctuation-only groups.
    // Keep those indices even though groups without letters cannot be authored.
    return String(text).split(/\s+/).filter(Boolean).filter(word => !/^[A-Za-z]+:$/.test(word))
      .map((word, slotIndex) => {
        const first = word.search(/[A-Za-z]/);
        const last = word.search(/[A-Za-z][^A-Za-z]*$/);
        const answerToken = first < 0 ? '' : punctuation(word.slice(first, last + 1));
        return { slotIndex, answerToken, length: (answerToken.match(/[A-Za-z]/g) || []).length };
      });
  }
  function validate(value, text) {
    if (!value || value.version !== 1 || value.sourceText !== text || !Array.isArray(value.slots))
      throw new Error('Assistance words must belong to the exact saved sentence. Reload or save the sentence first.');
    const board = slots(text), seen = new Set();
    const entries = value.slots.map(entry => {
      const slot = entry && board[entry.slotIndex];
      if (!entry || !Number.isInteger(entry.slotIndex) || !slot?.length || seen.has(entry.slotIndex) ||
          entry.answerToken !== slot.answerToken || !Array.isArray(entry.wrong) ||
          (entry.pronoun !== undefined && typeof entry.pronoun !== 'boolean'))
        throw new Error('Invalid or duplicate assistance word position. Reload the puzzle.');
      seen.add(entry.slotIndex);
      const words = new Set();
      const shape = token => punctuation(token).replace(/[A-Z]/g, 'A').replace(/[a-z]/g, 'a');
      for (const word of entry.wrong) {
        if (typeof word !== 'string' || !/^[A-Za-z]+(?:['’-][A-Za-z]+)*$/.test(word) ||
            shape(word) !== shape(slot.answerToken) || punctuation(word).toLowerCase() === slot.answerToken.toLowerCase())
          throw new Error(`Position ${slot.slotIndex + 1}: alternatives must be incorrect and match the answer's letter count, capitals and internal punctuation.`);
        words.add(punctuation(word));
      }
      return { slotIndex: slot.slotIndex, answerToken: slot.answerToken, wrong: [...words], pronoun: entry.pronoun === true };
    });
    return { version: 1, sourceText: text, slots: entries };
  }
  const api = Object.freeze({ slots, validate });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.GGGAssistanceAuthoring = api;
})(globalThis);
