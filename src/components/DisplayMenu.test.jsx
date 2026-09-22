// @vitest-environment jsdom
//
// Renders the real menu screen, drives it with keys, and reads back what it
// shows, the way a player would see it.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import DisplayMenu from './DisplayMenu';
import { parseStats } from '../stats';
import { readScreen, screenLines } from '../testing/screen';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const STATS = parseStats(['H  hearing  fd4', 'R  anger  f44']);
const AMBIENT = [{ title: 'TERRA MONTANS', items: [
  { name: 'Wait', event: 'Wait' }, { name: 'Shout', event: 'Ambient' }, { name: 'Hide', event: 'Ambient' },
]}];
const JACYNTHE = {
  type: 'npc', name: 'Jacynthe', label: 'Shopkeeper', sprite: 'O', coordinates: [21, 42],
  attributes: { H2: undefined },
  Look: { name: 'Look', text: 'A tavern owner.' },
  Shout: { name: 'Shout', text: '"R+1:HEY! Will ye keep it down?"', hidden: true },
};
const BARD = {
  type: 'npc', name: 'Bard', label: 'Bard', sprite: 'β', coordinates: [21, 38],
  Look: { name: 'Look', text: 'A bard.' }, Save: { name: 'Save', text: 'Forever.' },
};

let root, container, events;
// Async so the menu's icons, loaded in the background, settle inside act().
const render = (target) => act(async () => root.render(
  <DisplayMenu target={target} inventory={{}} gold={30} ambientMenu={AMBIENT} stats={STATS}
    width={16} height={8} magnification={1} />
));
const press = async (...keys) => {
  for (const key of keys) {
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key })); });
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keyup', { key })); });
  }
};
const lines = () => screenLines(readScreen(container)).map((line) => line.trimEnd());
const onStats = ({ detail }) => events.push(detail);

beforeEach(() => {
  events = [];
  window.addEventListener('Stats.change', onStats);
  container = document.createElement('div');
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  window.removeEventListener('Stats.change', onStats);
});

// What App hands the menu when an ambient event starts a reaction.
const reacting = (npc, name) => ({ ...npc, [name]: { ...npc[name], start: true } });

describe('DisplayMenu', () => {
  it('shows the ambient menu with nothing targeted', async () => {
    await render(null);
    expect(lines().slice(0, 4)).toEqual(['TERRA MONTANS', '1:Wait', '2:Shout', '3:Hide']);
  });

  it('shows a Shout reaction from its first line, with the marked phrase highlighted', async () => {
    await render(null);
    await press('2');                               // select Shout in the ambient menu
    await render(reacting(JACYNTHE, 'Shout'));      // she reacts
    expect(lines().slice(0, 4)).toEqual(['→O Shopkeeper', 'Shout', '"HEY! Will ye', 'keep it down?"']);
    const row = readScreen(container)[2];
    expect(row.map((cell) => Boolean(cell.bg))).toEqual([
      false, true, true, true, true, ...Array(11).fill(false),
    ]);
  });

  it('reports the stat change the text makes, with her map-line stats', async () => {
    await render(reacting(JACYNTHE, 'Shout'));
    expect(events).toEqual([{
      character: 'Jacynthe',
      base: { H: 2 },
      changes: [{ code: 'R', op: 'add', value: 1, phrase: 'HEY!' }],
    }]);
  });

  it('opens a newly bumped menu at its first option', async () => {
    await render(null);
    await press('2');                               // Shout selected in the ambient menu
    await render(BARD);
    const cells = readScreen(container);
    expect(lines()[1]).toBe('1:Look');
    expect(cells[1][0].bg).toBe('black');     // the selection bar is on Look
    expect(cells[2][0].bg).not.toBe('black');
  });

  it('draws plain text exactly as before', async () => {
    await render(BARD);
    await press('Enter');
    expect(lines().slice(0, 3)).toEqual(['→β Bard', '1:Look', 'A bard.']);
  });
});
