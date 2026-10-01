// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Blob } from 'node:buffer';  // jsdom's Blob has no .text(); browsers' do

import { createEdits, memoryBackend } from './edits';
import { addSource, readText } from './content';

describe('local edits', () => {
  let edits, removes, changes;
  const onChange = ({ detail }) => changes.push(detail.path);

  beforeEach(() => {
    changes = [];
    window.addEventListener('Content.changed', onChange);
    edits = createEdits(memoryBackend());
    // The deployed game, standing in for the network.
    removes = [
      addSource({ name: 'deployed', read: async (path) => path === 'world/A.txt' ? 'deployed A' : null }),
      addSource(edits.source),
    ];
  });
  afterEach(() => {
    removes.forEach((remove) => remove());
    window.removeEventListener('Content.changed', onChange);
  });

  it('masks the deployed file until reverted', async () => {
    expect(await readText('world/A.txt')).toBe('deployed A');
    await edits.save('world/A.txt', 'edited A');
    expect(await readText('world/A.txt')).toBe('edited A');
    expect(edits.paths()).toEqual(['world/A.txt']);
    await edits.revert('world/A.txt');
    expect(await readText('world/A.txt')).toBe('deployed A');
    expect(edits.paths()).toEqual([]);
  });

  it('announces each change, so whatever shows the file can reload it', async () => {
    await edits.save('world/A.txt', 'x');
    await edits.revert('world/A.txt');
    await edits.revert('world/A.txt');  // nothing to revert: no event
    expect(changes).toEqual(['world/A.txt', 'world/A.txt']);
  });

  it('holds new files and Blobs, read back as text', async () => {
    await edits.save('overlays/new.txt', new Blob(['~~~']));
    expect(await readText('overlays/new.txt')).toBe('~~~');
  });

  it('keeps edits for next time', async () => {
    const backend = memoryBackend();
    await createEdits(backend).save('game.txt', 'kept');
    const next = createEdits(backend);
    expect(next.paths()).toEqual([]);
    await next.load();
    expect(next.paths()).toEqual(['game.txt']);
    expect(await next.source.read('game.txt')).toBe('kept');
  });
});
