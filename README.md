# nextcube-terminal

A virtual NeXTSTEP-style Unix shell with a 5-flag reverse-engineering CTF and a
hidden kernel dungeon. Plain HTML + ES modules, no build step.

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
