# Testing

```sh
yarn test          # run everything once (about 1 s)
yarn test:watch    # rerun affected tests on every save
yarn test zones    # only files matching "zones"
```

Tests use [Vitest](https://vitest.dev), which reuses `vite.config.js`, so they
compile exactly like the app. They sit next to the code they cover, as
`*.test.js` / `*.test.jsx`. Most run in plain Node. A file that needs a DOM
opts in with a `// @vitest-environment jsdom` comment on its first line.

## What's covered

| File | What it pins down |
| -- | -- |
| `src/zones.test.js` | Zone loading keeps declaration order however the fetches finish (the weather bug), last-declared-wins lookup, inclusive 1-based boxes, weather roll ranges |
| `src/interactions.test.js` | The object-spec grammar for every line type, NPC sections and `?reactions`, Buy filtering, locked doors, sprite actions |
| `src/utils.test.js` | Text wrapping and scrolling (`bufferize`), direction lists, prices, equipment grouping, templates |
| `src/content.test.js` | **Every shipped text file**: each world line parses, there's exactly one `---`, referenced overlay/NPC/world/equipment files exist, and coordinates are on the map |
| `src/components/ScreenStack.test.jsx` | What the player sees when buffers stack: draw order, which cells are transparent, when a background hides what's below, `at` offsets. Also holds `composite` to the real renderer, cell for cell |
| `src/buffers.test.js` | Offsets, placing, stacking and clipping, as plain text |
| `src/views/log.test.js` | The Log view at its real size and at others: list, highlight, reading, text scroll, rewrapping |
| `src/hooks/useSubDisplayLog.test.jsx` | The Log tab driven by key events, as the game drives it |

## How to use them

- **Editing game files:** run `yarn test content`. It fails on a typo'd
  file name, a line the parser rejects, a stray `---`, or a coordinate off
  the map. The engine would otherwise drop those silently.
- **Fixing a bug:** write the test that shows it first, and watch it fail.
  The zone-order test failed with `dust, clouds, rain` (arrival order) before
  the fix in `src/zones.js`.
- **Checking a screen without looking at it:** draw a view and compare
  `screenText(buffers, width, height)` with the lines you expect. See
  `src/views/log.test.js`. `composite` also gives each cell's colors when
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

The equipment and ring tabs still build padded, screen-sized buffers inside
`useDisplayEquipable` and are the natural next views.
