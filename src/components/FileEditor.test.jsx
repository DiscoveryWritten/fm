// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import FileEditor from './FileEditor';
import { addSource } from '../content';
import { createEdits, memoryBackend } from '../edits';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root, container, edits, removes, closed, changes;
const onChange = ({ detail }) => changes.push(detail.path);
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));
const textarea = () => container.querySelector('textarea');
const button = (label) => [...container.querySelectorAll('button')].find((b) => b.textContent === label);
const click = (label) => act(async () => { button(label).click(); });
const type = (value) => act(() => {
  // React tracks the value itself; set it the way a browser would.
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
  setter.call(textarea(), value);
  textarea().dispatchEvent(new Event('input', { bubbles: true }));
});

beforeEach(async () => {
  closed = 0;
  changes = [];
  window.addEventListener('Content.changed', onChange);
  edits = createEdits(memoryBackend());
  removes = [
    addSource({ name: 'deployed', read: async (path) => path === 'game.txt' ? 'Title\nFM' : null }),
    addSource(edits.source),
  ];
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<FileEditor path="game.txt" edits={edits} onClose={() => closed++} />));
  await settle();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  removes.forEach((remove) => remove());
  window.removeEventListener('Content.changed', onChange);
});

describe('FileEditor', () => {
  it('opens the file as the game reads it', () => {
    expect(textarea().value).toBe('Title\nFM');
    expect(button('Save').disabled).toBe(true);
    expect(button('Revert').disabled).toBe(true);
  });

  it('saves an edit, which the game hears about', async () => {
    type('Title\nFM 2');
    expect(button('Save').disabled).toBe(false);
    await click('Save');
    expect(await edits.source.read('game.txt')).toBe('Title\nFM 2');
    expect(changes).toEqual(['game.txt']);
    expect(container.textContent).toContain('*game.txt');
  });

  it('reverts to the deployed file', async () => {
    type('changed');
    await click('Save');
    await click('Revert');
    await settle();
    expect(textarea().value).toBe('Title\nFM');
    expect(edits.has('game.txt')).toBe(false);
  });

  it("keeps typing from reaching the game's keys", () => {
    const seen = [];
    const onKey = ({ key }) => seen.push(key);
    window.addEventListener('keydown', onKey);
    act(() => textarea().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })));
    window.removeEventListener('keydown', onKey);
    expect(seen).toEqual([]);
  });

  it('closes', async () => {
    await click('Close');
    expect(closed).toBe(1);
  });
});
