// @vitest-environment jsdom
//
// Drives the Log tab's hook the way the game does: with key events on window.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import useSubDisplayLog from './useSubDisplayLog';
import { screenText } from '../buffers';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const LOG = [
  'Slept well, and healed to 200.',
  "You've never been this tired before.",
  'You wake up in a small room, the walls are made of stone and the floor is dirt.',
];
const KEYMAP = { up: 'w', down: 's', left: 'a', right: 'd', select: ' ', cancel: 'Escape' };
const [WIDTH, HEIGHT] = [16, 8];

let root, container, buffers;

function LogTab({ enabled }) {
  buffers = useSubDisplayLog(enabled, { log: LOG, width: WIDTH, height: HEIGHT, keyMap: KEYMAP });
  return null;
}

const render = (enabled) => act(() => root.render(<LogTab enabled={enabled} />));
const press = (...keys) => keys.forEach((key) => act(() => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));
}));
const shown = () => screenText(buffers || [], WIDTH, HEIGHT).slice(4);  // below the stats header

beforeEach(() => {
  localStorage.clear();
  container = document.createElement('div');
  root = createRoot(container);
});
afterEach(() => act(() => root.unmount()));

describe('useSubDisplayLog', () => {
  it('scrolls to an entry, opens it, and scrolls its text', () => {
    render(true);
    press('s', 's', 's', ' ');
    expect(shown()).toEqual([
      'Entry 1:        ',
      'You wake up in a',
      'small room, the ',
      'walls are made  ',
    ]);
    press('s', 's', 's', 's');  // one past the end: stays put
    expect(shown()[3]).toBe('                ');
    expect(shown()[2]).toBe('floor is dirt.  ');
    press('Escape');           // back to the list, still scrolled to that entry
    expect(shown()).toEqual([
      "₂ You've never b",
      '₁ You wake up in',
      '                ',
      '                ',
    ]);
  });

  it('ignores reading keys while another stats tab is showing', () => {
    render(true);
    press('s', 's', 's', ' ');
    render(false);             // switch to Equip or Rings
    press('s', 's', 'Escape');
    render(true);              // back to Log: still reading, still at the top
    expect(shown()).toEqual([
      'Entry 1:        ',
      'You wake up in a',
      'small room, the ',
      'walls are made  ',
    ]);
  });
});
