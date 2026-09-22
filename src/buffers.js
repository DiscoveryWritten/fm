// Buffers are the unit of drawing.  A buffer is
//
//   { fg, bg?, buffer, at? }
//
// where `buffer` is an array of rows (strings or arrays of characters) and
// `at` is the [row, col] of its top-left corner on the screen, [0, 0] by
// default.  A buffer is only as big as what it draws; `at` places it, so a
// view can draw in its own coordinates and be put anywhere.

// Cells that draw nothing and paint no background.  (ˣ is listed for the
// background only: a cell holding it still draws the glyph.)
export const BLANK = ['ˣ', '', null, undefined];

// The character a buffer puts at screen cell (y, x), if any.
export function cellAt({ buffer, at=[0, 0] }, y, x) {
  const [r, c] = at;
  if (y < r || x < c) return undefined;
  return buffer[y - r]?.[x - c];
}

// Move buffers by [rows, cols], on top of wherever they already are.
// Falsy entries (the `cond && {...}` idiom) pass through untouched.
export function place(buffers, [rows, cols]) {
  return buffers.map((buffer) => buffer && {
    ...buffer,
    at: [(buffer.at?.[0] || 0) + rows, (buffer.at?.[1] || 0) + cols],
  });
}

// What each screen cell shows once the buffers are stacked, later ones on
// top: { glyph, fg, bg }.  Every background counts as opaque here, so a
// translucent one (like the world screen's '#ccc7' dimmer) hides glyphs it
// would really let show through.  Use this to test layout and glyphs.
export function composite(buffers, width, height, { fg: defaultFg, bg: defaultBg }={}) {
  const cells = Array.from({ length: height }, () => (
    Array.from({ length: width }, () => ({ glyph: null, fg: null, bg: null }))
  ));
  buffers.filter(Boolean).forEach(({ fg=defaultFg, bg=defaultBg, ...buffer }) => {
    cells.forEach((row, y) => row.forEach((cell, x) => {
      const char = cellAt(buffer, y, x);
      if (!BLANK.includes(char) && bg) {
        Object.assign(cell, { glyph: null, fg: null, bg });
      }
      if (char && `${char}`.trim()) {
        Object.assign(cell, { glyph: char, fg: fg ?? null });
      }
    }));
  });
  return cells;
}

// The visible glyphs as lines of text, for asserting what a screen shows.
export function screenText(buffers, width, height, empty=' ') {
  return composite(buffers, width, height).map(
    (row) => row.map(({ glyph }) => glyph ?? empty).join('')
  );
}
