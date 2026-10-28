// Shared pacing policy. Consumers supply existing effective 100% durations.
// No timers, inference, animation engine, or wall-clock replacement lives here.
(function (root) {
  'use strict';
  const DEFAULT = Object.freeze({ mode: 'human', percent: 100 });
  const MAX_MINIMUM_MS = Object.freeze({
    pacing: 250, recognition: 100, feedback: 160, speech: 160,
    animationPhase: 32, animationFrame: 32, animationCycle: 64, decoration: 250,
  });

  function validateSetting(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Gameplay speed must be a valid speed setting.');
    }
    const keys = Object.keys(value).sort().join(',');
    if (value.mode === 'max-testing' && keys === 'mode') {
      return Object.freeze({ mode: 'max-testing' });
    }
    if (value.mode === 'human' && keys === 'mode,percent' &&
        typeof value.percent === 'number' && Number.isFinite(value.percent) &&
        value.percent >= 10 && value.percent <= 150) {
      return Object.freeze({ mode: 'human', percent: value.percent });
    }
    throw new Error('Gameplay speed must be 10–150% human mode or MAX TESTING SPEED.');
  }

  function createController(initial = DEFAULT) {
    let selected = validateSetting(initial);
    function snapshot(setting = selected) {
      const fixed = validateSetting(setting);
      return Object.freeze({
        setting: fixed,
        duration(baseline, phase) {
          if (!Object.hasOwn(MAX_MINIMUM_MS, phase)) throw new Error('Unapproved pacing phase: ' + phase);
          if (typeof baseline !== 'number' || !Number.isFinite(baseline) || baseline < 0) {
            throw new Error('Pacing duration must be finite and nonnegative.');
          }
          // MAX deliberately yields even for a zero baseline. Human 100% is exact.
          return fixed.mode === 'max-testing' ? MAX_MINIMUM_MS[phase] : baseline * (100 / fixed.percent);
        },
      });
    }
    return Object.freeze({ get: () => selected, set: value => (selected = validateSetting(value)), snapshot });
  }
  const api = Object.freeze({ DEFAULT, MAX_MINIMUM_MS, validateSetting, createController, ...createController() });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GGGGameplaySpeed = api;
})(globalThis);
