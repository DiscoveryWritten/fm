import { wrapWords } from '../utils';
import { parseMarkup } from '../stats';

// Lay out marked-up text in `width`, scrolled by `scroll` lines, below
// `topMargin` blank rows (the menu's titles).  Wrapping is bufferize's, so
// text without markers lays out exactly as it always has.
//   rows:       the visible lines of plain text
//   highlights: { [code]: rows } with ' ' in every cell a phrase covers
//   lineCount:  total lines, for knowing when the end is showing
export function layoutText({ markup, stats=[], width, height, topMargin=0, scroll=0 }) {
  const lines = [];      // strings
  const covered = [];    // per line: { [col]: code }
  parseMarkup(markup, stats).paragraphs.forEach(({ text, spans }, p) => {
    if (p > 0) {
      lines.push('');
      covered.push({});
    }
    const codeAt = (index) => spans.find(({ start, end }) => index >= start && index < end)?.code;
    wrapWords(text, width).forEach((line) => {
      const cells = {};
      let col = 0;
      line.forEach(({ word, start }, i) => {
        for (let k = 0; k < word.length; k++) {
          const code = codeAt(start + k);
          if (code) cells[col + k] = code;
        }
        // The space after a word, when the phrase carries on past it.
        const space = start + word.length;
        if (i < line.length - 1 && codeAt(space) && codeAt(space) === codeAt(space + 1)) {
          cells[col + word.length] = codeAt(space);
        }
        col += word.length + 1;
      });
      lines.push(line.map(({ word }) => word).join(' '));
      covered.push(cells);
    });
  });

  const visible = (rows) => {
    const shown = rows.slice(scroll, scroll + height - topMargin);
    return [...Array(topMargin).fill(''), ...shown];
  };
  const codes = [...new Set(covered.flatMap((cells) => Object.values(cells)))];
  return {
    rows: visible(lines),
    highlights: Object.fromEntries(codes.map((code) => [code, visible(covered.map((cells) => (
      Array.from({ length: width }, (_, col) => cells[col] === code ? ' ' : '')
    )))])),
    lineCount: lines.length,
  };
}

// Buffers for laid-out text: each stat's highlight under the text itself.
export default function drawText(layout, stats=[], fg='black') {
  const colorOf = (code) => stats.find((stat) => stat.code === code)?.color;
  return [
    ...Object.entries(layout.highlights).map(([code, buffer]) => ({
      bg: colorOf(code), fg: colorOf(code), buffer,
    })),
    { fg, buffer: layout.rows },
  ];
}
