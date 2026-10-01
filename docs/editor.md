# The editor (DEV)

The first cut of editing a game from inside it, on a phone or a desktop. The
test it's built to pass: **can every file in the game be edited where it is,
and the change seen without starting over?** Today it can, as text. Below that
are the hard parts this cut stepped around, and what makes each one hard.

## What there is

### The DEV screen

A fourth screen, a numbered menu like MENU, with its own soft key on the
keypad (always there, the small one on the right). On a desktop, tick **DEV**
under the screens to show it. Like any screen, hold its key to pin it: DEV
pinned beside the pad while the world is up is the main way to work.

| Item | Does |
| -- | -- |
| **Dev mode** | Pauses saves (see below). Kept outside every save slot (`localStorage["meta:dev"]`). |
| **Here** | What's at the last spot you tapped on the map: the world file, an NPC's file, a world door's destination, the overlays covering it, and **Jump here**. In dev mode a tap brings this up by itself. |
| **Paint** | Pick a brush from the world's glyphs, then tap the map to paint (see below). |
| **Files** | Every game file, by folder. `*` marks a local edit. Choosing one opens it. |
| **Edited** | Just the files with a local edit. |
| **Import files** | Pick files from the device. Each lands on the game file with its name (or its path, when a whole folder is picked); anything else becomes a new file. Large or binary files are kept as they are, as Blobs. |
| **Last save** | Back to the last save (a `load` event). |
| **Go to start** | To `game.txt`'s Start (a `destination` event). |

Keys on a keyboard: `u`/`n` up and down, `y`/`b` a page, `o` to use, `x` to go
back. They only work while DEV is showing. On the keypad it's the donut, like
MENU.

### Editing

Choosing a file opens it as text over the calculator: **Save**, **Revert**
(drop the edit and go back to the deployed file), **Download**, **Close**.
Typing never reaches the game's keys.

A saved edit applies **live**. `edits.save()` dispatches
`Content.changed {path}`, and every loader that showed that file reads it
again:

| File | Reloaded by |
| -- | -- |
| the current world, any overlay | `useWorld` |
| an NPC (`interactions/…`) | `useLocation`, the NPCs on screen |
| `equipment/…` | `useSpriteLayers`, the worn sprites |
| `game.txt` | `main.jsx`, which re-renders `App` with the new stats and title |

Each one is a `useContentVersion(matches)` in that loader's effect
dependencies. A new loader opts in the same way.

### Painting the map

**Paint** lists what the world on screen can be painted with: open ground,
its declared sprites with their labels (`█ wall`, `| ~counter`), then any
other glyph its art uses. Choosing one makes it the brush (`>` marks it, and
the title shows it). While there's a brush, a tap on the map paints that
cell instead of pointing at it, in dev mode or not. **Undo** steps back one
paint at a time, and **Stop painting** puts the brush down. The rows stay
put either way, so nothing moves under the cursor.

Each paint is an ordinary local edit. It reads the world file as the game
would, changes that one character of the map art (`paintCell` in
`src/paint.js`), and saves it, so the world redraws at once. Everything else
in the file, including the spec lines and blank lines, is left exactly as
it was. Painting past the edge grows the map, padding with spaces. Quick
taps queue, so each lands on the result of the one before.

The world announces what it can be painted with in a `World.shown` event,
whenever it loads or changes.

### Where edits live

`src/edits.js` keeps them in **IndexedDB** (`fm-edits`), which holds far more
than localStorage and holds Blobs as they are. They're a content source in
front of the network (see [games.md](games.md#where-game-files-come-from-at-runtime)),
so the deployed files stay the clean defaults and an edit masks one until
it's reverted. Edits are not game state: saving and loading never touch them.
`/tests/` reads through them too, so it checks what you're actually playing,
including files that exist only as edits.

### Dev mode

While it's on, `Save` writes nothing, so an experiment (jumping somewhere,
giving yourself things) can't overwrite the game you're playing. **Last
save** goes back to where you were. Edits still save, since they're the work.

### Touch

`ScreenStack` turns a tap into `touch {screen, row, col}`: the cell, not the
thing drawn there, because a screen is a stack of transparent grids and the
coordinate is all there is to hit. Every screen names itself (`stats`,
`world`, `menu`, `dev`). The world turns its taps into
`World.touch {world, row, col, glyph, label, files}` with 1-based map
coordinates, using `filesAt()` in `src/world.js`. On the phone only the
screen in the main slot takes taps; the pinned one stays a button.

## Hard parts, and what makes them hard

These were left alone on purpose. Each says what's in the way, so a rewrite
can aim at it.

### Touching anything but the map

A tap gives a cell. The world can say what's at a cell because the map is the
data. The other screens can't: what's drawn is assembled from many layers
(the status screen alone stacks equipment, rings and the log, each building
padded screen-sized buffers inside hooks), and nothing records which file,
line or item a cell came from.

**What would fix it:** views that return, next to their buffers, the regions
they drew and what each one is (`{at, size, ref}`). The pure views (`drawLog`,
`drawList`, `drawText`) can do it today. `DisplayStats` and
`useDisplayEquipable` would need to become views first. That's the same
work as drawing buffers anywhere, at any size, so it's worth doing once for
both.

### Color

Every color is its own layer: a `Screen` of `width × height` cells, each a
DOM node. Rarity colors are flattened to one layer per rarity, and stat
highlights add a layer per stat. Arbitrary color in a menu is possible (it's
how highlights work), but each new color costs a full grid of nodes, so it's
spent sparingly. A renderer that draws a cell once, with its color, would
remove the cost and the reason to flatten.

### Painting more than one cell at a time

Painting is one tap, one cell. Dragging a line, filling an area, or
stamping a block would need the screen to report a drag across cells, not
just taps, and the undo to group them. Painting over an NPC's or a door's
cell changes the art, but the object is still declared at that spot in the
spec lines below `---`. Moving or adding objects means editing those lines,
which is the next step after painting.

### Editing big, schemaless values

Things like an NPC's equipment lines or a shop's stock are rows and choices,
and fit the DEV menu. Free text (dialogue) fits the textarea. A value with no
shape doesn't fit either, and wants a contact sheet on the main screen.
There's no such view yet.

### Live reload doesn't reach everything

- An NPC's menu that's **already open** keeps its old text until you bump
  them again: `DisplayMenu` only refreshes when its target's coordinates
  change (its own `fixme`).
- **Item icons in the menu** reload when the menu's page changes, not on an
  edit.
- `game.txt`'s **Start** and **Log** only matter to a new game.
- A world edit that moves walls can leave you standing in one. That's
  allowed: dev mode balances upright, it doesn't promise a valid game.

### Game state when jumping in

**Jump here** moves you, but you arrive as you are: your items, your stats,
what you've done. Jumping into the middle of a story implies state the jump
doesn't set. Two ways to get there, not chosen yet:

- **A debug room**: a world of doors and chests that set things up.
- **Named states**: saves made in dev mode on purpose, kept as files in the
  game, to load from DEV.

Either way, it's the same question as **how progression is modeled** (which
NPCs are where, and when). The game puts every NPC in one world today. The
engine shouldn't pick the format for everyone. A game could split by world
files, by an attribute on map lines, or by flags that NPCs check.

### Getting edits out

**Download** saves one file. There's no bulk export yet. A zip needs code
the engine doesn't have. The Web Share API can hand several files to the
phone's share sheet, which is the likely next step. Pushing to the game's
repo is the memory tool's job, later.

### Offline and big files

Edits survive offline, but the deployed files and the app itself still come
from the network (`no-cache`). A service worker could precache them from the
manifest, which already lists every file. **Import** keeps a big file
(like the classifier model, over Pages' 25 MiB limit) in IndexedDB after one
pick. Nothing reads Blobs as anything but text yet: a `readBlob` beside
`readText` would. Browsers may evict storage under pressure unless the page
asks with `navigator.storage.persist()`.
