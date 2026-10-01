// A titled, numbered list in its own width × height, scrolled so the
// selected row shows: the menu look, as a pure view.
//
//   TITLE              (inverted)
//   1:First
//   2:Second           (selected: inverted)
//
// Items are labels.  A label longer than the width is cut short.
export function listRows({ items, selected=0, height }) {
  const room = Math.max(1, height - 1);
  const scroll = Math.min(Math.max(0, selected - room + 1), Math.max(0, items.length - room));
  return { scroll, visible: items.slice(scroll, scroll + room) };
}

export default function drawList({ title, items, selected=0, width, height }) {
  const fit = (line) => line.slice(0, width).padEnd(width, ' ');
  const { scroll, visible } = listRows({ items, selected, height });
  const rows = visible.map((label, i) => fit(`${scroll + i + 1}:${label}`));
  const at = selected - scroll;
  return [
    { bg: 'black', fg: '#c7c7c7', buffer: [fit(title)] },
    { fg: 'black', at: [1, 0], buffer: rows },
    items.length > 0 && { bg: 'black', fg: '#c7c7c7', at: [1 + at, 0], buffer: [rows[at]] },
  ].filter(Boolean);
}
