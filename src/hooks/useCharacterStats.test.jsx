// @vitest-environment jsdom
//
// Drives useCharacterStats the way the game does: 'Stats.change' events on
// window (sent by the menu when it shows marked-up text), and a Save.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import useCharacterStats from './useCharacterStats';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root, values;

function Characters() {
  values = useCharacterStats();
  return null;
}

const send = (detail) => act(() => {
  window.dispatchEvent(new CustomEvent('Stats.change', { detail }));
});
const shout = { code: 'R', op: 'add', value: 1, phrase: 'HEY!' };

beforeEach(() => {
  localStorage.clear();
  root = createRoot(document.createElement('div'));
  act(() => root.render(<Characters />));
});
afterEach(() => act(() => root.unmount()));

describe('useCharacterStats', () => {
  it('applies a change the first time its line is shown, and not again', () => {
    send({ character: 'Jacynthe', changes: [shout] });
    send({ character: 'Jacynthe', changes: [shout] });
    expect(values).toEqual({ Jacynthe: { R: 1 } });
  });

  it("starts from the character's map-line tokens", () => {
    send({ character: 'Jacynthe', base: { H: 2, R: 3 }, changes: [shout] });
    expect(values).toEqual({ Jacynthe: { H: 2, R: 4 } });
  });

  it('keeps each character separate, and lets new lines keep changing them', () => {
    send({ character: 'Jacynthe', changes: [shout] });
    send({ character: 'Bard', changes: [shout] });
    send({ character: 'Jacynthe', changes: [{ code: 'R', op: 'set', value: 0, phrase: 'calm' }] });
    expect(values).toEqual({ Jacynthe: { R: 0 }, Bard: { R: 1 } });
  });

  it('is saved with the game', () => {
    send({ character: 'Jacynthe', changes: [shout] });
    act(() => { window.dispatchEvent(new CustomEvent('Save', { detail: {} })); });
    const saved = JSON.parse(localStorage.getItem('Hero/characterStats'));
    expect(saved.values).toEqual({ Jacynthe: { R: 1 } });
    expect(saved.seen).toHaveLength(1);
  });
});
