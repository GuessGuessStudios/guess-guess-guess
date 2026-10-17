# Production-path tests

`ggg-test-backbone.mjs` exports one `runProductionTest({ puzzle, setupGuesses, releaseState, timeouts? })` function. It establishes a public board through real UI guesses, releases the existing setup gate, observes one production opportunity, and cleans up. It contains no mechanism assertions.

## Run

From the repository root, using the known local runtime:

```sh
PLAYWRIGHT_MODULE='file:///Users/jamesfromhart/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs' \
CHROME_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
/Users/jamesfromhart/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  tests/production/mechanism-4-negative.test.mjs --failure-checks --gate-checks
```

Omit the flags to run only the negative acceptance case. `PLAYWRIGHT_MODULE` defaults to `playwright`; `CHROME_EXECUTABLE` is required. The owned server uses the executing Node runtime and `GGG_TEST_PORT` (default `8766`). Run serially; an occupied port fails without touching its owner.

## Contract

- `puzzle`: temporary puzzle text, supplied only through the normal puzzle-list/puzzle response routes.
- `setupGuesses`: ordered `{ slot, word }` entries, exactly one per prerequisite. No direct reveals or fallback input methods.
- `releaseState`: `{ visibleTokens, targetSlot, targetCasePattern }`. Version 1 supports one wholly hidden target, all other slots solved, and zero public rejections. Guesses contain letters only; visible tokens retain punctuation.
- `timeouts`: optional `readyMs` (45000), `guessMs` (15000), `inferenceMs` (120000). No retries or timer acceleration.

The backbone always uses `humanPlaytestMode=1&ettinPilot=1&humanPlaytestSetup=1`. It calls `releaseHumanPlaytestSetupForTesting()` once after the exact UI state is confirmed. The authoritative public board/key comes from the first post-release production diagnostic and is checked again; no board/key is manufactured.

Every diagnostic type is captured with sequence/time, preserving production payloads except hidden-answer fields removed from the recorded copy. There is no capture allowlist. Events before the release boundary cannot satisfy inference checks. Selection/submission match the production board key and opportunity ID; the following referee result must match target, responder, and submitted word. Observation ends at that first result, production termination, or deadline; it never searches later turns for a desired result.

The result includes readiness, setup results, release UI/board/key/boundary, captured events, selection/submission/referee evidence, errors, phase/wait diagnostics, and cleanup status. `failure` locates an environment/readiness/setup/release/observation/cleanup problem; it does not assign a mechanism verdict. The caller owns assertions and may serialize the returned result to its chosen report location.

Evidence is collected before cleanup. Production log saving remains unchanged and supplementary; there is no response-drain/persistence wait. The backbone closes its own browser and server and removes Playwright-owned temporary browser state. It preserves production logs and never changes saved settings, production files, or Git state. SIGINT/SIGTERM request cleanup; forced process termination cannot guarantee it.

## Scope and repair limit

Keep mechanism expectations in `mechanism-4-negative.test.mjs`. The optional failure checks cover missing dependencies/browser, occupied port, readiness mismatch, rejected setup guess, and inference timeout. Separate browser probes verify gate inactivity without the full opt-in. No correctness requirement is imposed on the final AI guess.

No plugins, callbacks in the public API, custom predicates, DSL, automatic retries, production repairs, or broad migration. After five or six small repair cycles, stop and inspect phase boundaries/event correlation instead of adding fallbacks. Start with `failure`, `diagnostics.lastWait`, the phase trace, errors, and captured event sequence.
