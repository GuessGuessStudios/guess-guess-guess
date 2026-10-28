# Guess Guess Guess

A browser-based word puzzle game with JSON-loaded puzzle data and image clues.

## Run locally

The Desktop launcher starts the game normally. To enter the administrator area,
click the middle **Guess** in the title, enter the existing administrator
password, and press Return. The local server verifies the password; it is not
stored in this repository or browser code. Ordinary gameplay works without an
administrator login. Opening `index.html` directly will not enable server
services.

The password verifier lives in `.ggg-admin.local.json` on this computer, with
owner-only file permissions. Git ignores this file and the server refuses to
serve it. Keep a private backup when moving the game to another computer; it is
not included in GitHub clones. Missing or invalid configuration disables admin
login without preventing ordinary gameplay. Restart the local server after
changing this file.

The administrator panel opens only after server login succeeds. Use **Close and
Log Out** when finished. Sessions expire after eight hours and also end when the
server stops or restarts. If an admin save is denied after expiration, log in
again through the title form. The browser receives an HttpOnly, SameSite=Strict
session cookie, never a stored password. Admin requests must come from
the same local origin.

## Stop the server

For a server started in Terminal, press **Control-C** in that Terminal window.
Closing the browser alone does not stop the server.

If the Desktop launcher started the server in the background, run this from the
project folder to stop the matching game server before an admin session:

```sh
node -e 'fetch("http://127.0.0.1:8765/api/server-info").then(r=>r.json()).then(s=>{if(s.service!=="guess-guess-guess"||s.root!==process.cwd()||!Number.isInteger(s.pid))throw Error("Different server; left untouched");process.kill(s.pid,"SIGTERM");console.log("Game server stopped")}).catch(e=>{console.error("Could not stop game server:",e.message);process.exitCode=1})'
```

This service continues to bind only to `127.0.0.1`; this is a local administration
workflow, with no database or external login service.

## Project structure

- `index.html` - game page
- `style.css` - game styling
- `game.js` - game logic and puzzle loading
- `hints.js` - hint data/logic
- `puzzles/` - JSON puzzle files
- `assets/images/` - puzzle and ending images
- `server.js` - localhost-only game server and session-protected administrator saves

## Puzzle 12 visual cue experiment (temporary)

Open <http://127.0.0.1:8765/?humanPlaytestMode=1&visualCueExperiment=1&visualCues=0> with the local server running.
Choose **0–5 cues**, click **Reset Puzzle 12**, then **Start Game**. Changing the selector alone does not change the current round. Use the existing Raise Hand and Hold to View Image controls. Reset starts a fresh board and scores; Exit experiment returns to ordinary human playtest mode.

The fixed cue order is **humans → aliens → UFO → looking → sky**. All six conditions use the existing local ETTIN inference path, including zero cues. For nonzero conditions, ETTIN scores the same existing shortlist again with `Picture: <cue words>.` appended to the public board. Positive score uplift adds at most `log(1.75)` to final selection scores; negative uplift adds nothing. There are no manual semantic associations, cue-based candidate additions, or cue-based hard constraints. Existing eligibility rules still apply. Two model scoring passes can take longer than the zero-cue condition.

Existing playtest logs record the condition in `session.modeFlags.visualCueExperiment`. ETTIN scoring and selected-guess diagnostics include the baseline score, cue-context score, and capped support. No puzzle text or image was changed. This is a human-playtesting experiment, not a permanent visual-cue system.

Removing the experiment URL flags disables it. Pre-edit copies of affected existing files are preserved in `/Users/jamesfromhart/Documents/guess-visual-cue-backup-20261027/`; avoid restoring whole files over later work. Implementation is in `visual-cue-experiment.js` with narrow hooks in `game.js`, plus its script include and styles. Human playtesting is the next runtime check; browser automation was intentionally not run after the ETTIN correction.
