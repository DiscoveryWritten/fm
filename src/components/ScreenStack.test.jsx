// @vitest-environment jsdom
//
// Characterizes how a stack of buffers composites into what the player sees.
// Assertions are about the visible result per cell, not about the DOM, so
// they should keep holding while the buffer system is reworked underneath.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import ScreenStack from './ScreenStack';

const TRANSPARENT = ['', 'transparent', undefined];

// Render a stack and read back, per cell, the glyph and colors on top.
// Layers paint in DOM order; a cell with a background covers what's below it.
function seen({ width, height, buffers, gutter='gutter' }) {
  const root = document.createElement('div');
  root.innerHTML = renderToStaticMarkup(
    <ScreenStack width={width} height={height} magnification={1} gutter={gutter} buffers={buffers} />
  );
  const screens = [...root.querySelectorAll('.screen')];
  return Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => {
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

const glyphs = (cells) => cells.map((row) => row.map((c) => c.glyph ?? '.').join(''));

describe('ScreenStack compositing', () => {
  it('draws rows given as strings or as arrays of characters', () => {
    const cells = seen({ width: 3, height: 2, buffers: [
      { fg: 'black', buffer: ['abc', ['d', 'e', 'f']] },
    ]});
    expect(glyphs(cells)).toEqual(['abc', 'def']);
  });

  it('draws later buffers over earlier ones', () => {
    const cells = seen({ width: 3, height: 1, buffers: [
      { fg: 'gray', buffer: ['abc'] },
      { fg: 'black', buffer: [['', 'X', '']] },
    ]});
    expect(glyphs(cells)).toEqual(['aXc']);
    expect(cells[0].map((c) => c.fg)).toEqual(['gray', 'black', 'gray']);
  });

  it('lets empty, null and missing cells show through', () => {
    const cells = seen({ width: 4, height: 2, buffers: [
      { fg: 'gray', buffer: ['abcd', 'efgh'] },
      { fg: 'black', bg: 'white', buffer: [['', null, undefined]] },  // short row, missing row
    ]});
    expect(glyphs(cells)).toEqual(['abcd', 'efgh']);
    expect(cells.flat().every((c) => c.bg === null)).toBe(true);
  });

  it('paints a background under a space, hiding what is below', () => {
    const cells = seen({ width: 3, height: 1, buffers: [
      { fg: 'gray', buffer: ['abc'] },
      { fg: 'black', bg: 'white', buffer: [['', ' ', '']] },
    ]});
    expect(glyphs(cells)).toEqual(['a.c']);
    expect(cells[0][1].bg).toBe('white');
  });

  it('does not hide what is below a space without a background', () => {
    const cells = seen({ width: 3, height: 1, buffers: [
      { fg: 'gray', buffer: ['abc'] },
      { fg: 'black', buffer: ['   '] },
    ]});
    expect(glyphs(cells)).toEqual(['abc']);
  });

  it('draws a glyph and its background together', () => {
    const cells = seen({ width: 2, height: 1, buffers: [
      { fg: 'gray', buffer: ['ab'] },
      { fg: 'black', bg: 'white', buffer: [['Z']] },
    ]});
    expect(cells[0][0]).toEqual({ glyph: 'Z', fg: 'black', bg: 'white' });
    expect(cells[0][1]).toEqual({ glyph: 'b', fg: 'gray', bg: null });
  });

  it('ignores characters past the screen width', () => {
    const cells = seen({ width: 2, height: 1, buffers: [{ fg: 'black', buffer: ['abcdef'] }] });
    expect(glyphs(cells)).toEqual(['ab']);
  });

  it('positions partial buffers only by padding rows and cells (current behavior)', () => {
    // There is no offset: to draw on row 2, col 1 a buffer carries two blank
    // rows and a blank cell.  This is what sized, positioned buffers would replace.
    const cells = seen({ width: 3, height: 3, buffers: [
      { fg: 'black', buffer: ['', '', ['', 'X']] },
    ]});
    expect(glyphs(cells)).toEqual(['...', '...', '.X.']);
  });

  it('treats ˣ as blank for the background only; the glyph still draws (current behavior)', () => {
    const cells = seen({ width: 1, height: 1, buffers: [
      { fg: 'black', bg: 'white', buffer: [['ˣ']] },
    ]});
    expect(cells[0][0]).toEqual({ glyph: 'ˣ', fg: 'black', bg: null });
  });
});
