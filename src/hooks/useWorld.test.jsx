// @vitest-environment jsdom
//
// Live editing: saving an edit to the world file reloads the world in place,
// the way the game does it, with no restart.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import useWorld from './useWorld';
import { addSource } from '../content';
import { createEdits, memoryBackend } from '../edits';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const DEPLOYED = { 'world/A.txt': '###\n#.#\n###\n---\n#:wall', 'world/B.txt': '...\n---' };

let root, result, edits, removes;
function Probe({ world }) {
  result = useWorld({ world });
  return null;
}
const rows = () => result.map.map((row) => row.join(''));
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

beforeEach(() => {
  edits = createEdits(memoryBackend());
  removes = [
    addSource({ name: 'deployed', read: async (path) => DEPLOYED[path] ?? null }),
    addSource(edits.source),
  ];
  root = createRoot(document.createElement('div'));
});
afterEach(() => {
  act(() => root.unmount());
  removes.forEach((remove) => remove());
});

describe('useWorld', () => {
  it('reloads the world in place when its file is edited', async () => {
    act(() => root.render(<Probe world="A.txt" />));
    await settle();
    expect(rows()).toEqual(['###', '#.#', '###']);

    await act(() => edits.save('world/A.txt', '#####\n#.¥.#\n#####\n---\n#:wall'));
    await settle();
    expect(rows()).toEqual(['#####', '#.¥.#', '#####']);

    await act(() => edits.revert('world/A.txt'));
    await settle();
    expect(rows()).toEqual(['###', '#.#', '###']);
  });

  it("doesn't reload for another world's edit", async () => {
    act(() => root.render(<Probe world="A.txt" />));
    await settle();
    const before = result.map;
    await act(() => edits.save('world/B.txt', 'xxx\n---'));
    await settle();
    expect(result.map).toBe(before);
  });
});
