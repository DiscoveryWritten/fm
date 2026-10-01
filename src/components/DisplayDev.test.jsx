// @vitest-environment jsdom
//
// The DEV screen, driven by its keys and by taps on the map, read back off
// the screen.  Everything it does comes out as events.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import DisplayDev from './DisplayDev';
import { createEdits, memoryBackend } from '../edits';
import { setDevMode } from '../dev';
import { readScreen, screenLines } from '../testing/screen';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const KEYS = { up: 'u', down: 'n', pageUp: 'y', pageDown: 'b', use: 'o', cancel: 'x' };
const FILES = ['game.txt', 'interactions/Bard/bard.txt', 'world/Terra Montans.txt'];
const START = { world: 'Terra Montans.txt', row: 20, col: 22 };

let root, container, edits, events;
const record = (name) => ({ detail }) => events.push([name, detail]);
const listeners = Object.fromEntries(['Dev.open', 'Dev.mode.set', 'destination', 'load'].map((n) => [n, record(n)]));

const render = (props={}) => act(() => root.render(
  <DisplayDev start={START} edits={edits} files={FILES} width={16} height={8} keyMap={KEYS} {...props} />
));
const press = (...keys) => keys.forEach((key) => act(() => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));
}));
const lines = () => screenLines(readScreen(container)).map((line) => line.trimEnd()).filter(Boolean);
const selected = () => readScreen(container).findIndex((row, y) => y > 0 && row[0].bg === 'black');
const tapMap = (detail) => act(() => window.dispatchEvent(new CustomEvent('World.touch', { detail })));

beforeEach(() => {
  events = [];
  Object.entries(listeners).forEach(([name, fn]) => window.addEventListener(name, fn));
  edits = createEdits(memoryBackend());
  container = document.createElement('div');
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  Object.entries(listeners).forEach(([name, fn]) => window.removeEventListener(name, fn));
  setDevMode(false);
});

describe('DisplayDev', () => {
  it('shows its menu', () => {
    render();
    expect(lines()).toEqual([
      'DEV', '1:Dev mode:off', '2:Here:tap map', '3:Files', '4:Edited:0',
      '5:Import files', '6:Last save', '7:Go to start',
    ]);
    expect(selected()).toBe(1);
  });

  it('asks to switch dev mode, and shows it once it is on', () => {
    render();
    press('o');
    expect(events).toEqual([['Dev.mode.set', { on: true }]]);
    act(() => setDevMode(true));
    expect(lines()[1]).toBe('1:Dev mode:ON');
  });

  it('browses folders and asks to open a file', () => {
    render();
    press('n', 'n', 'o');                         // Files
    expect(lines()).toEqual(['FILES', '1:interactions/', '2:world/', '3:game']);
    press('o', 'o');                              // interactions/ → Bard/
    expect(lines()).toEqual(['Bard/', '1:bard']);
    press('o');
    expect(events).toEqual([['Dev.open', { path: 'interactions/Bard/bard.txt' }]]);
    press('x', 'x', 'x');
    expect(lines()[0]).toBe('DEV');
  });

  it('marks and lists what has been edited', async () => {
    render();
    await act(() => edits.save('world/Terra Montans.txt', 'edited'));
    expect(lines()[4]).toBe('4:Edited:1');
    press('n', 'n', 'n', 'o');
    expect(lines()).toEqual(['EDITED', '1:*world/Terra M']);
  });

  it('in dev mode, brings up what is at a tapped spot', () => {
    act(() => setDevMode(true));
    render();
    tapMap({ world: 'Terra Montans.txt', row: 21, col: 38, glyph: 'β', files: [
      { path: 'world/Terra Montans.txt', label: 'Terra Montans.txt' },
      { path: 'interactions/Bard/bard.txt', label: 'bard.txt' },
    ]});
    expect(lines()).toEqual(['β 21,38', '1:Terra Montans', '2:bard', '3:Jump here']);
    press('n', 'o');
    press('n', 'o');
    expect(events).toEqual([
      ['Dev.open', { path: 'interactions/Bard/bard.txt' }],
      ['destination', { destination: [21, 38], dataFile: 'Terra Montans.txt' }],
    ]);
    press('x');
    expect(lines()[2]).toBe('2:Here 21,38');
  });

  it('only notes a tap while dev mode is off', () => {
    render();
    tapMap({ world: 'Terra Montans.txt', row: 3, col: 4, glyph: '█', files: [] });
    expect(lines()[0]).toBe('DEV');
    expect(lines()[2]).toBe('2:Here 3,4');
  });

  it('opens the file picker right inside the key press that asked for it', () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    render();
    press('n', 'n', 'n', 'n', 'o');
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it('ignores its keys while it is not showing', () => {
    render({ active: false });
    press('n', 'o');
    expect(selected()).toBe(1);
    expect(events).toEqual([]);
  });
});
