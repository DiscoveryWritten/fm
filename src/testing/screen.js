// Test helper (DOM only): read what a rendered ScreenStack shows, per cell:
// { glyph, fg, bg } from the topmost paint.  Layers paint in DOM order, and a
// cell with a background covers what's below it.
const TRANSPARENT = ['', 'transparent', undefined];

export function readScreen(element) {
  const screens = [...element.querySelectorAll('.screen')];
  const rows = screens[0].querySelectorAll('.screen-row');
  return [...rows].map((_, y) => [...rows[y].children].map((_, x) => {
    const cell = { glyph: null, fg: null, bg: null };
    screens.forEach((screen) => {
      const span = screen.querySelectorAll('.screen-row')[y].children[x];
      const { color, backgroundColor } = span.style;
      if (!TRANSPARENT.includes(backgroundColor)) {
        Object.assign(cell, { glyph: null, fg: null, bg: backgroundColor });
      }
      const text = span.textContent;
      if (!TRANSPARENT.includes(color) && text.trim() && text !== '&nbsp;') {
        Object.assign(cell, { glyph: text, fg: color });
      }
    });
    return cell;
  }));
}

// The glyphs as lines of text, with `empty` for blank cells.
export const screenLines = (cells, empty=' ') => cells.map(
  (row) => row.map((cell) => cell.glyph ?? empty).join('')
);
