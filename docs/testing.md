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
| `src/components/ScreenStack.test.jsx` | What the player sees when buffers stack: draw order, which cells are transparent, when a background hides what's below |

## How to use them

- **Editing game files:** run `yarn test content`. It fails on a typo'd
  file name, a line the parser rejects, a stray `---`, or a coordinate off
  the map. The engine would otherwise drop those silently.
- **Fixing a bug:** write the test that shows it first, and watch it fail.
  The zone-order test failed with `dust, clouds, rain` (arrival order) before
  the fix in `src/zones.js`.
- **Reworking buffers:** `ScreenStack.test.jsx` asserts what's visible per
  cell, not how the DOM is built. It's meant to keep passing while buffers
  become sized, positioned pieces. Two of its tests are labelled *current
  behavior*: positioning by padding rows and cells, and how `ˣ` renders.
  Expect to rewrite those two on purpose.

## Pulling logic out so it can be tested

Hooks are hard to test directly, so pure logic moves into plain modules the
hooks call. `src/zones.js` is the first example: `useWorld` and `usePosition`
now call `loadZones`, `zoneAt` and `rollWeather`. `rollWeather` takes its
random source as an argument, so tests can pick the roll.
