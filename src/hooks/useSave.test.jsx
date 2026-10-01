// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import useSave from './useSave';
import { setDevMode } from '../dev';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Probe({ x }) {
  useSave({ x: [x, () => {}] });
  return null;
}

let root;
beforeEach(() => {
  localStorage.clear();
  root = createRoot(document.createElement('div'));
});
afterEach(() => {
  act(() => root.unmount());
  setDevMode(false);
});

const save = () => act(() => { window.dispatchEvent(new CustomEvent('Save', { detail: { slot: 'Hero' } })); });

describe('useSave', () => {
  it('saves on a Save event', () => {
    act(() => root.render(<Probe x={3} />));
    save();
    expect(localStorage.getItem('Hero/x')).toBe('3');
  });

  it("doesn't save in dev mode, so experiments can't overwrite the game", () => {
    act(() => root.render(<Probe x={3} />));
    save();
    setDevMode(true);
    act(() => root.render(<Probe x={99} />));
    save();
    expect(localStorage.getItem('Hero/x')).toBe('3');
    setDevMode(false);
    save();
    expect(localStorage.getItem('Hero/x')).toBe('99');
  });

  it('keeps dev mode outside every save slot', () => {
    setDevMode(true);
    expect(Object.keys(localStorage)).toEqual(['meta:dev']);
  });
});
