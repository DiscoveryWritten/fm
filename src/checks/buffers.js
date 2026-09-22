import { cellAt, place, composite, screenText } from '../buffers';

export default function register({ describe, it, expect }) {
  describe('cellAt', () => {
    it('reads rows given as strings or arrays', () => {
      expect(cellAt({ buffer: ['ab', ['c', 'd']] }, 1, 1)).toBe('d');
      expect(cellAt({ buffer: ['ab'] }, 0, 1)).toBe('b');
    });

    it('shifts by `at` and is empty before it', () => {
      const buffer = { buffer: ['XY'], at: [2, 3] };
      expect(cellAt(buffer, 2, 3)).toBe('X');
      expect(cellAt(buffer, 2, 4)).toBe('Y');
      expect(cellAt(buffer, 0, 0)).toBeUndefined();
      expect(cellAt(buffer, 2, 2)).toBeUndefined();
    });
  });

  describe('place', () => {
    it('adds to any existing offset and passes falsy entries through', () => {
      expect(place([{ buffer: [] }, false, { buffer: [], at: [1, 1] }], [4, 0])).toEqual([
        { buffer: [], at: [4, 0] },
        false,
        { buffer: [], at: [5, 1] },
      ]);
    });
  });

  describe('screenText', () => {
    it('stacks buffers, later on top', () => {
      expect(screenText([
        { buffer: ['....', '....'] },
        { buffer: ['ab'], at: [1, 1] },
      ], 4, 2)).toEqual(['....', '.ab.']);
    });

    it('clips at the screen edge', () => {
      expect(screenText([{ buffer: ['abcdef'], at: [0, 2] }], 4, 1)).toEqual(['  ab']);
    });

    it('lets a background-painted space hide what is below', () => {
      expect(screenText([
        { buffer: ['abc'] },
        { bg: 'black', buffer: [' '], at: [0, 1] },
      ], 3, 1)).toEqual(['a c']);
    });
  });

  describe('composite', () => {
    it('applies default colors', () => {
      const [[cell]] = composite([{ buffer: ['a'] }], 1, 1, { fg: 'black', bg: 'white' });
      expect(cell).toEqual({ glyph: 'a', fg: 'black', bg: 'white' });
    });
  });
}
