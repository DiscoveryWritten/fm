// Painting a world's map art, one cell at a time, as text: everything in the
// file but that one character is left as it was.
import { mapSection } from './world';

// The world file with `glyph` at 1-based (row, col) of its map.  Painting
// past the edge grows the map, padding with spaces.
export function paintCell(text, row, col, glyph) {
  if (glyph.length !== 1) throw new Error(`A map cell holds one character, not "${glyph}"`);
  const { start, end, rows } = mapSection(text);
  const grid = rows.map((line) => line.split(''));
  while (grid.length < row) grid.push([]);
  const line = grid[row - 1];
  while (line.length < col - 1) line.push(' ');
  line[col - 1] = glyph;
  return text.slice(0, start) + grid.map((cells) => cells.join('')).join('\n') + text.slice(end);
}

// What there is to paint with in a world: its declared sprites (walls, with
// their labels), the other glyphs its art uses, and open ground.
export function palette({ map, walls }) {
  const declared = Object.entries(walls).map(([glyph, { label }]) => ({ glyph, label }));
  const known = new Set([' ', ...declared.map(({ glyph }) => glyph)]);
  const art = [...new Set(map.flat())].filter((glyph) => !known.has(glyph)).sort()
    .map((glyph) => ({ glyph, label: 'art' }));
  return [{ glyph: ' ', label: 'ground' }, ...declared, ...art];
}
