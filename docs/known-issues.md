# Known issues

Ranked by how much each one gets in the way of launching and playing.
**Verified** means reproduced in a browser or by running the real parser.
**Read** means found by reading the code but not exercised.

## Launch blockers

### The ML model is over Cloudflare Pages' per-file limit (verified)

`public/models/Xenova/mobilebert-uncased-mnli/onnx/model_quantized.onnx` is
26,967,165 bytes (25.7 MiB). Pages rejects any single file over 25 MiB, and
Vite copies all of `public/` into `dist/`. Nothing at runtime loads the model,
because `useAnalyzer` is commented out. See [deployment.md](deployment.md).

## Gameplay bugs

### Weather and interior zones (verified)

Zone order now follows the world file regardless of network timing (fixed,
with a test). Still open: weather resets when you leave an interior, and roll
rate follows render count. Full analysis with the repro and
a fix sketch: [weather-zones.md](weather-zones.md).

### No way out of battle view (read)

The 2024-09 stash, salvaged in `03f7886`, removed the `Sheathe` ambient menu
item. `App` still listens for `Sheathe`, but nothing dispatches it, so after
choosing **Fight** the world stays in battle view until you reload. Nothing
breaks, because `battle` isn't saved.

### Bard's `Load` menu is broken (verified in browser: shows `1:undefined`)

`actions/Load.js` returns save-slot names as plain **strings**. The menu
renders `option.name`, so it shows `1:undefined`. Choosing an entry pushes a
junk submenu, and no `Load` event exists to act on it. Saves still resume on
reload, because each `useSave` restores the latest slot when it mounts.

### Fight strategy selection ignores damage (verified)

`tickArea` picks `strategies.slice(-hp - 1, -hp)`, where `hp` is the NPC's
**max** HP from its data file. That always resolves to `strategies[0]`,
`idle`. If HP were ever tracked, `attack` and `enrage` would crash, because
only `strategies/idle.js` exists. With `hp: 0`, the slice is empty and the
lookup throws.

### `Harm` entry on every NPC (read)

`amendNPC` attaches `Harm = { event: 'Harm.player' }` to every NPC. It has no
`name`, so the menu hides it, and nothing listens for `Harm.player`. This is
unfinished work from the salvaged stash.

### High Canopy can't be entered (verified)

A world-door target must match `\w+\.txt`, and "High Canopy" has a space.
(Its canopy overlay used to sit in an ignored third `---` section; that's
fixed, and `src/checks/files.js` now fails on any extra section.)

### Player can walk off unwalled map edges (read)

Movement only blocks known wall glyphs, and `map[y]?.[x]` outside the map is
`undefined`. On a map without a solid border, like High Canopy, the player
walks into negative or out-of-range coordinates, and viewport math goes
negative. Terra Montans is fully walled, so it's safe.

### Battle view: behind a short wall, every farther wall shows (verified)

`depthRows` only consults the nearest wall in each column. When that's short
(a counter), walls two rows back draw even if a tall wall between hides them.
`src/checks/map.js` pins this as current behavior.

### NPC patrols ignore walls and the player (read)

`idle` just replays the `#idle=` direction list. `tickArea` also mutates
interaction objects in place inside a state updater.

## Code health

- **why-did-you-render ships to production** (verified: it's in the bundle).
  `wdyr.js` has its dev-only guard commented out, and `vite.config.js` routes
  all JSX through its `jsxImportSource`. It adds weight and render overhead
  for every player.
- **`yarn lint` can't run** (verified): there's no ESLint config in the repo.
  `yarn test` does run; see [testing.md](testing.md).
- **Text files are executable.** `renderTemplate` uses `new Function` and
  sprite action payloads use `eval`. That's fine for first-party files. It
  becomes a code-execution hole if worlds are ever loaded from other people.
- **The font exists in three copies**: repo root, `public/`, and
  `public/assets/`, plus the source zip. `src/index.css` references
  `./ti-83-plus-large.ttf`, which Vite can't resolve. At runtime that
  relative URL resolves to `/ti-83-plus-large.ttf` in dev and
  `/assets/ti-83-plus-large.ttf` in the build, which is why the `public/` and
  `public/assets/` copies both exist. Moving the font next to `index.css`
  (or referencing `/ti-83-plus-large.ttf`) would let Vite fingerprint it and
  delete two copies.
- **Fixed:** interactions on a page's last row or column (rows 8, 16, …,
  cols 16, 32, …) were loaded for the next page, so they were invisible and
  walkable on their own page. `onPage` compared 1-based keys with 0-based
  bounds. None of today's maps had one there.
- **Fixed:** bumping an NPC and then letting time pass (Wait, or loading a
  save) could crash the whole game, blanking the page. When the NPC patrolled
  away, `useInteraction` looked up an interaction for the now-empty cell.
  `src/hooks/useInteraction.test.jsx` reproduces it.
- **Fixed:** a newly opened menu kept the previous menu's selection. After
  choosing Shout (option 2), the reaction opened scrolled past its first
  line, and the next NPC's menu opened on its second item.
  `src/components/DisplayMenu.test.jsx` reproduces both.
- **Fixed:** an interaction coordinate off the map made the whole world fail
  to load. It now loads, and `/tests/` reports the coordinate.
- **Visualizer's viewport filter is a no-op** (read): it filters on
  `coordinate`, but the field is named `coordinates`.
- **`DisplayMenu` target-change effect** keys on `` `${target?.coordinates}` ``
  (see the inline `fixme`), so two different targets at the same coordinate
  don't refresh the menu.
