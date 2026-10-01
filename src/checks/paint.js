import { paintCell, palette } from '../paint';
import { parseWorld } from '../world';
import { parseGame } from '../game';

const WORLD = '###\n#.#\n###\n---\n#:wall\n(2,2):Bard/bard.txt\n';

export default function register({ describe, it, expect }, content) {
  describe('paintCell', () => {
    const map = (text) => parseWorld(text).map.map((row) => row.join(''));

    it('changes one cell and nothing else in the file', () => {
      const painted = paintCell(WORLD, 1, 2, '~');
      expect(map(painted)).toEqual(['#~#', '#.#', '###']);
      expect(painted.split('---\n')[1]).toBe(WORLD.split('---\n')[1]);
    });

    it('grows the map when painting past its edge', () => {
      expect(map(paintCell(WORLD, 2, 5, '#'))).toEqual(['###', '#.# #', '###']);
      expect(map(paintCell(WORLD, 4, 1, '#'))).toEqual(['###', '#.#', '###', '#']);
    });

    it('keeps open ground at the start of the first row', () => {
      expect(map(paintCell(WORLD, 1, 1, ' '))).toEqual([' ##', '#.#', '###']);
    });

    it('paints a map without objects, and one with blank lines around it', () => {
      expect(paintCell('ab\ncd', 2, 1, 'x')).toBe('ab\nxd');
      expect(paintCell('\n\nab\ncd\n\n---\n', 1, 2, 'x')).toBe('\n\nax\ncd\n\n---\n');
    });

    it('holds one character per cell', () => {
      expect(() => paintCell(WORLD, 1, 1, '##')).toThrow();
    });
  });

  describe('palette', () => {
    it('offers ground, the declared sprites, then the rest of the art', () => {
      const world = parseWorld('#~.\n---\n#:wall\n');
      expect(palette(world)).toEqual([
        { glyph: ' ', label: 'ground' },
        { glyph: '#', label: 'wall' },
        { glyph: '.', label: 'art' },
        { glyph: '~', label: 'art' },
      ]);
    });
  });

  const game = parseGame(content.text['game.txt']);
  const path = `world/${game.world}`;

  describe(`painting ${path}`, () => {
    it('leaves the file as it was when a cell is painted with what it holds', () => {
      const text = content.text[path];
      const { map } = parseWorld(text);
      const [row, col] = game.start;
      expect(paintCell(text, row, col, map[row - 1][col - 1])).toBe(text);
    });
  });
}
