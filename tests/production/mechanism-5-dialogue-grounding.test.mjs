import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { runProductionTest } from './ggg-test-backbone.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const version = 'adjacent-dialogue-grounding-nomination-v1';
const recognitionType = 'ettin-adjacent-dialogue-grounding-recognition';
const admissionType = 'ettin-adjacent-dialogue-grounding-nomination';
const protectedFiles = ['game.js', 'human-playtest.js', 'public-board.js', 'gameplay-logger.js', 'server.js',
  'ai-logic-settings.json', 'assets/ettin/ettin-provider.js', 'assets/language/human-playtest-language.json',
  'assets/dictionary/en_US-size-60.txt', 'tests/production/ggg-test-backbone.mjs'];
const hashes = async () => Object.fromEntries(await Promise.all(protectedFiles.map(async file =>
  [file, createHash('sha256').update(await readFile(root + file)).digest('hex')])));
function fixture(puzzle) {
  const visibleTokens = puzzle.split(' '), targetSlot = visibleTokens.length - 1;
  const targetLength = visibleTokens[targetSlot].replace(/[^A-Za-z]/g, '').length;
  const setupGuesses = visibleTokens.slice(0, -1).map((token, slot) => ({ slot, word: token.replace(/[^A-Za-z]/g, '') }));
  visibleTokens[targetSlot] = '_'.repeat(targetLength) + '.';
  return { puzzle, setupGuesses, releaseState: { visibleTokens, targetSlot, targetCasePattern: 'l'.repeat(targetLength) } };
}
const cases = [
  { name: 'like-cats', nominee: 'cats', puzzle: 'Do you like cats? Yes, I like cats.' },
  { name: 'like-dogs', nominee: 'dogs', puzzle: 'Do you like dogs? Yes, I like dogs.' },
  { name: 'watch-birds', nominee: 'birds', puzzle: 'Do you watch birds? Yes, I watch birds.' },
  { name: 'eat-apples', nominee: 'apples', puzzle: 'Do you eat apples? Yes, I eat apples.' },
  { name: 'negative-no', reason: 'unsupported-fixed-token', puzzle: 'Do you like cats? No, I like dogs.' },
  { name: 'negative-missing-yes', reason: 'unsupported-target-shape', puzzle: 'Do you like cats? I like dogs.' },
  { name: 'negative-predicate', reason: 'predicate-alignment-unclear', puzzle: 'Do you like cats? Yes, I hate dogs.' },
  { name: 'negative-we', reason: 'unsupported-fixed-token', puzzle: 'Do you like cats? Yes, we like dogs.' },
  { name: 'negative-coordination', reason: 'unsupported-adjacent-source-shape', puzzle: 'Do you like cats or dogs? Yes, I like dogs.' },
  { name: 'negative-intervening', reason: 'unsupported-adjacent-source-shape', puzzle: 'Do you like cats? Birds sing. Yes, I like dogs.' },
  { name: 'hidden-answer-dogs', nominee: 'cats', puzzle: 'Do you like cats? Yes, I like dogs.' },
];

function verify(test, input, result) {
  assert.equal(result.failure, null, JSON.stringify(result.failure));
  assert.equal(result.stopReason, 'referee');
  assert.deepEqual(result.cleanup, { browserClosed: true, serverStopped: true, temporaryArtifactsRemoved: true, errors: [] });
  Object.values(result.errors).forEach(errors => assert.deepEqual(errors, []));
  assert.deepEqual(result.readiness, { pageReady: true, puzzleLoaded: true,
    wordGroupCount: input.releaseState.visibleTokens.length, dictionaryReady: true });
  assert.equal(result.releaseStateReached, true);
  assert.deepEqual(result.releasePublicBoard.visible_tokens, input.releaseState.visibleTokens);
  assert.equal(result.releasePublicBoard.target_slot_id, `slot-${input.releaseState.targetSlot}`);
  result.releasePublicBoard.slots.forEach((slot, i) => {
    assert.equal(slot.solved, i !== input.releaseState.targetSlot); assert.deepEqual(slot.public_rejections, []);
    if (i === input.releaseState.targetSlot) {
      assert.equal(slot.pattern, '_'.repeat(input.releaseState.targetCasePattern.length));
      assert.equal(slot.case_pattern, input.releaseState.targetCasePattern);
    }
  });
  assert.equal(result.setupGuessResults.length, input.setupGuesses.length);
  result.setupGuessResults.forEach((guess, i) => {
    assert.equal(guess.slot, input.setupGuesses[i].slot); assert.equal(guess.word, input.setupGuesses[i].word);
    assert.equal(guess.revealCompleted, true); assert.equal(guess.event.detail.responder, 'human');
    assert.equal(guess.event.detail.result, 'correct');
  });
  assert(!result.events.some(e => e.sequence < result.releaseBoundarySequence &&
    ((e.type === 'guess' && e.detail.isAi) || ['ai-hand-raised', 'stage1-candidate-prepared', 'ettin-input'].includes(e.type))));
  const scoped = result.events.filter(e => e.sequence > result.releaseBoundarySequence &&
    e.detail.publicBoardKey === result.releaseBoardKey && e.detail.opportunityId === result.opportunityId &&
    e.detail.targetSlot === input.releaseState.targetSlot);
  const event = type => {
    const found = scoped.filter(e => e.type === type);
    assert.equal(found.length, 1, `Expected one scoped ${type}`); return found[0];
  };
  const recognition = event(recognitionType), ettinInput = event('ettin-input'), scored = event('ettin-scored');
  const stage3 = event('ettin-stage3-ranked'), selected = event('candidate-selected'), submitted = event('guess-submitted');
  assert.equal(recognition.detail.mechanismVersion, version);
  assert(recognition.sequence < ettinInput.sequence && ettinInput.sequence < scored.sequence &&
    scored.sequence < stage3.sequence && stage3.sequence < selected.sequence && selected.sequence < submitted.sequence);
  assert.equal(result.candidateSelected.sequence, selected.sequence);
  assert.equal(result.guessSubmitted.sequence, submitted.sequence);
  assert.equal(result.refereeResult.detail.isAi, true);
  assert.equal(result.refereeResult.detail.guessedWord, selected.detail.selectedGuess);
  assert.equal(submitted.detail.submittedGuess, selected.detail.selectedGuess);
  assert(['correct', 'incorrect'].includes(result.refereeResult.detail.result));
  assert(!scoped.some(e => e.detail.discarded || String(e.detail.reason || '').startsWith('stale')));
  let admission;
  if (test.nominee) {
    assert.equal(recognition.detail.reason, 'role-aligned'); assert.equal(recognition.detail.nominee, test.nominee);
    assert.equal(recognition.detail.relation, 'affirmative-polar-reply');
    const admitted = event(admissionType); admission = admitted.detail;
    assert(recognition.sequence < admitted.sequence && admitted.sequence < ettinInput.sequence);
    assert.equal(admission.mechanismVersion, version); assert.equal(admission.nominee, test.nominee);
    assert.deepEqual(admission.contributingProviders, [version]);
    assert(['admitted', 'already-present'].includes(admission.reason), `Admission refused: ${admission.reason}`);
    const addition = admission.reason === 'admitted' ? 1 : 0;
    assert.equal(admission.evidenceAdditionCount, addition);
    assert.equal(admission.finalCandidateCount, admission.ordinaryCandidateCount + addition);
    assert.equal(ettinInput.detail.ettinCandidates.filter(word => word === test.nominee).length, 1);
    assert.equal(ettinInput.detail.ettinCandidateCount, admission.finalCandidateCount);
    assert(scored.detail.rankedCandidates.some(c => c.word === test.nominee && Number.isInteger(c.rank)));
  } else {
    assert.equal(recognition.detail.reason, test.reason); assert.equal(recognition.detail.nominee, undefined);
    const admissions = scoped.filter(e => e.type.endsWith('-nomination'));
    assert(admissions.length > 0);
    for (const { detail } of admissions) {
      assert(!detail.contributingProviders?.includes(version)); assert.equal(detail.evidenceAdditionCount, 0);
      assert.equal(detail.finalCandidateCount, detail.ordinaryCandidateCount);
    }
    assert(!scoped.some(e => e.type === admissionType)); admission = admissions[0].detail;
  }
  return { name: test.name, recognition: recognition.detail.reason, nominee: recognition.detail.nominee || null,
    ordinaryCount: admission.ordinaryCandidateCount, finalCount: admission.finalCandidateCount,
    admission: test.nominee ? admission.reason : 'abstained', additions: admission.evidenceAdditionCount,
    ettinRank: test.nominee ? scored.detail.rankedCandidates.find(c => c.word === test.nominee).rank : null,
    selected: selected.detail.selectedGuess, referee: result.refereeResult.detail.result, cleanup: result.cleanup,
    releaseBoard: result.releasePublicBoard.visible_tokens };
}

// Compare construction evidence only; timestamps and opportunity IDs belong to each run.
function recognitionEvidence(result) {
  const event = result.events.find(e => e.sequence > result.releaseBoundarySequence && e.type === recognitionType &&
    e.detail.publicBoardKey === result.releaseBoardKey && e.detail.opportunityId === result.opportunityId);
  const fields = ['mechanismVersion', 'targetSlot', 'sourceSpan', 'targetSpan', 'reason', 'nominee', 'relation',
    'sourceObjectSlot', 'targetObjectSlot', 'sourceRole', 'targetRole', 'questionSubject', 'replySubject',
    'affirmation', 'predicate', 'predicateLemma'];
  return Object.fromEntries(fields.map(field => [field, event.detail[field]]));
}
const reportPath = process.argv.find(arg => arg.startsWith('--report='))?.slice('--report='.length);
const report = { results: [], naturalAdditionValidated: false, hiddenAnswerIndependent: false, failure: null };
const before = await hashes();
try {
  for (const test of cases) {
    console.log('RUN', test.name);
    const input = fixture(test.puzzle), result = await runProductionTest(input);
    const entry = { name: test.name, result }; report.results.push(entry);
    entry.summary = verify(test, input, result);
    console.log('PASS', JSON.stringify(entry.summary));
    if (reportPath) await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  }
  const canonical = report.results.find(r => r.name === 'like-cats').result;
  const alternative = report.results.find(r => r.name === 'hidden-answer-dogs').result;
  assert.deepEqual(canonical.releasePublicBoard, alternative.releasePublicBoard);
  assert.deepEqual(recognitionEvidence(canonical), recognitionEvidence(alternative));
  report.hiddenAnswerIndependent = true;
  report.naturalAdditionValidated = report.results.slice(0, 4).some(r => r.summary.admission === 'admitted' && r.summary.additions === 1);
  console.log('PASS hidden-answer independence');
  console.log(report.naturalAdditionValidated ? 'PASS natural +1 admission validated' :
    'REVIEW all positive nominees already present; new-access production branch not validated');
} catch (error) {
  report.failure = error.stack; process.exitCode = 1; console.error('FAIL', error.stack);
  const last = report.results.at(-1)?.result;
  if (last) console.error('BACKBONE DIAGNOSTICS', JSON.stringify({ failure: last.failure, diagnostics: last.diagnostics,
    errors: last.errors, cleanup: last.cleanup, lastEvents: last.events.slice(-12).map(e => ({ sequence: e.sequence,
      type: e.type, reason: e.detail.reason })) }));
} finally {
  try { assert.deepEqual(await hashes(), before); console.log('PASS production/settings/backbone hashes unchanged'); }
  catch (error) { report.failure = [report.failure, error.stack].filter(Boolean).join('\n'); process.exitCode = 1; console.error(error); }
  if (reportPath) await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
}
