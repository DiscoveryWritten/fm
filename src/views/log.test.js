import { describe, it, expect } from 'vitest';

import drawLog, { logTextRows } from './log';
import { screenText, composite } from '../buffers';

const LOG = [
  'Slept well, and healed to 200.',
  "You've never been this tired before.",
  'You wake up in a small room, the walls are made of stone and the floor is dirt.',
];
const show = (options, width, height) => screenText(drawLog({ log: LOG, width, height, ...options }), width, height);

describe('drawLog list mode', () => {
  it('lists newest first, numbered, clipped to the width', () => {
    expect(show({}, 16, 4)).toEqual([
      '                ',
      '₃ Slept well, an',
      "₂ You've never b",
      '₁ You wake up in',
    ]);
  });

  it('highlights the entry on the second row once scrolling starts', () => {
    const buffers = drawLog({ log: LOG, width: 16, height: 4, scrollOffset: 1 });
    const cells = composite(buffers, 16, 4);
    expect(screenText(buffers, 16, 4)[1]).toBe("₂ You've never b");
    expect(cells[1].every((cell) => cell.bg === '#555')).toBe(true);
    expect(cells[2].every((cell) => cell.bg === null)).toBe(true);
  });

  it('draws at any size: narrow and short', () => {
    expect(show({ scrollOffset: 0 }, 8, 2)).toEqual([
      '        ',
      '₃ Slept ',
    ]);
  });

  it('draws at any size: wide and tall', () => {
    expect(show({}, 40, 5)).toEqual([
      '                                        ',
      '₃ Slept well, and healed to 200.        ',
      "₂ You've never been this tired before.  ",
      '₁ You wake up in a small room, the walls',
      '                                        ',
    ]);
  });
});

describe('drawLog reading mode', () => {
  const reading = { scrollOffset: 2, text: LOG[2] };

  it('shows an entry header over its wrapped text', () => {
    expect(show(reading, 16, 4)).toEqual([
      'Entry 1:        ',
      'You wake up in a',
      'small room, the ',
      'walls are made  ',
    ]);
  });

  it('scrolls the text under a fixed header', () => {
    expect(show({ ...reading, textOffset: 3 }, 16, 4)).toEqual([
      'Entry 1:        ',
      'of stone and the',
      'floor is dirt.  ',
      '                ',
    ]);
  });

  it('rewraps for the size it is drawn at', () => {
    expect(show(reading, 30, 3)).toEqual([
      'Entry 1:                      ',
      'You wake up in a small room,  ',
      'the walls are made of stone   ',
    ]);
  });
});

describe('logTextRows', () => {
  it('reports when the end of the text is showing', () => {
    const rows = (textOffset) => logTextRows({ text: LOG[2], width: 16, height: 4, textOffset });
    expect(rows(0)).toHaveLength(3);   // more below
    expect(rows(3)).toHaveLength(2);   // end reached: fewer rows than the space
    expect(logTextRows({ text: null, width: 16, height: 4, textOffset: 0 })).toBeNull();
  });
});
