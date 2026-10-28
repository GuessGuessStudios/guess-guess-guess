// Temporary, opt-in visual-cue fixtures. No answer, slot or puzzle-text access.
(function (global) {
  'use strict';
  const version = 'ettin-visual-language-v6';
  const cueSets = Object.freeze({
    1: Object.freeze(['humans', 'aliens', 'UFO', 'looking', 'sky']),
    2: Object.freeze(['men', 'aliens', 'spacecraft', 'standing', 'hovering']),
    3: Object.freeze(['humans', 'aliens', 'above', 'below', 'watching']),
  });
  const params = new URLSearchParams(global.location?.search || '');
  const enabled = params.get('humanPlaytestMode') === '1' && params.get('visualCueExperiment') === '1';
  const puzzleNumber = enabled && params.get('visualPuzzle') === '16' ? 16 : 12;
  const puzzlePath = 'puzzles/puzzle-' + String(puzzleNumber).padStart(3, '0') + '.json';
  const cueSet = puzzleNumber === 12 && enabled && ['2', '3'].includes(params.get('visualCueSet'))
    ? Number(params.get('visualCueSet')) : 1;
  const order = puzzleNumber === 16
    ? Object.freeze(['person', 'backpack', 'yellow', 'holder', 'entrance']) : cueSets[cueSet];
  // Full-text variants are experiment metadata, active only at the full five-cue setting.
  // Lower cue counts and every default URL retain the existing word-count experiment.
  const requestedFormat = enabled && puzzleNumber === 16 && ['B', 'C', 'D'].includes(params.get('visualFormat'))
    ? params.get('visualFormat') : 'A';
  const formatTexts = Object.freeze({
    B: 'parasol, depart, deposit, place, threshold.',
    C: 'wearing a backpack; hand on a yellow object in a holder; near an open entrance.',
    D: 'A person is wearing a backpack near an open entrance.\nTheir hand is on a yellow object standing in a holder.'
  });
  let count = /^[0-5]$/.test(params.get('visualCues') || '') ? Number(params.get('visualCues')) : 0;
  // Opt-in strength experiment; absent/invalid settings retain the exact old cap.
  const requestedCap = params.get('visualBonusCap');
  const experimentCap = enabled && ['2', '4', '6', 'uncapped'].includes(requestedCap)
    ? (requestedCap === 'uncapped' ? 'uncapped' : Number(requestedCap)) : Math.log(1.75);
  const bonusCap = condition => condition.bonusCap === 'uncapped' ? Infinity
    : [2, 4, 6].includes(condition.bonusCap) ? condition.bonusCap : Math.log(1.75);
  const words = () => !enabled ? [] : count !== 5 || requestedFormat === 'A' ? order.slice(0, count)
    : requestedFormat === 'B' ? ['parasol', 'depart', 'deposit', 'place', 'threshold']
    : requestedFormat === 'C' ? ['wearing a backpack', 'hand on a yellow object in a holder', 'near an open entrance']
    : [formatTexts.D];
  const format = () => count === 5 ? requestedFormat : 'A';
  const contextText = () => formatTexts[format()] || (words().length ? words().join(', ') + '.' : '');
  const metadata = () => ({ format: format(), contextText: contextText(), version, puzzleNumber, cueSet, count, words: words(), provider: 'ETTIN', maxMultiplier: experimentCap === 'uncapped' ? null : Math.exp(experimentCap), bonusCap: experimentCap });
  // Score exactly the existing shortlist twice with the same learned model.
  // Only the second input includes the configured picture text, preserved intact. Positive
  // log-score uplift supplies bounded support; negative uplift is neutral.
  async function evaluate(provider, snapshot, candidates, baseline, condition) {
    if (!condition.words.length) return baseline;
    const suffix = '\nPicture: ' + (condition.contextText || condition.words.join(', ') + '.');
    const contextual = await provider.scoreCandidatesShadow(snapshot, candidates, suffix);
    const byWord = new Map(contextual.candidates.map(candidate => [candidate.word, candidate]));
    if (byWord.size !== baseline.candidates.length) throw new Error('ETTIN visual cue candidate mismatch');
    return { ...baseline, scoringMs: baseline.scoringMs + contextual.scoringMs,
      candidates: baseline.candidates.map((candidate, index) => {
        const withCues = byWord.get(candidate.word);
        if (!withCues || !Number.isFinite(withCues.score) || !Number.isFinite(candidate.score)) {
          throw new Error('ETTIN visual cue score unavailable');
        }
        const delta = withCues.score - candidate.score;
        return { ...candidate, visualCueEvidence: {
          baselineScore: candidate.score, cueScore: withCues.score, delta,
          supportBonus: Math.min(bonusCap(condition), Math.max(0, delta)),
          context: suffix.trim(),
          // One actual provider-rendered input per opportunity keeps evidence compact.
          ...(index === 0 ? { renderedInput: withCues.ettinRenderedText } : {})
        } };
      }) };
  }
  function mount(restart) {
    if (!enabled) return;
    const panel = document.createElement('section');
    panel.id = 'visualCueExperiment';
    panel.setAttribute('aria-label', 'Puzzle ' + puzzleNumber + ' visual cue experiment');
    panel.innerHTML = '<strong>Puzzle ' + puzzleNumber + ' · Visual cue experiment</strong>' +
      '<p id="activeVisualCues" aria-live="polite"></p>' +
      '<label for="visualCueCount">Cues for next round </label><select id="visualCueCount" aria-label="Cues for next round"></select> ' +
      '<button id="restartVisualCueRound" type="button">Reset Puzzle ' + puzzleNumber + '</button> ' +
      '<a href="?humanPlaytestMode=1">Exit experiment</a>' +
      '<p class="visual-cue-help">Choose 0–5 cues, reset, then Start Game. Reset ends the current round. Each level adds one cue in order. The image stays the same. ETTIN evaluates the cues; rounds with cues may take longer.</p>';
    panel.addEventListener('keydown', event => event.stopPropagation());
    document.getElementById('currentPuzzleNumber').after(panel);
    document.getElementById('puzzleNavigation').hidden = true;
    const select = panel.querySelector('select'), button = panel.querySelector('button');
    for (let n = 0; n <= 5; n++) select.add(new Option(n === 0 ? '0 — no cues' : n + ' — add ' + order[n - 1], n));
    if (requestedFormat !== 'A') select.options[5].text = '5 — full format ' + requestedFormat + ' input';
    select.value = String(count);
    function display() {
      if (format() !== 'A') { panel.querySelector('#activeVisualCues').textContent = 'This round: format ' + format() + ' · ' + contextText(); return; }
      panel.querySelector('#activeVisualCues').textContent = 'This round: ' + count + (count === 1 ? ' cue' : ' cues') + ' · ' + (words().join(' · ') || 'No visual cue words');
    }
    display();
    button.addEventListener('click', async () => {
      button.disabled = select.disabled = true;
      try {
        count = Number(select.value);
        const url = new URL(global.location.href);
        url.searchParams.set('visualCues', String(count));
        global.history.replaceState(null, '', url);
        await restart();
        display();
      } finally { button.disabled = select.disabled = false; }
    });
  }
  global.GGGVisualCueExperiment = Object.freeze({ version, enabled, puzzleNumber, puzzlePath, order, words, metadata, bonusCap, evaluate, mount });
})(globalThis);
