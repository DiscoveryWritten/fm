# Testing

```sh
yarn test          # run everything once (about 2 s)
yarn test:watch    # rerun affected tests on every save
yarn test map      # only files or groups matching "map"
```

The same checks also run **in the browser**, at `/tests/` on any deployed
copy of the game (or `yarn dev` and open `/tests/`). That page loads the
game's text files the way the game does, through `readText()`, and runs every
portable check against them. After editing a world or NPC file on a phone,
open `/tests/` to know it still holds together. `?grep=terra` narrows the run.

## Two kinds of test

- **Portable checks** (`src/checks/*.js`): these run both under Vitest and in
  the browser. Each module exports
  `register({ describe, it, expect }, content)` and must not use Node or the
  DOM. `content` holds every file in the game: `content.text[path]`,
  `content.files`, `content.exists(path)`. The list of files comes from
  `virtual:content-manifest`, which a Vite plugin builds from the game's
  folder, because a static host can't list its directories. Under Vitest the
  files are read from that folder on disk. `GAME=<folder> yarn test` checks
  another game (see [games.md](games.md)). Register a new module in
  `src/checks/index.js`.
- **Vitest-only tests** (`*.test.js(x)`): anything that needs Node or a
  simulated DOM (jsdom), like the renderer and hook tests.

`src/checks.test.js` runs the portable checks under Vitest. It also runs them
through the browser's own small runner (`src/checks/runner.js`), so a pass
under `yarn test` means a pass at `/tests/`. `src/checks/runner.test.js`
holds each of that runner's matchers to Vitest's verdicts.

## What's covered

| File | What it pins down |
| -- | -- |
| `checks/files.js` | **Every file in the game**: `game.txt` parses and its start world exists; each world line parses, there's exactly one `---`, referenced overlay/NPC/world/equipment files exist, and coordinates are on the map |
| `checks/game.js` | `game.txt` parsing, and content sources: the newest is asked first, falls through, and can be removed |
| `checks/map.js` | World parsing, walkability, viewport paging (including a page's last row and column), terrain layers, battle depth rows, and exploring on foot. On the game's start world (from `game.txt`): it parses, the spawn is open ground, it's walled in, **every NPC and door can be reached from the spawn**, and locked rooms open only with their key |
| `checks/zones.js` | Zone loading keeps declaration order however the fetches finish (the weather bug), last-declared-wins lookup, inclusive 1-based boxes, weather roll ranges |
| `checks/interactions.js` | The object-spec grammar for every line type, NPC sections and `?reactions`, Buy filtering, locked doors, sprite actions |
| `checks/buffers.js` | Offsets, placing, stacking and clipping, as plain text |
| `checks/log.js` | The Log view at its real size and at others: list, highlight, reading, text scroll, rewrapping |
| `checks/utils.js` | Text wrapping and scrolling (`bufferize`), direction lists, prices, equipment grouping, templates |
| `components/ScreenStack.test.jsx` | Vitest only. What the player sees when buffers stack, and that `composite` matches the real renderer cell for cell |
| `hooks/useSubDisplayLog.test.jsx` | Vitest only. The Log tab driven by key events, as the game drives it |

## How to use them

- **Editing game files:** open `/tests/`, or run `yarn test`. It fails on a
  typo'd file name, a line the parser rejects, a stray `---`, a coordinate off
  the map, or an NPC or door the player can no longer reach. The engine would
  otherwise drop or hide those silently. Each problem is reported on its own.
- **Fixing a bug:** write the test that shows it first, and watch it fail.
  The zone-order test failed with `dust, clouds, rain` (arrival order) before
  the fix in `src/zones.js`.
- **Checking a screen without looking at it:** draw a view and compare
  `screenText(buffers, width, height)` with the lines you expect. See
  `src/checks/log.js`. `composite` also gives each cell's colors when
  they matter.
- **Testing keys and state:** render the hook in a tiny component, dispatch
  `KeyboardEvent`s on `window` inside `act`, and read its buffers back as
  text. See `src/hooks/useSubDisplayLog.test.jsx`. It caught the Log's
  reading keys staying live on other tabs.
- **Refactoring a display:** before changing it, capture every layer of
  every cell in the browser across a script of key presses, then compare
  after. The Log's move to `src/views/log.js` matched across all 19
  captured states.

## Pulling logic out so it can be tested

Hooks are hard to test directly, so pure logic moves into plain modules the
hooks call:

- **`src/zones.js`:** `useWorld` and `usePosition` call `loadZones`,
  `zoneAt` and `rollWeather`. `rollWeather` takes its random source as an
  argument, so tests can pick the roll.
- **`src/views/log.js`:** `drawLog` is pure, and `useSubDisplayLog` only
  holds state and keys.
- **`src/world.js`:** `useWorld`, `useLocation` and `usePosition` call
  `parseWorld`, `isOpen`, `viewport`, `onPage`, `viewArea`, `terrain` and
  `depthRows`. `explore` is only used by checks today, and it's the start of
  pathfinding.

The equipment and ring tabs still build padded, screen-sized buffers inside
`useDisplayEquipable` and are the natural next views.
