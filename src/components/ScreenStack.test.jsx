// @vitest-environment jsdom
//
// Characterizes how a stack of buffers composites into what the player sees.
// Assertions are about the visible result per cell, not about the DOM, so
// they should keep holding while the buffer system is reworked underneath.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import ScreenStack from './ScreenStack';
import { composite } from '../buffers';
import { readScreen } from '../testing/screen';

// Render a stack statically and read back what each cell shows.
function seen({ width, height, buffers, gutter='gutter' }) {
  const root = document.createElement('div');
  root.innerHTML = renderToStaticMarkup(
    <ScreenStack width={width} height={height} magnification={1} gutter={gutter} buffers={buffers} />
  );
  return readScreen(root);
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

  it('places a buffer at its `at` offset', () => {
    const cells = seen({ width: 3, height: 3, buffers: [
      { fg: 'black', buffer: ['X'], at: [2, 1] },
    ]});
    expect(glyphs(cells)).toEqual(['...', '...', '.X.']);
  });

  it('still honors buffers padded into position the old way', () => {
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

// buffers.composite is the pure model tests use instead of rendering.  It has
// to agree with the real renderer, cell for cell, or those tests mean nothing.
describe('composite agrees with the renderer', () => {
  const cases = {
    'plain layers': [
      { fg: 'gray', buffer: ['abcd', 'efgh', 'ijkl'] },
      { fg: 'black', buffer: [['', 'X', null, 'Y']] },
    ],
    'offsets and backgrounds': [
      { fg: 'gray', buffer: ['abcd', 'efgh', 'ijkl'] },
      { fg: 'black', bg: 'white', buffer: ['Z ', ' Q'], at: [1, 1] },
      { fg: 'red', buffer: ['!'], at: [2, 3] },
    ],
    'spaces with and without backgrounds': [
      { fg: 'gray', buffer: ['abcd', 'efgh'] },
      { fg: 'black', buffer: ['    '] },
      { fg: 'black', bg: 'blue', buffer: ['', '  '], at: [0, 2] },
    ],
    'the ˣ sentinel': [
      { fg: 'gray', buffer: ['ab'] },
      { fg: 'black', bg: 'white', buffer: [['ˣ']] },
    ],
  };

  it.each(Object.entries(cases))('%s', (_, buffers) => {
    const [width, height] = [4, 3];
    expect(composite(buffers, width, height)).toEqual(seen({ width, height, buffers }));
  });
});
