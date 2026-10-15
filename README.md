# Guess Guess Guess

A browser-based word puzzle game with JSON-loaded puzzle data and image clues.

## Run locally

The existing Desktop launcher still works for ordinary play and needs no changes.
With no administrator password in its environment, administration is disabled.
To explicitly start with administration disabled, open Terminal in this project
folder and run:

```sh
env -u GGG_ADMIN_PASSWORD node server.js
```

If Terminal says `command not found: node`, run this once in that Terminal
window to use the same installed Node runtime as the Desktop launcher, then retry:

```sh
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
```

Then open `http://127.0.0.1:8765/`. Ordinary gameplay, puzzle reads, ETTIN,
inference, and playtest logging need no administrator login. Opening `index.html`
directly will not enable the server services.

## Start with administrator access

Stop any existing game server first (see below). In macOS Terminal (the default
zsh shell), from this project folder, paste this block:

```zsh
(
  read -r -s 'GGG_ADMIN_PASSWORD?Choose a password for this local server session: '
  printf '\n'
  export GGG_ADMIN_PASSWORD
  node server.js
)
```

Type a password you choose and press Return; typing is hidden. The password is
entered locally, passed only through the server environment, and is not saved in
the repository or shell command history. Do not put it in source code or a `.env`
file. An empty password leaves administration disabled. Repeat these steps to
choose a different password for a later server session.

Open `http://127.0.0.1:8765/`, click the middle **Guess** in the title, enter the
same password in the existing form, and press Return. The admin panel opens only
after server login succeeds. Use **Close and Log Out** when finished. Sessions
expire after eight hours and also end when the server stops or restarts. If an
admin save is denied after expiration, log in again through the title form.
The browser receives an HttpOnly, SameSite=Strict session cookie, never the
configured password. Admin requests must come from the same local origin.

## Stop the server

For a server started in Terminal, press **Control-C** in that Terminal window.
Closing the browser alone does not stop the server. The password prompt block
above uses a subshell, so its environment password also disappears on exit.

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
