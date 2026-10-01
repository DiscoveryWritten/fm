import { describe, it, expect } from 'vitest';

import devMenu, { folderEntries, importPath } from './devMenus';

const FILES = [
  'game.txt',
  'interactions/Bard/bard.txt',
  'interactions/Shopkeeper/jacynthe.txt',
  'world/Terra Montans.txt',
  'world/debug.txt',
];
const START = { world: 'Terra Montans.txt', row: 20, col: 22 };
const state = (more={}) => ({ devMode: false, files: FILES, edited: [], touched: null, start: START, ...more });
const names = (menu) => menu.items.map(({ name }) => name);

describe('DEV menus', () => {
  it('lists folders, then files, one level at a time', () => {
    expect(folderEntries(FILES, '')).toEqual({ folders: ['interactions/', 'world/'], files: ['game.txt'] });
    expect(folderEntries(FILES, 'interactions/')).toEqual({ folders: ['Bard/', 'Shopkeeper/'], files: [] });
    expect(names(devMenu({ id: 'folder', prefix: 'world/' }, state({ edited: ['world/debug.txt'] }))))
      .toEqual(['Terra Montans', '*debug']);
  });

  it('opens a file by asking for it', () => {
    const [file] = devMenu({ id: 'folder', prefix: 'world/' }, state()).items;
    expect(file).toMatchObject({ event: 'Dev.open', detail: { path: 'world/Terra Montans.txt' } });
  });

  it('flips dev mode, and goes places with the events the game already uses', () => {
    const root = devMenu({ id: 'root' }, state({ devMode: true }));
    expect(root.items[0]).toMatchObject({ name: 'Dev mode:ON', event: 'Dev.mode.set', detail: { on: false } });
    expect(root.items.find(({ name }) => name === 'Go to start')).toMatchObject({
      event: 'destination', detail: { destination: [20, 22], dataFile: 'Terra Montans.txt' },
    });
    expect(root.items.find(({ name }) => name === 'Last save')).toMatchObject({ event: 'load' });
  });

  it('offers the files behind a tapped spot, and a jump to it', () => {
    const touched = {
      world: 'Terra Montans.txt', row: 21, col: 42, glyph: 'O',
      files: [
        { path: 'world/Terra Montans.txt', label: 'Terra Montans.txt' },
        { path: 'interactions/Shopkeeper/jacynthe.txt', label: 'jacynthe.txt' },
      ],
    };
    expect(names(devMenu({ id: 'root' }, state({ touched })))[1]).toBe('Here 21,42');
    const here = devMenu({ id: 'here' }, state({ touched }));
    expect(here.title).toBe('O 21,42');
    expect(names(here)).toEqual(['Terra Montans', 'jacynthe', 'Jump here']);
    expect(here.items[2]).toMatchObject({
      event: 'destination', detail: { destination: [21, 42], dataFile: 'Terra Montans.txt' },
    });
  });

  it('puts an imported file where it belongs', () => {
    const file = (name, webkitRelativePath='') => ({ name, webkitRelativePath });
    expect(importPath(file('bard.txt'), FILES)).toBe('interactions/Bard/bard.txt');
    expect(importPath(file('bard.txt', 'fm/interactions/Bard/bard.txt'), FILES)).toBe('interactions/Bard/bard.txt');
    expect(importPath(file('new.txt', 'fm/overlays/new.txt'), FILES)).toBe('overlays/new.txt');
    expect(importPath(file('model.onnx'), FILES)).toBe('model.onnx');
  });
});
