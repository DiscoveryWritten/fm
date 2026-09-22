// The map system as plain functions: parsing a world file, what's walkable,
// the paged viewport, the terrain layers, and exploring what a player can
// reach.  Positions here are 0-based [y, x]; world files and interaction keys
// are 1-based "r,c".

import { classifyObjectSpec, TYPES } from './interactions';

export const STEPS = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

const keyOf = (y, x) => `${y + 1},${x + 1}`;

// Split a world file into its map art and object specs.
//   map:          rows of single characters
//   size:         [rows, cols]
//   walls:        sprite glyph -> spec; any map cell with that glyph is solid
//   interactions: "r,c" -> spec, with `sprite` taken from the map at r,c
//                 (undefined when r,c is off the map)
//   zoneSpecs:    overlay zone specs, in declaration order
//   errors:       lines that didn't parse
export function parseWorld(text) {
  const [art, objects] = text.trim().split('---\n');
  const rows = art.trim().split('\n');
  const errors = [];
  const specs = (objects || '').split('\n').map((line) => {
    if (!line.length) return false;
    try {
      return classifyObjectSpec(line);
    } catch (e) {
      errors.push(e);
      return false;
    }
  }).filter(Boolean);

  return {
    map: rows.map((row) => row.split('')),
    size: [rows.length, rows[0].length],
    walls: Object.fromEntries(
      specs.filter(({ type }) => type === TYPES.SPRITE).map((spec) => [spec.sprite, spec])
    ),
    interactions: Object.fromEntries(
      specs.filter((spec) => spec.coordinates).map((spec) => {
        const [r, c] = spec.coordinates;
        spec.sprite = rows[r - 1]?.[c - 1];
        return [`${r},${c}`, spec];
      })
    ),
    zoneSpecs: specs.filter((spec) => spec.boxes),
    errors,
  };
}

// Can the player step into (y, x)?  Walls and interactions block; so moving
// into them bumps instead.  Cells off the map count as open (known issue:
// a map without a solid border lets the player walk off it).
export function isOpen({ map, walls, interactions }, y, x) {
  return !walls[map[y]?.[x]] && !interactions[keyOf(y, x)];
}

// The world screen pages rather than scrolls: the map is cut into
// viewport-sized pages, and the page holding the player is shown.
export function viewport([y, x], [height, width]) {
  const local = [y % height, x % width];
  return { origin: [y - local[0], x - local[1]], local };
}

// Is the interaction at 1-based "r,c" on the page starting at 0-based `origin`?
export function onPage(key, [originY, originX], [height, width]) {
  const [y, x] = key.split(',').map((n) => Number(n) - 1);
  return y >= originY && y < originY + height && x >= originX && x < originX + width;
}

// The visible page of the map.
export function viewArea(map, [originY, originX], [height, width]) {
  return map.slice(originY, originY + height).map((row) => row.slice(originX, originX + width));
}

// Split the visible page into solid (walls) and passable (everything else
// that isn't an interaction, which is drawn by its own layer).
export function terrain(area, walls, interactions, [originY, originX]) {
  return {
    solid: area.map((row) => row.map((cell) => walls[cell] ? cell : '')),
    passable: area.map((row, r) => row.map((cell, c) => (
      walls[cell] || interactions[keyOf(originY + r, originX + c)] ? '' : cell
    ))),
  };
}

// Battle view's depth rows: walls on the player's row and the two above, as
// seen from the player's row.  A wall stays visible unless a nearer row
// already has a wall in that column, unless that nearer wall is short.
// Returns [foreground, background1, background2].  (On the map's top two rows
// the slice start goes negative and wraps to the bottom rows; those rows are
// walls on today's maps.)
export function depthRows(map, walls, isShort, posY, originX, width) {
  const rows = map.slice(posY - 2, posY + 1)
    .map((row) => row.slice(originX, originX + width))
    .reverse();
  const layers = [];
  rows.forEach((row) => {
    const line = Array.from({ length: row.length }, () => ' ');
    row.forEach((cell, index) => {
      if (!walls[cell]) return;
      const nearer = layers.find((layer) => walls[layer[index]]);
      if (!nearer || isShort(nearer[index])) {
        line[index] = cell;
      }
    });
    layers.push(line);
  });
  return layers;
}

// Everything reachable from `start` on foot.  Doors on this map carry the
// player to their destination when `canOpen(door)` allows, and a short wall
// (a counter) lets them reach an interaction just behind it.
//   cells:  "r,c" of every cell the player can stand on
//   bumped: "r,c" of every interaction they can bump into or reach
export function explore(world, [startY, startX], { canOpen=() => true }={}) {
  const { map, walls, interactions, size: [height, width] } = world;
  const cells = new Set([keyOf(startY, startX)]);
  const bumped = new Set();
  const queue = [[startY, startX]];
  const onMap = (y, x) => y >= 0 && x >= 0 && y < height && x < width;
  const stand = (y, x) => {
    if (cells.has(keyOf(y, x))) return;
    cells.add(keyOf(y, x));
    queue.push([y, x]);
  };

  while (queue.length) {
    const [y, x] = queue.shift();
    Object.values(STEPS).forEach(([dy, dx]) => {
      const [ny, nx] = [y + dy, x + dx];
      if (!onMap(ny, nx)) return;
      if (isOpen(world, ny, nx)) {
        stand(ny, nx);
        return;
      }
      const interaction = interactions[keyOf(ny, nx)];
      if (interaction) {
        bumped.add(keyOf(ny, nx));
        if (interaction.type === TYPES.DOOR && canOpen(interaction)) {
          const [r, c] = interaction.destination;
          stand(r - 1, c - 1);
        }
        return;
      }
      if (walls[map[ny][nx]]?.label.startsWith('~')) {
        const behind = keyOf(ny + dy, nx + dx);
        if (interactions[behind]) bumped.add(behind);
      }
    });
  }
  return { cells, bumped };
}
