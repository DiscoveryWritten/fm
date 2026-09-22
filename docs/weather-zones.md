# Weather and overlay zones

Zones are the overlay system: animated tiled art drawn over the world
display, used for weather outdoors and ambience indoors. Four pieces of code
touch them:

| Step | Where |
| -- | -- |
| Parse `file.txt@dirs:boxes#attrs` | `classifyObjectSpec` in `src/interactions.js` |
| Fetch overlay art, expand to one zone per box | `loadZones` in `src/zones.js`, called by `useWorld` |
| Pick the zone containing the player | `zoneAt` in `src/zones.js`, called by `usePosition` |
| Randomly swap to another zone | `rollWeather` in `src/zones.js`, called by `usePosition` |
| Tile, animate and draw it | the zone overlay effect in `DisplayWorld.jsx` |

Only **one** zone is ever drawn: the one stored in `usePosition`'s `zone`
state.

## Intended semantics

From the README: zones are declared global first and smallest last, and the
**last declared zone containing the player wins**. So a small interior box
("the tavern is dusty") overrides the global weather while you're inside it.

## What the code actually does

### 1. Declaration order was lost at load time (fixed)

Each zone used to be pushed into a shared array when *its own* overlay fetch
finished, so zones ended up in network-arrival order. In a browser, with the
player inside the tavern, delaying `rain.txt` or `clouds.txt` let the global
weather cover the interior.

`loadZones` now has each spec *return* its zones, and flattens the
`Promise.all` result, which keeps input order. `src/zones.test.js` resolves
the fetches in reverse order to prove it: it failed with
`dust, clouds, rain` before the fix. Re-running the browser repro afterwards
showed dust in all four timing cases.

### 2. The "default" global weather is the last global, not the first

Because the last matching zone wins and global zones match everywhere, the
weather you get on load is always the **last** global line (in Terra
Montans, `clouds`). Earlier global zones like
`rain` are only reachable through a random roll. If the first global line was
meant to be the default, the rule and the file disagree.

### 3. Leaving an interior resets the weather

Zone detection only calls `setZone` when the box changes (`priorBox`). A
weather roll replaces `zone` but leaves `priorBox` alone. So:

1. Outdoors, weather rolls from clouds to rain. `priorBox` is still the clouds
   box, so walking around keeps rain. Good.
2. You enter the tavern and get dust.
3. You leave, and detection picks the last global again, which is **clouds**.
   The rain is gone.

The weather state doesn't survive an interior visit.

### 4. Roll frequency is tied to render count, not time

The roll effect in `usePosition` has **no dependency array**, so it
runs after every render of `DisplayWorld`. **Measured in the production
build: 3 rolls per second while idle, and about 4.5 more per arrow-key
press.** A `#100-100=clouds.txt` roll is "1 in 100 per render", so about one
change every 33 s standing still, and faster while walking. Adding unrelated
state to `DisplayWorld` would silently change weather rates.

Roll rule, for authoring: collect every `#min-max=target.txt` on the current
zone. Roll an integer from 1 to the largest `max`. Switch to the first range
that contains the roll. Ranges are inclusive. So `#1-3=a.txt#4-10=b.txt` means
3 in 10 for `a` and 7 in 10 for `b`.

### 5. A roll picks the first zone with that file name

`rollWeather` matches the target by file name only. If that overlay is used for several boxes, or for a box the player
isn't in, you get the first one declared. Once the
zone is set, it draws only inside its box, so the screen can go blank.

### 6. Tiling seam

`DisplayWorld.jsx` wraps the tile position by the **map** size first,
then by the tile size:

```js
const br = ((y - startY + offset[0]) % size[0] + size[0]) % size[0];
const row = buffer[br % buffer.length];
```

When the map height isn't a multiple of the tile height, the pattern jumps
once per map-height of scrolling. Terra Montans is 37 rows, and `rain.txt` is
12 rows and `clouds.txt` 18, so both jump. Wrapping directly by
`buffer.length` and `maxWidth` fixes it. Columns are fine today only because
80 is a multiple of 4.

### 7. Saved zones are overwritten

`zone` is in the save, but on load `priorBox` is `null`, so the first
detection pass replaces the restored zone anyway.

## Where to take it

Items 2–5 all come from one design choice: the *active weather* and the *zone
the player is standing in* share a single state variable. Keeping them apart
fixes all four:

- **Weather** per global layer, rolled on a timer.
- **Interior** zone, derived purely from position and declaration order.
- **Draw** the interior if there is one, else the weather.
