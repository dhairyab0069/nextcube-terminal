# nextcube-terminal

A virtual NeXTSTEP-style Unix shell with a 5-flag reverse-engineering CTF and a
hidden kernel dungeon. Plain HTML + ES modules, no build step.

## The shell

About 100 commands (`help` lists them, `man <cmd>` describes each), on a
pretend filesystem rooted at `/` with the portfolio in `/home/dhairya`.

- **Syntax:** pipes, `> >> < 2> 2>&1`, `; && ||`, quotes and escapes,
  `$VAR ${VAR} ${VAR:-x} $? $(cmd) $((expr))`, globs, `~`, aliases,
  history expansion (`!! !n !prefix`), scripts (`source f`, or `chmod +x f`
  then `./f`).
- **Files:** `ls cd cat tree find touch mkdir rm cp mv stat du df chmod open`
  and **nano** (GNU nano layout: ^O write out, ^W where is, ^K/^U cut and
  paste, ^C cursor position, ^X exit with a save prompt; the footer is
  tappable on phones). `vim`/`vi` open the same editor.
- **Text:** `echo printf grep head tail wc sort uniq cut tr sed awk rev tac
  nl tee seq base64 xargs diff less`. `sed` covers `s///`, `d`, `p` with
  addresses; `awk` covers patterns, fields, variables, arrays, `if`/`for`,
  `printf`, BEGIN/END.
- **Persistence:** changes under `~` and `/tmp`, aliases, exported variables
  and history live in localStorage. A saved home directory is dropped if the
  shipped one changes; `fsreset -y` restores it by hand. Everything outside
  `~` and `/tmp` is read-only.
- **Keys:** ↑/↓ history, Tab completion (commands, paths, `$VARS`), Ctrl+C,
  Ctrl+L, Ctrl+A/E/U/K/W/Y.

Code map: `js/shell/parse.js` (tokenizer, parser, expansion, arithmetic),
`exec.js` (pipelines, redirects, aliases), `fs.js` + `storage.js` (VFS
writes and persistence), `textproc.js` (sed and awk), `editor.js` (nano),
`commands/*` (the commands; `docs.js` feeds `help` and `man`). `parse.js` and
`textproc.js` are DOM-free and run under node.

- **Standalone:** https://dhairyab0069.github.io/nextcube-terminal/
- **Embedded:** in the Workbench panel of https://dhairyab0069.github.io, which
  loads `/nextcube-terminal/?embed=1` in a same-origin iframe.

## Embedding protocol

See `js/bridge.js`. Messages are same-origin only and tagged with `source`:

| Direction | Message |
|---|---|
| terminal → parent | `{source:'nextcube-terminal', type:'ready'}` |
| terminal → parent | `{source:'nextcube-terminal', type:'ctf', found:[…]}` |
| terminal → parent | `{source:'nextcube-terminal', type:'flip'}` |
| parent → terminal | `{source:'nextcube-site', type:'theme', theme:'light'\|'dark'}` |
| parent → terminal | `{source:'nextcube-site', type:'cheat', on:true\|false}` |

CTF progress (`ctf_state`) and the theme (`theme`) live in localStorage, which
both pages share because they're on the same origin. `~/publications/` is built
from the main site's `/data/publications.json`.

## Local preview

```sh
python3 -m http.server   # standalone at http://localhost:8000
```

To preview it embedded in the main site, serve both repos from one root. See
the main site's README.

## Deploy

Same pipeline as the main site: `.github/workflows/deploy.yml` runs
`.github/scripts/build.mjs`, `html-validate` and a link check, then deploys to
Pages on every push to `main`.
