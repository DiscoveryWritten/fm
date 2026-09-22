import drawText, { layoutText } from '../views/text';
import { bufferize } from '../utils';
import { parseStats } from '../stats';
import { composite, screenText } from '../buffers';

const STATS = parseStats(['H  hearing  fd4', 'R  anger  f44']);

export default function register({ describe, it, expect }) {
  describe('layoutText', () => {
    const plain = 'Jacinthe is a tavern owner.  She is 5\'6" tall and lets travelers rest for 1gp.';

    it('wraps text without markers exactly like bufferize', () => {
      [[16, 8, 0, 0], [16, 8, 2, 1], [9, 3, 1, 0], [30, 4, 0, 2]].forEach(([width, height, topMargin, scroll]) => {
        const { rows } = layoutText({ markup: plain, stats: STATS, width, height, topMargin, scroll });
        expect(rows).toEqual(bufferize(topMargin, plain, width, height, scroll));
      });
    });

    it('wraps the plain text, with the markup gone', () => {
      const { rows } = layoutText({ markup: '"R+1:HEY! Will ye keep it down?"', stats: STATS, width: 16, height: 4 });
      expect(rows).toEqual(['"HEY! Will ye', 'keep it down?"']);
    });

    it('puts a highlight under exactly the phrase', () => {
      const layout = layoutText({ markup: 'She has H:sharp ears. Yes.', stats: STATS, width: 16, height: 4 });
      const text = screenText(drawText(layout, STATS), 16, 4);
      const cells = composite(drawText(layout, STATS), 16, 4);
      expect(text[0]).toBe('She has sharp   ');
      expect(text[1]).toBe('ears. Yes.      ');
      const lit = cells.map((row) => row.map((c) => c.bg === '#fd4' ? '^' : '.').join(''));
      expect(lit.slice(0, 2)).toEqual([
        '........^^^^^...',   // "sharp", not the space after it: the phrase breaks the line here
        '^^^^............',   // "ears", not the period
      ]);
    });

    it('highlights the spaces inside a phrase on one line', () => {
      const layout = layoutText({ markup: 'R:VERY ANGRY now', stats: STATS, width: 20, height: 1 });
      expect(layout.highlights.R[0].map((c) => c === ' ' ? '^' : '.').join('')).toBe('^^^^^^^^^^..........');
    });

    it('gives two stats two colors', () => {
      const layout = layoutText({ markup: 'H:keen, R:CROSS', stats: STATS, width: 16, height: 1 });
      const cells = composite(drawText(layout, STATS), 16, 1);
      expect(cells[0].slice(0, 12).map((c) => c.bg)).toEqual([
        '#fd4', '#fd4', '#fd4', '#fd4', null, null, '#f44', '#f44', '#f44', '#f44', '#f44', null,
      ]);
      expect(cells[0].slice(0, 4).map((c) => c.glyph).join('')).toBe('keen');
    });

    it('scrolls the highlights with the text', () => {
      const markup = 'one two three four R:FIVE six';
      const at = (scroll) => layoutText({ markup, stats: STATS, width: 9, height: 2, scroll });
      expect(at(0).rows).toEqual(['one two', 'three']);
      expect(at(2).rows).toEqual(['four FIVE', 'six']);
      expect(at(2).highlights.R[0].map((c) => c === ' ' ? '^' : '.').join('')).toBe('.....^^^^');
    });

    it('keeps the menu titles above it', () => {
      const layout = layoutText({ markup: 'R:HEY', stats: STATS, width: 8, height: 3, topMargin: 2 });
      expect(layout.rows).toEqual(['', '', 'HEY']);
      expect(layout.highlights.R.slice(0, 2)).toEqual(['', '']);  // nothing highlighted in the title rows
      expect(layout.highlights.R[2].filter((c) => c === ' ')).toHaveLength(3);
    });

    it('separates paragraphs with a blank line', () => {
      const layout = layoutText({ markup: 'one\ntwo\n\nthree', stats: STATS, width: 16, height: 4 });
      expect(layout.rows).toEqual(['one two', '', 'three']);
      expect(layout.lineCount).toBe(3);
    });
  });
}
