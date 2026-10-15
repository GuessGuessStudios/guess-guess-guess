# Upgrade 1 repair language data

## Repair 4

No external data or generated vocabulary was added. The existing Moby POS data
does not supply the complement frames needed here. The following small,
hand-authored general frame inventory is in `human-playtest.js`; it annotates
existing words and their independently licensed inflections:

- Direct transitive: love, like, know, see, visit, want, need, buy, purchase,
  invite, tell, give, carry, use, find, make, read, write, build, hear, remember,
  meet, help.
- Optional transitive: bathe, wash, eat, drink, cook, sing, play, drive, study,
  learn, feel.
- Intransitive: arrive, come, go, happen, sleep, die, rain, swim.
- Prepositional complement: look, live, care, listen, smile, laugh, wait,
  depend, belong, refer; explicit ordinary prepositions are listed alongside
  these entries. LOOK also supports visible object-particle continuations.
- Copular: seem, become, appear, remain. Existing auxiliary/modal morphology
  remains a separate complement constraint.

The closed-class inventory covers articles, determiners, possessives,
quantifiers, coordinators, prepositions, pronouns, auxiliaries, modals, and NOT.
Strong constructions restrict the credible band and increase slot opportunity;
there is no global function-word frequency multiplier. Semantic list/parallel
evidence is soft. Numeral agreement leaves ANY singular/plural uses intact.

Source audit: SBT and XRIVE occur in neither the five manual Repair-3 session
guess records nor the existing dictionary/name inventory; no generating source
was found. Visual overlap could explain the reported strings, but the old logs
cannot prove that. COM is an accepted dictionary noun; the prose route now
excludes a compact abbreviation/domain category (com, org, edu, gov, www, inc,
ltd, etc, approx, dept). CINE joins the marginal standalone combining forms;
MULTI retains that classification. LITE remains admitted with its ordinary
informal adjective reading. Morphology annotates accepted candidates only and
never injects unattested spellings into retrieval.

The hint counter is unchanged. Its fifth-wrong commit now reserves one pending
hint. The 900 ms wrong preview clears before permanent revelation. A separate
`hint-display` event links to the original guess via `hintId`, reports
`wrongPreviewCleared` / `hintVisible`, and persists immediately. Teardown cancels
pending application; an active delayed preview retains its hint until cleanup.

Repair 3 keeps all external resources unchanged. Ordinary verb/base readings
come from the existing curated lexical core and Moby's verb/POS annotations;
secondary noun-to-verb readings remain represented with lower contextual weight.
A compact general person-modifier family and verb/preposition construction
families supplement the existing semantic layer. Five dictionary-admitted
prefix-like forms receive a marginal-standalone annotation; compounds and
supported ordinary noun readings remain available. No puzzle-specific word,
name, phrase, or entity was added. Capitalized title continuations are now
bounded by real sentence punctuation.

The shared hint lifecycle now updates the existing consecutive-wrong streak
at committed results, independent of display cleanup. Correct guesses reset it;
every fifth wrong commit completes one available reveal using `dataset.revealed`
as eligibility, not temporary preview text. Per-guess logs include streak before
and after, threshold, trigger/completion flags, and the public hint location.
Repair-2 logs did not have explicit hint events; they cannot establish the
precise reported 16-wrong gap, although public-letter changes show hints inside
several long wrong streaks. Regression tests reproduce the preview-eligibility
failure and verify the new commit ownership under withheld display callbacks.

`human-playtest-language.json` is an offline, general-language extract. It is
loaded only by human playtest inference. No puzzle, answer, reviewer, experiment,
or gameplay-log data was used to build it.

## Sources and permission

- Grady Ward, **Moby Words II**, Project Gutenberg ebook 3201:
  https://www.gutenberg.org/files/3201/3201-h/3201-h.htm
  `files/compound.txt`, `files/names-m.txt`, `files/names-f.txt` under
  https://www.gutenberg.org/files/3201/
- Grady Ward, **Moby Part-of-Speech II**, Project Gutenberg ebook 3203:
  https://www.gutenberg.org/files/3203/3203-h/3203-h.htm
  https://www.gutenberg.org/files/3203/files/mobypos.txt

Both source documentation pages grant the databases to the public domain
(January 2001). This extract also uses the repository's existing ESDB dictionary
and wordfreq 3.1.1 general familiarity data. The combined extract is distributed
under CC BY-SA 4.0; see `wordfreq-LICENSE.txt`, `wordfreq-NOTICE.md`, and
`../dictionary/ESDB-Copyright.txt` for existing attribution and permissions.

## Deterministic preparation

Run `node tests/build-human-playtest-language.cjs /path/to/moby-downloads`.
The builder reads only those four general source files, the existing dictionary,
and existing general frequency file. Source SHA-256 hashes are embedded in JSON.

- 15,932 lowercase lexical entries: existing-dictionary intersection, Zipf >= 3.
- 1,743 given names: Moby male/female inventory intersected with existing
  title-case dictionary entries, Zipf >= 3. Name familiarity is bounded at 5.5;
  generic surname membership does not admit candidates.
- 64,550 attested bigrams/trigrams: lowercase components, each accepted by the
  existing dictionary with Zipf >= 3.4.
- 13,817 attested hyphenated forms: ordinary dictionary components, Zipf >= 4.

The approximately 1.45 MB JSON is fetched once and indexed in memory. Phrases
are lexical attestations, **not measured phrase frequencies**. A matching phrase
adds bounded support from either side of a blank, within sentence/punctuation
boundaries. Grammar and phrase support for the same reading are not multiplied
at full strength twice. Phrase absence is neutral.

The generated resource also includes `nameSourceMembership`, keyed by the same
lowercase spelling as `names`. Values are `M` for names present only in
`names-m.txt`, `F` for names present only in `names-f.txt`, and `B` for names
present in both. The map records all normalized source spellings, including
those filtered out of `names`; spellings absent from both inventories have no
entry and mean unknown. This metadata does not add names to the existing
filtered `names` map or change authorization or familiarity. These labels
record source-list membership and are not a claim about any person's gender.

The general negative-imperative construction (contracted DO + base verb without
an overt subject) supports "don't worry", "don't panic", and other verbs; no
"worry" lookup rule or custom puzzle phrase was inserted. "Maple syrup", "ice
cream", and "peanut butter" occur naturally in the source extract. Contractions
are generated from closed English pronoun/auxiliary families. Internal apostrophe
and hyphen positions are exact public constraints at retrieval and submission.

## Limits

Repair 2 adds **no external data** and does not regenerate this extract. Runtime
retrieval now retains longer lowercase words already in the ESDB dictionary
even without frequency/POS coverage; these remain low-familiarity alternatives
unless public constraints make them promising. Short-word admission stays
strict. Existing dictionary-capitalized words with general frequency support
are available outside strong given-name positions, including days, demonyms,
and dictionary-listed entities. Unsupported names produce an empty opportunity,
never a fabricated spelling or a hand raised without a prepared candidate.

A small, hand-authored general semantic layer in `human-playtest.js` covers
kinship/people, animals, places, time/day, foods, and things. It supplies soft
local evidence for coordinated noun phrases and ordinary compound readings.
Within-sentence parallel clauses and lists use visible structure, not stored
puzzle sentences. The existing Moby phrase inventory is unchanged; repairs to
object-compound parsing let attested phrases affect both ranking and attention.
These are bounded linguistic heuristics, not a new corpus or discourse system.

Repair 2 logs prepared/raised/recognized/submitted/cancelled AI opportunities.
Only the AI guess observation display changes from 300 ms to 900 ms in playtest
mode; normal display remains 1500 ms and other playtest delays remain at 20%.

The inventory is English/Anglophone oriented and dated; given-name familiarity
uses general word frequency, not demographic name frequency. Some rare words,
names, places, inflections and phrases will be missing. Weak coverage means no
candidate or neutral evidence, not fabrication of letter strings. Local
person/animate cues and agreement are bounded to the visible sentence. This is
not discourse memory or image understanding.
