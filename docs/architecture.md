# Architecture

## Boot sequence

1. `index.html` blocks the browser's default scroll on Space and arrow keys,
   then loads `src/main.jsx`.
2. `main.jsx` imports `wdyr.js` first. That turns on why-did-you-render
   **unconditionally**, in production too (the `NODE_ENV` guard is commented
   out). Then it renders `<App>` inside `React.StrictMode`.
3. `App.jsx` holds the top-level state: viewport `width`/`height` (16×8),
   `magnification`, the current world file plus spawn point, the ambient menu,
   `battle`, and the current `interaction` (the thing you bumped). It creates
   the player's inventory via `useInventory('player')`.
4. `App` renders `DisplayStats`, `DisplayWorld` and `DisplayMenu` side by side,
   then the hidden `Visualizer` debug panel.

Starting world and position are constants at the top of `App.jsx`:
`Terra Montans.txt`, row 20, col 22 (1-based). Props subtract 1, because the
engine works 0-based internally and the text files are 1-based.

## Component and hook map

```
App
├─ useInventory('player')        stats, inventory, equipment, log + Buy/Sell/Equip/Acquire/Drop/Sleep event handlers
├─ useSave(...)                  magnification, width, height, startWorld, startX, startY
├─ useEventInteraction           'interaction'  -> setInteraction
├─ useEventFight                 'Fight' / 'Sheathe' -> setBattle
├─ useEventDestination           'destination'  -> change world / spawn point
│
├─ DisplayStats  (status screen, WASD/Space/Esc)
│   ├─ useSubDisplayEquip  -> useSpriteLayers + useDisplayEquipable   "Equip" tab (paper-doll)
│   ├─ useSubDisplayRings  -> useSpriteLayers + useDisplayEquipable   "Rings" tab (8 ring slots)
│   └─ useSubDisplayLog    -> useEventKeys                            "Log" tab
│
├─ DisplayWorld  (world screen, arrows)
│   ├─ useLocation
│   │   ├─ useWorld          fetch + parse world file, fetch overlays -> map, walls, interactions, zones
│   │   └─ usePosition       player x/y, bump detection, door traversal, zone detection, weather rolls
│   └─ useInteraction        turns a bump into the targeted interaction + highlight buffer
│
├─ DisplayMenu   (menu screen, j/k, -/=, digits, Enter, Backspace)
│
└─ Visualizer    (debug dump below the game, toggled by the checkbox)
```

## Rendering: the buffer stack

Every display is a `ScreenStack`: a fixed-size box with several absolutely
positioned `Screen`s layered on top of each other. A `Screen` is a
`height × width` grid of `<span>`s, one per character cell, each 12×20 px
scaled by CSS `zoom: magnification`.

A **buffer** is `{ fg, bg?, buffer }`, where `buffer` is an array of rows.
Each row is either a string or an array of single characters.

- A blank cell (`''`, `null`, `undefined`, or the sentinel `ˣ`) is transparent,
  so lower layers show through.
- A cell containing a space `' '` still paints its `bg`. That's how the menu
  draws inverted bars.
- Later buffers draw on top of earlier ones.

This is how the TI-83 greyscale look is built: each colour is its own layer.
For example, `DisplayWorld` stacks, bottom to top:

| Layer | fg | Source |
| -- | -- | -- |
| solid | `#555` | map cells whose glyph is a declared sprite (wall) |
| passable | `#888` | every other map glyph that isn't an interaction |
| interaction highlight | `#f50` | `▒` on a bumped interaction, `⬚` on an empty bump |
| objects | `#000` | NPCs and other coordinate interactions |
| player | `#000` | `Θ` at the local position |
| active dim | bg `#ccc7` | dims the screen, redrawing player and target, while a non-incidental target is selected |
| zone overlay | zone `fg`/`bg` | the weather or ambience tile (see [weather-zones.md](weather-zones.md)) |

**Viewport paging:** the world doesn't scroll, it flips pages. The origin is
`pos - (pos % viewport)` on each axis, so the map is cut into fixed 16×8 pages
and you jump a whole page when you cross an edge.

**Battle view** (`battle !== null`) squashes the three map rows at and above
the player into one horizontal strip. Nearer rows are drawn darker, and NPCs
on those rows are placed on the strip that matches their depth.
`useLocation` computes these rows as `foreground`, `background1` and
`background2`. Short sprites (`~` prefix) let farther walls show through.

## Mobile: calculator mode

Below 900 px wide (`COMPACT_QUERY` in `App.jsx`), the page becomes a
calculator.

- **One screen at a time.** Only one display is shown. The others stay
  mounted, just `hidden`, so their state and key listeners keep running.
- **Fitted zoom.** The shown screen is scaled to fit the window above the
  keypad (`useFitMagnification`). That fitted value is never saved, so it
  doesn't overwrite the desktop zoom.
- **The keypad plays the keyboard.** `Keypad` dispatches the same
  `keydown`/`keyup` events on `window` that a real keyboard would, using the
  focused screen's keymap. The display components don't know it exists.

| Button | STAT | WORLD | MENU |
| -- | -- | -- | -- |
| ▲ ▼ ◀ ▶ | `w s a d` | arrows | `k j`, and `-` / `=` for paging |
| CLEAR | `Escape` | none | `Backspace` |
| ENTER | Space | none | `Enter` |
| 1–0 | digits (the menu uses them) | | |

The d-pad repeats while held. The soft keys STAT / WORLD / MENU pick the focus.
Focus also moves on its own:

- **To MENU** when an `interaction` arrives that has something to pick.
  Bumping a plain wall doesn't count.
- **Back to WORLD** when the interaction ends, on `destination`, and on
  `Fight`.

Shift+letter menu shortcuts for options past the tenth have no button yet.
Paging reaches them instead.

## World model

`useWorld` fetches `world/<file>` and splits it on `---\n`:

- **Section 1: map art.** Each row becomes an array of characters.
- **Section 2: object specs.** Each line is classified by
  `classifyObjectSpec` in `src/interactions.js` into one of `sprite`, `zone`,
  `world`, `npc`, `door` or `obj`. See [file-formats.md](file-formats.md).
- **Any further `---` section is ignored** (see
  [known-issues.md](known-issues.md#high-canopy-overlay-never-loads)).

Outputs:

- `walls`: sprite glyph → spec. Any map glyph listed here is solid.
- `interactions`: `"r,c"` (1-based) → spec, with `sprite` filled in from the map glyph at that cell.
- `zones`: one entry per overlay box (see weather doc).

`useLocation` then **hydrates** interactions: for every coordinate
interaction inside the current page, and every wall sprite, it fetches the NPC
data file if there is one, then calls `parseInteraction`. That:

- splits the data file into `---` sections,
- runs each section through `renderTemplate` (a JS template literal whose
  scope is `{...attributes, name, possesses}`),
- applies the type-specific `amend*` function. This is where doors get `Open`,
  world doors get `Enter`, sprites get their capitalized-attribute actions, and
  NPC sections named after something in `src/actions/` get parsed by it.

The hydrated map is the one movement, rendering and menus actually read.
Re-hydration happens whenever the page origin, map, walls or `possesses`
change.

### Movement, bumping, doors

`usePosition` owns the player's `x`/`y`, 0-based. On an arrow key:

- **Target cell is free** (not a wall glyph and not an interaction): move there,
  clear `bump`, and dispatch `interaction(null)`.
- **Target cell is blocked:** record `bump = [row, col]`. `useInteraction`
  resolves what was bumped. If it's a **short** wall with an interaction
  directly behind it, it reaches over (talking across a counter). Otherwise it
  synthesizes an interaction from the wall sprite. Then `DisplayWorld`
  dispatches `interaction`, which `App` stores and `DisplayMenu` turns into a
  menu.
- **Same blocked cell bumped twice in a row, and it has a `destination`:**
  dispatch `destination`, as long as there's no `key` or you're wearing it as a
  ring. `App` updates `startWorld`/`startY`/`startX`, and `usePosition` resets
  to that spawn.
- **`Climb.player` event** (from a short sprite's `Climb` action): teleport
  onto the bumped cell.

**NPC movement:** each time the player moves, and on the ambient `Wait`
action, `tickArea` advances every hydrated interaction that has a `Fight`
block. It picks a strategy by HP breakpoint (only `idle` exists) and moves the
NPC along its `#idle=` direction list. Movement ignores walls and the player.

## Menus

`DisplayMenu` keeps a **stack** of menus. The top title bar lists the stack
(`→♦ Label`, then `1:Buy`, and so on).

- With no target, the stack is the ambient menu from `App`: the world name,
  then `Wait`, `Shout` and `Hide`.
- With a target, the root menu lists every value on the target object that has
  a `name` and isn't `hidden`. These come from the NPC's data-file sections,
  a door's `Open`, a sprite's actions, and so on.
- Each item may have:
  - `event`: dispatched on `window` with the item itself as `detail`.
  - `items`: a sub-list (an array, or a function of `{inventory}`).
  - `text`: shown as scrollable wrapped text.
  - `consume`: removed from the list after use.
  - `price`: shown in the info bar and blocks use if you can't afford it.
- `Enter` pushes, `Backspace` pops. Popping the root, or any auto-started
  menu, ends the interaction.
- **Reactive `?Name` sections:** the ambient `Shout` and `Hide` dispatch
  `Ambient` with `{name}`. `DisplayWorld` finds every on-screen NPC that has
  that (hidden) section and dispatches an `interaction` with
  `start: '<Name>'`, so that NPC's reaction opens without you bumping it.

Events queued by a keypress are de-duplicated before dispatch. That works
around a double-fire inside a `setState` updater, documented inline at
`DisplayMenu.jsx:175`.

## Inventory, equipment, stats

`useInventory(subject)` holds `hp`, `strength`, `defense`, `speed`, `gold`,
`inventory` (`{kind: [item…]}`), `equipment` (`{slot: itemId}`) and `log`. All
of it is exposed through **refs** (`stats.current`, `handlers.current`), which
is why `App` passes `handlers.current.equip` and similar props.

Every mutation goes through a `<Verb>.<subject>` event. The handlers are
`Buy`, `Sell`, `Acquire`, `Drop`, `Equip` and `Sleep`, so `Buy.player` is what
a shop menu item dispatches.

- Item ids are assigned on acquire as `max(existing ids) + 1`, per kind.
- Equipping adjusts `strength` (A stat) or `defense` (D stat) by the
  difference from the previously equipped item.
- Ring slots are `ring1a` … `ring4b`. They all draw from `inventory.ring`, and
  `possesses('ring', nameOrId)` checks all of them.
- Price is `(rarity + 1) * (sum of stats + 1)`. Buying stores a negative price
  and selling a positive one, so there's no margin either way.

## Saves

`useSave({ key: [value, setter], … })` is called by `App`, `DisplayWorld`,
`usePosition`, `DisplayStats`, `useInventory` and `useSubDisplayLog`. Each call
registers two listeners on `window`:

- **`Save`** (dispatched by an NPC's `Save` action): writes every value to
  `localStorage["<slot>/<key>"]` as JSON, and sets `localStorage.latest` to the
  slot. The slot comes from `event.detail.slot`, or `latest`, or `"Hero"`.
  Menu items never carry a `slot`, so in practice the slot is always `Hero`.
- **`load`**: reads every key back and calls its setter. Each hook also
  does this once when it mounts, if a save exists (`localStorage.latest` is
  set), so a reload always resumes. It no longer depends on the browser's
  page `load` event firing after React is ready. Dispatching `load` with
  `detail.slot` restores that slot.

Keys written per slot: `magnification`, `width`, `height`, `startWorld`,
`startX`, `startY`, `x`, `y`, `zone`, `menuChoice`, `player/hp`,
`player/strength`, `player/defense`, `player/speed`, `player/gold`,
`player/inventory`, `player/equipment`, `player/log`, `logLength`,
`logScrollOffset`, `logText` and `logTextOffset`.

`DisplayWorld` has a second, write-only `useSave` for the same world keys,
because `App`'s copy lost a save-before-remount race (see its comment).

## Event catalog

All of these are dispatched on `window`.

| Event | Dispatched by | Handled by | Payload |
| -- | -- | -- | -- |
| `interaction` | usePosition (move → `null`), DisplayWorld (bump, ambient reaction), DisplayMenu (cancel → `null`) | App → `interaction` state | hydrated interaction or `null` |
| `destination` | usePosition (double bump), door `Open` / world `Enter` menu items | App | `{destination: [r,c], dataFile?}` |
| `Fight` | NPC `Fight` menu item | App → `battle` | the parsed Fight action |
| `Sheathe` | **nothing** (see known issues) | App → `battle = null` | |
| `Wait` | ambient menu | useLocation → NPC tick | |
| `Ambient` | ambient `Shout`/`Hide` | DisplayWorld → reactive `?Name` | `{name}` |
| `Save` | NPC `Save` item | every `useSave` | menu item (`slot` optional) |
| `load` | the browser, once | every `useSave` | |
| `Buy.player`, `Sell.player` | shop menu items | useInventory | `{kind, price, item, target}` |
| `Acquire.player`, `Drop.player` | Buy/Sell handlers | useInventory | `{kind, item}` |
| `Acquire.<NpcName>` | Sell handler | nothing yet | `{kind, item}` |
| `Equip.player` | status screen | useInventory | `{kind, id}` |
| `Sleep.player` | sprite action `Sleep{quality:N}` | useInventory | `{quality}` |
| `Climb.player` | sprite action `Climb` | usePosition | |
| `<Action>.player` | any other capitalized sprite attribute | nothing | the action |
| `Harm.player` | never shown (item has no `name`) | nothing | |
| `world`, `_overlay`, `_interaction`, `_item`, `origin` | loaders | Visualizer (debug only) | raw text and parse results |

## The dormant classifier

`src/worker.js` runs a Transformers.js zero-shot classifier
(`Xenova/mobilebert-uncased-mnli`, loaded from `public/models/`) in a module
Web Worker. `useWorker` and `useAnalyzer` wrap it with labelled "blocks"
(`Costs`, `Occupation`, …) that score free text against hypotheses. All of
that is commented out in `App.jsx`, and the input bar is `hidden`. `App`
still imports `useAnalyzer` but never calls it, so tree-shaking leaves the
worker out of the build (`dist/assets` has no worker chunk). The model files
are still copied to `dist/` anyway.

## Tooling state

- There are **no tests**.
- `yarn lint` fails immediately because no ESLint config file exists in the
  repo.
- `yarn build` works and emits one warning: the font `url()` in
  `src/index.css` is left for runtime (explained in [deployment.md](deployment.md)).
- `.github/workflows/jekyll-gh-pages.yml` builds and deploys `dist/` to GitHub
  Pages on pushes to `main`, using `public/CNAME` = `fm.discoverywritten.com`.
