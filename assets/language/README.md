# Compact English word-frequency data

`english-frequency.json` is derived from **wordfreq 3.1.1**, by **Robyn Speer**,
at commit `42233e6c36ce792031bcccfa17cdd0cec9af5fa7` in the
[official repository](https://github.com/rspeer/wordfreq/tree/42233e6c36ce792031bcccfa17cdd0cec9af5fa7).

Source: `wordfreq/data/small_en.msgpack.gz`, 124,892 bytes,
SHA-256 `f94a80cba6a3857b260d0666b5432bb7ea9b85315574dee9c306e87f61298247`.
The source data and this adapted table are licensed under
[Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
Retain this attribution, the license link, and the accompanying unchanged
`wordfreq-NOTICE.md` when redistributing the table. `wordfreq-LICENSE.txt`
preserves the upstream software notice; no wordfreq runtime code is installed
or bundled in the game.

Changes: retain lowercase ASCII alphabetic tokens only; convert centibel bin
positions into integer Zipf hundredths; join words within each bin with spaces.
No puzzle text, answer vaults, gameplay labels or evaluation results are inputs.
There are 28,001 words. The JSON is 228,346 bytes (105,201 bytes if gzipped).
The current server serves the JSON uncompressed. Raw input and audit records
are kept under `.stage1/wordfreq-3.1.1/`, outside the runtime loading path.

The English data combines general-language sources. See the upstream notice
for source attributions, including Google Books Ngrams, Wikipedia and
OpenSubtitles. SUBTLEX is freely available data; credit its authors, including
Marc Brysbaert and Boris New (SUBTLEX-US), and Walter J. B. van Heuven,
Pawel Mandera, Emmanuel Keuleers and Marc Brysbaert (SUBTLEX-UK).
The original README, retained with the raw input, supplies the full citations.

Reproduce with `node tests/build-word-frequency.cjs`; verify unchanged output
with `node tests/build-word-frequency.cjs --check`. The converter uses Node's
standard library, never downloads anything, and does not run upstream code.

Maximum mode loads this local file once. Candidate eligibility still comes
from the existing global vault/dictionary system. For a candidate's Zipf
frequency `z`, its one lexical prior is `2 ** (clamp(z, 3, 8) - 3)`, bounded
to 1–32. Missing words receive the positive floor 1. This replaces the
source-budget prior in maximum mode; it is not multiplied by it. The shared
grammar score then combines with this prior in the existing distribution.
The resulting probabilities are model scores, not calibrated success rates.

The small table has a Zipf-3 cutoff and does not distinguish word senses,
capitalization or grammatical roles. It cannot supply collocations or resolve
semantic ambiguity. Normal mode does not load or use this file.
