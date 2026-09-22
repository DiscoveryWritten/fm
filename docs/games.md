# Games

The engine (this repo's `src/`) plays a **game**: a folder of text files. The
game that ships today is `games/fm/`. A build is for one game, and a deployed
site serves that game under `/game/`, next to the engine and its `/tests/`
page.

## A game folder

```
games/fm/
├─ game.txt              title, start world and spawn, opening log
├─ world/*.txt           maps and their objects
├─ overlays/*.txt        weather and ambience tiles
├─ interactions/<Class>/<name>.txt   NPCs
└─ equipment/<kind>/<template>.txt   item sprites
```

Everything except `game.txt` is described in [file-formats.md](file-formats.md).
Files starting with `.` are ignored, so a submodule's `.git` file never ships.

### game.txt

Same shape as an NPC file: a section name, its lines, then `---`.

```
Title
Freedom of Movement
---
Start
Terra Montans.txt (20,22)
---
Log
You wake up in a small room, the walls are made of stone and the floor is dirt.
You've never been this tired before.
---
Stats
A  attack   f55  gear
D  defense  58f  gear
S  speed    8d8  gear
H  hearing  fd4
R  anger    f44
```

- **Start:** a world file, then the 1-based `(row,col)` to spawn at.
- **Log:** one entry per line, oldest first.
- **Stats:** one per line: a short code, a full name, a color (3 or 6 hex
  digits, no `#`), and `gear` if the stat is summed from what's worn. Codes
  and names must be unique. Map lines use them as tokens (`#H2`), and
  dialogue marks phrases with them (`R+1:HEY!`); see
  [file-formats.md](file-formats.md). The color is the phrase's highlight.
- The engine reads `game.txt` before anything else. If it's missing or has no
  valid Start line, the page says so instead of starting.

## Choosing the game to build

`game.config.js` decides, from the `GAME` environment variable. The default
is `games/fm`, and the value can be any folder relative to this repo:

```sh
yarn dev                           # games/fm
GAME=games/other yarn dev          # another game in this repo
GAME=../somewhere/else yarn build  # a game checked out anywhere
GAME=games/other yarn test         # its checks, against its files
```

- **`yarn dev`** serves the folder at `/game/` straight from disk, so edits
  show on reload.
- **`yarn build`** copies it into `dist/game/`.
- **The manifest** (`virtual:content-manifest`) lists its files for the
  `/tests/` page, and later for offline caching.

Verified with a second, unrelated game built from a folder outside the repo:
its own title, world and overlay loaded, and `/tests/` passed its checks.

## Moving a game into its own repo (submodule)

Nothing in the engine changes; only where the folder comes from.

```sh
# 1. Make games/fm its own repo (keeping its history), and push it
git subtree split --prefix=games/fm -b fm-content
#    create an empty repo, e.g. DiscoveryWritten/fm-content, then:
git push git@github.com:DiscoveryWritten/fm-content.git fm-content:main

# 2. Replace the folder with the submodule
git rm -r games/fm
git submodule add https://github.com/DiscoveryWritten/fm-content.git games/fm
git commit -m "Mount the fm game as a submodule"
```

Then:

- **Fresh clones** need `git clone --recurse-submodules`, or
  `git submodule update --init` after cloning.
- **The GitHub Pages workflow** already checks out submodules. **Cloudflare
  Pages** clones submodules too, but a private submodule needs access set up.
- **Several games** can sit side by side under `games/`, each a submodule. A
  deploy per game builds with its own `GAME=`.

## Where game files come from at runtime

Every game file the engine reads goes through `readText(path)` in
`src/content.js`: the world, overlays, NPCs, sprites, `game.txt`, and the
`/tests/` page too. It asks a list of **sources** in order, and the first one
with the file wins. The deployed game, fetched over the network, is always
last.

```js
import { addSource } from './content';

// A store of local copies or edits, in front of the deployed game.
const remove = addSource({
  name: 'my store',
  read: async (path) => myStore.get(path) ?? null,  // null: "not here, ask the next one"
});
```

This is where an in-browser store plugs in: player edits, files pulled from
elsewhere, anything that should win over the deployed copy. The deployed
files stay the clean fallback. Because `/tests/` reads through the same
sources, it checks exactly what the game would load, local edits included.
`src/checks/game.js` pins the ordering: the newest source first, falling
through to older ones, and removal.
