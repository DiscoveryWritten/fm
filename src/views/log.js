import { bufferize, bufferizeList, minifyNumbers } from '../utils';

// Rows of an entry's text visible below the "Entry N:" header, or null when
// no entry is open.  Fewer rows than the space means the end is showing.
export function logTextRows({ text, width, height, textOffset }) {
  if (!text) return null;
  return bufferize(0, text, width, height - 1, textOffset);
}

// The log as a standalone view, drawn in its own width × height.
//
// - List mode: newest entry first, numbered.  `scrollOffset` scrolls the
//   list; when it isn't null, the entry on the second row is highlighted.
// - Reading mode (`text` set): an "Entry N:" header over the entry's text,
//   scrolled by `textOffset`.
export default function drawLog({ log, width, height, scrollOffset=null, text=null, textOffset=0 }) {
  const rows = logTextRows({ text, width, height, textOffset });
  if (rows) {
    return [
      { bg: '#888', fg: 'black', buffer: [
        `Entry ${log.length - (scrollOffset || 0)}:`.padEnd(width, ' '),
      ]},
      { bg: '#c7c7c7', fg: '#c7c7c7', at: [1, 0], buffer: (
        Array.from({ length: height - 1 }, () => ' '.repeat(width))
      )},
      { fg: 'black', at: [1, 0], buffer: rows },
    ];
  }

  const list = log.map((msg, i) => `${minifyNumbers(log.length - i)} ${msg}`.padEnd(width, ' '));
  const listRows = bufferizeList(0, [''].concat(list, ['']), width, height, scrollOffset || 0);
  return [
    { fg: '#555', buffer: listRows },
    scrollOffset !== null && { bg: '#555', fg: 'black', buffer: (
      listRows.map((line, i) => i === 1 ? line : '')
    )},
  ].filter(Boolean);
}
