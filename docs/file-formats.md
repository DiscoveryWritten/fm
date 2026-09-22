# Text file formats

Everything under `public/` is fetched at runtime by relative URL. Editing a
file and reloading is the whole authoring loop. `yarn test content` checks
every shipped file against the rules below.

The grammars below are transcribed from the regexes in `src/interactions.js`
and the loaders in `src/utils.js`. They were checked by running the real
parser over the shipped files. **Coordinates are 1-based `(row,col)`**, which
matches a text editor's cursor position. Map glyphs are counted per UTF-16
code unit, so stick to BMP characters (the TI-83 font's glyphs all are).

## `public/world/<World Name>.txt`

```
<map art, any number of rows>
---
<object spec, one per line>
```

Only the **first** `---` split matters. The loader keeps `[map, objects]`
and silently drops any third section (`yarn test content` flags one).

Each spec line is tried against these patterns **in this order**, and the first
match wins:

### 1. Sprite (wall glyph)

```
<glyph>:<label>[#attr=value]...
```

- Any map cell containing `<glyph>` is solid.
- Prefix the label with `~` to make it **short**: it can be climbed, you can
  talk across it, and it doesn't hide farther walls in battle view.
- **Lowercase** attributes are data.
- **Capitalized** attributes are menu actions, shown when you bump the glyph.
  Each one dispatches `<Action>.player`.
- An action can carry a JS object literal that gets merged into the action:
  `#Sleep{quality:120}=You lie down…` produces `detail.quality = 120`. That
  literal is passed to `eval`.
- Handled actions today: `Climb`, and `Sleep{quality:N}`, which heals up to
  `N` HP. Any other name dispatches an event that nothing handles yet.

```
⌸:~bed#Climb=You shamble onto the bed.#Sleep{quality:120}=You lie down and close your eyes.
```

### 2. Zone (overlay / weather)

```
<overlay>.txt@<directions>:<boxes>[#attr=value]...
```

- `<overlay>` must match `\w+`: letters, digits and `_` only.
- `<directions>` is **required** and is one or more of `v n`, `^ n`, `> n`,
  `< n` with no spaces, for example `v2` or `^1>2`. Each step is one animation
  frame (one second). Use `>0` for a static overlay.
- `<boxes>` is empty (global) or `[r1,c1,r2,c2]`, separated by `;` with no
  spaces. Box bounds are inclusive and 1-based.
- `#fg=RGBA` / `#bg=RGBA`: hex without the `#`, any CSS hex length. The
  default fg is `f00`.
- `#min-max=<other>.txt` is a weather roll. See [weather-zones.md](weather-zones.md).
- **Declare large to small.** The last declared zone that contains the player
  wins, so interiors go after the global weather.

```
rain.txt@v2:#fg=fff8#100-100=clouds.txt
dust.txt@v1^1:[19,37,23,44]#fg=8888
```

### 3. World door

```
(r,c)=(r2,c2):<Label>/<file>.txt
```

- Bump `(r,c)` twice to load `world/<file>.txt` and spawn at `(r2,c2)`, in
  the new map's coordinates.
- `<file>` must match `\w+`, so **no spaces**. `High Canopy.txt` can't be the
  target of a world door as named.

### 4. NPC

```
(r,c):<Class>/<file>.txt[#attr=value]...
```

- Loads `interactions/<Class>/<file>.txt`.
- The NPC's glyph is whatever the map art has at `(r,c)`.
- The display name is `<file>` with its first letter capitalized.
- `#idle=<directions>` gives a patrol loop. It's only used if the NPC has a
  `Fight` section.

### 5. Door

```
(r,c)=(r2,c2):<Label>[#key=<item name>][#text=<locked message>]
```

- Same-map teleport. Bump it twice, or use its `Open` menu item.
- With `key`, you must be wearing an item with that exact name (or id) in a
  **ring** slot.
- `text` is template-rendered with the attributes, so `${key}` works.

### 6. Object

```
(r,c):<Label>[,$<inventory>]...[#Attr=text]...
```

- Capitalized attributes become text-only menu actions.
- The `,$…` inventory suffix is parsed but not used yet.

A line that matches nothing is logged with `console.error` and skipped.

## `public/overlays/<name>.txt`

This is raw tile art. Trailing blank lines are trimmed and lines may be
ragged, because short lines are padded to the longest one. The world file
supplies colour, area and motion.

## `public/interactions/<Class>/<name>.txt`

Sections separated by `---`. The first line of each section is its **name**,
and the rest is its **text**. Each whole section is a JS template literal,
evaluated with `new Function`, and the scope is:

- every lowercase attribute from the world spec line,
- `name`: the save slot, `Hero` until saved,
- `possesses(kind, nameOrId)`.

| Section | Meaning |
| -- | -- |
| *anything* (e.g. `Look`, `Greet`) | Text-only menu item. Dispatches nothing. |
| `?Name` | Hidden reaction. When the ambient menu dispatches `Ambient{name: 'Name'}`, this NPC's section auto-opens. Today that's `Shout` or `Hide`. |
| `Save` | Menu item. Dispatches `Save`, and its text is the NPC's line. |
| `Load` | Meant to list save slots. Currently broken (see known issues). |
| `Buy` | One equipment line per item (format below). Items you already own are hidden. |
| `Sell` | Comma list of equipment kinds this NPC buys, e.g. `weapon,body`. |
| `Fight` | Line 1: `hp:N,spd:N`. Line 2: `damage:strategy,…` breakpoints (e.g. `0:idle,1:attack,4:enrage`; a final `die` is added automatically). Remaining lines: the NPC's equipment. Only `idle` is implemented as a strategy. |

Every NPC also gets an invisible `Harm` entry. See known issues.

## Equipment lines (inside `Buy` and `Fight`)

```
<kind>/<template>/<rarity>/<Display Name>/<stat>[/<id>]
```

| Field | Meaning |
| -- | -- |
| `kind` | `weapon`, `body`, `legs`, `feet`, `head`, `arms`, `shield`, `waist`, `ring` (`hair` exists as a sprite kind but isn't sold) |
| `template` | Sprite file `equipment/<kind>/<template>.txt` |
| `rarity` | `0`–`4`, drawn grey, silver, green, yellow, magenta |
| `stat` | Attack for `weapon`, defence for everything else |

`public/equipment/examples.txt` is a catalog of lines in this format with a
`$` prefix. It isn't loaded by anything.

## `public/equipment/<kind>/<template>.txt`

```
<rowOffset>:<glyphs>
<rowOffset>:<left>,<right>     (paired slots: arms, waist, feet)
---                            (optional)
<statLetter>:<value>           (optional stat overrides)
```

The sprite is drawn on a small paper-doll grid, relative to the slot's anchor
in `useSubDisplayEquip.jsx`. The first non-blank glyph becomes the item's menu
**icon**. For example, `weapon/sword.txt`:

```
-1: |
0: ᵀ
```

`none.txt` in each kind is the empty-slot sprite.

## `public/world/debug.txt`

This is the font glyph sheet. It's reachable in-game via the world door at
`(22,36)` in Terra Montans, and it's shown in the Visualizer. It has no object
section.
