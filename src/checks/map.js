import {
  parseWorld, isOpen, viewport, onPage, viewArea, terrain, depthRows, explore,
} from '../world';
import { START_WORLD, START_Y, START_X } from '../start';

// A small world drawn for these checks.  0-based [y, x] positions; the file's
// own coordinates are 1-based.
//
//   row 1  #######
//   row 2  #...#β#     β at (2,6): an NPC, walled in except for the counter
//   row 3  #.###|#     | at (3,6): a counter (short wall)
//   row 4  #.#.#.#     (4,4): a sealed pocket...
//   row 5  #.#⬚#.#     ...behind the locked door at (5,4)
//   row 6  #.....#
//   row 7  #######
const TINY = [
  '#######',
  '#...#β#',
  '#.###|#',
  '#.#.#.#',
  '#.#⬚#.#',
  '#.....#',
  '#######',
  '---',
  '#:wall',
  '⬚:door',
  '|:~counter#Climb=You climb onto the counter.',
  '(2,6):Bard/bard.txt',
  '(5,4)=(4,4):Pocket#key=Key',
  'rain.txt@v1:#fg=fff',
  'dust.txt@v1:[2,2,3,3]#fg=888',
  'this line is not a spec',
].join('\n');

export default function register({ describe, it, expect }, content) {
  const tiny = parseWorld(TINY);

  describe('parseWorld', () => {
    it('reads the map art and its size', () => {
      expect(tiny.size).toEqual([7, 7]);
      expect(tiny.map[1].join('')).toBe('#...#β#');
    });

    it('indexes walls by glyph and interactions by 1-based "r,c"', () => {
      expect(Object.keys(tiny.walls)).toEqual(['#', '⬚', '|']);
      expect(Object.keys(tiny.interactions)).toEqual(['2,6', '5,4']);
    });

    it("takes an interaction's glyph from the map", () => {
      expect(tiny.interactions['2,6'].sprite).toBe('β');
      expect(tiny.interactions['5,4'].sprite).toBe('⬚');
    });

    it('keeps zone specs in declaration order', () => {
      expect(tiny.zoneSpecs.map((z) => z.dataFile)).toEqual(['rain.txt', 'dust.txt']);
    });

    it('collects lines that do not parse instead of failing', () => {
      expect(tiny.errors).toHaveLength(1);
    });
  });

  describe('isOpen', () => {
    it('lets you walk on floor but not into walls or interactions', () => {
      expect(isOpen(tiny, 1, 1)).toBe(true);
      expect(isOpen(tiny, 0, 0)).toBe(false);   // wall
      expect(isOpen(tiny, 1, 5)).toBe(false);   // the NPC
      expect(isOpen(tiny, 2, 5)).toBe(false);   // counter
    });

    it('treats cells off the map as open (current behavior: unwalled maps can be walked off)', () => {
      expect(isOpen(tiny, -1, 3)).toBe(true);
      expect(isOpen(tiny, 3, 99)).toBe(true);
    });
  });

  describe('viewport paging', () => {
    it('cuts the map into viewport-sized pages', () => {
      expect(viewport([19, 21], [8, 16])).toEqual({ origin: [16, 16], local: [3, 5] });
    });

    it('turns the page exactly at the edge', () => {
      expect(viewport([7, 15], [8, 16])).toEqual({ origin: [0, 0], local: [7, 15] });
      expect(viewport([8, 16], [8, 16])).toEqual({ origin: [8, 16], local: [0, 0] });
    });

    it("puts an interaction on the page that shows it, including the page's last row and column", () => {
      // 1-based (8,16) is 0-based [7,15]: the bottom-right cell of the first page.
      expect(onPage('8,16', [0, 0], [8, 16])).toBe(true);
      expect(onPage('8,16', [8, 16], [8, 16])).toBe(false);
      expect(onPage('9,17', [8, 16], [8, 16])).toBe(true);
      expect(onPage('9,17', [0, 0], [8, 16])).toBe(false);
    });

    it('shows just the page', () => {
      expect(viewArea(tiny.map, [1, 1], [2, 3]).map((r) => r.join(''))).toEqual(['...', '.##']);
    });
  });

  describe('terrain', () => {
    it('splits a page into solid walls and passable ground, leaving interactions out', () => {
      const area = viewArea(tiny.map, [1, 3], [2, 3]);
      const { solid, passable } = terrain(area, tiny.walls, tiny.interactions, [1, 3]);
      expect(solid).toEqual([['', '#', ''], ['#', '#', '|']]);
      expect(passable).toEqual([['.', '', ''], ['', '', '']]);  // β is an interaction
    });
  });

  describe('depthRows (battle view)', () => {
    const map = ['#.#.', '#..#', '|...'].map((r) => r.split(''));
    const walls = { '#': {}, '|': {} };
    const isShort = (glyph) => glyph === '|';

    it('hides walls behind nearer ones, except behind short ones', () => {
      const [fore, back1, back2] = depthRows(map, walls, isShort, 2, 0, 4);
      expect(fore.join('')).toBe('|   ');
      expect(back1.join('')).toBe('#  #');   // the | in front is short, so # shows
    });

    it('decides by the nearest wall only (current behavior: behind a short wall, everything shows)', () => {
      // Column 0 is | then # then #.  The far # shows even though the middle
      // # is tall, because only the nearest wall (the short |) is consulted.
      const [,, back2] = depthRows(map, walls, isShort, 2, 0, 4);
      expect(back2.join('')).toBe('# # ');
    });
  });

  describe('explore', () => {
    const start = [1, 1];

    it('walks the floor, around corners', () => {
      const { cells } = explore(tiny, start);
      expect(cells.has('6,6')).toBe(true);
      expect(cells.has('2,5')).toBe(false);   // a wall
    });

    it('reaches across a short counter to what is behind it, but not a tall one', () => {
      expect(explore(tiny, start).bumped.has('2,6')).toBe(true);
      const tall = parseWorld(TINY.replace('|:~counter', '|:counter'));
      expect(explore(tall, start).bumped.has('2,6')).toBe(false);
    });

    it('goes through doors it can open, and not locked ones', () => {
      const locked = explore(tiny, start, { canOpen: (door) => !door.attributes.key });
      const keyed = explore(tiny, start);
      expect(locked.bumped.has('5,4')).toBe(true);
      expect(locked.cells.has('4,4')).toBe(false);
      expect(keyed.cells.has('4,4')).toBe(true);
    });
  });

  describe(`world/${START_WORLD}`, () => {
    const world = parseWorld(content.text[`world/${START_WORLD}`]);
    const spawn = [START_Y - 1, START_X - 1];
    const everything = explore(world, spawn);
    const withoutKeys = explore(world, spawn, { canOpen: (door) => !door.attributes.key });
    const named = (key) => `${world.interactions[key].label} at ${key}`;

    it('parses cleanly', () => {
      expect(world.errors.map((e) => e.message)).toEqual([]);
    });

    it('spawns the player on open ground', () => {
      expect(isOpen(world, ...spawn)).toBe(true);
    });

    it('is walled in, so the player cannot walk off it', () => {
      const [height, width] = world.size;
      const edges = [...everything.cells].filter((key) => {
        const [r, c] = key.split(',').map(Number);
        return r === 1 || c === 1 || r === height || c === width;
      });
      expect(edges).toEqual([]);
    });

    it('lets the player reach every NPC and door from the spawn', () => {
      const unreachable = Object.keys(world.interactions)
        .filter((key) => !everything.bumped.has(key))
        .map(named);
      expect(unreachable).toEqual([]);
    });

    it('opens locked rooms with their key, and only with it', () => {
      const lockedDoors = Object.values(world.interactions).filter((i) => i.attributes?.key);
      const entered = lockedDoors.map(({ label, destination: [r, c] }) => ({
        label,
        withoutKey: withoutKeys.cells.has(`${r},${c}`),
        withKey: everything.cells.has(`${r},${c}`),
      }));
      expect(entered).toEqual(lockedDoors.map(({ label }) => ({ label, withoutKey: false, withKey: true })));
    });
  });
}
