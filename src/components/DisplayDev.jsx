import { useState, useCallback, useRef } from 'react';
import manifest from 'virtual:content-manifest';

import ScreenStack from './ScreenStack';
import drawList from '../views/list';
import devMenu, { importPath } from '../devMenus';
import { paintCell } from '../paint';
import { readText } from '../content';
import { edits as gameEdits } from '../edits';
import useEvent from '../hooks/useEvent';
import useEventKeys from '../hooks/useEventKeys';
import useDevMode from '../hooks/useDevMode';
import { keyAlias } from '../utils';

// The creator's screen: browse and open every game file, see what's at a
// tapped spot on the map, paint the map, pause saves while experimenting,
// and jump around.
// It only speaks in events (see devMenus.js), so it changes nothing directly
// but the local edits it imports.
export default function DisplayDev({
  start,  // { world, row, col }
  edits=gameEdits,
  files=manifest,
  width, height, magnification=1,
  keyMap,
  active=true,  // keys only work while the screen is showing
}) {
  const [devMode] = useDevMode();
  const [stack, setStack] = useState([{ frame: { id: 'root' }, selected: 0 }]);
  const [edited, setEdited] = useState(edits.paths);
  const [touched, setTouched] = useState(null);
  const [shown, setShown] = useState({ world: null, palette: [] });  // the world on screen
  const [brush, setBrush] = useState(null);
  const undos = useRef([]);  // [{ path, text }] before each paint, the newest last
  const [undoCount, setUndoCount] = useState(0);
  const inputRef = useRef(null);
  const painting = useRef(Promise.resolve());  // one paint at a time, in tap order

  const allFiles = [...new Set([...files, ...edited])].sort();
  const state = {
    devMode, files: allFiles, edited, touched, start,
    palette: shown.palette, brush, undos: undoCount,
  };
  const { frame, selected } = stack[stack.length - 1];
  const menu = devMenu(frame.id === 'here' && !touched ? { id: 'root' } : frame, state);
  const at = Math.min(selected, Math.max(0, menu.items.length - 1));

  const contentHandler = useCallback(() => setEdited(edits.paths()), [edits]);
  useEvent('Content.changed', contentHandler);

  const shownHandler = useCallback(({ detail }) => setShown(detail), []);
  useEvent('World.shown', shownHandler);

  // Each paint reads the world file as the game would, changes one cell,
  // and saves it as an edit, which the world shows at once.  Paints queue
  // so quick taps each land on the result of the one before.
  const paint = useCallback(({ world, row, col }, glyph) => {
    const path = `world/${world}`;
    painting.current = painting.current.then(async () => {
      const text = await readText(path);
      const next = paintCell(text, row, col, glyph);
      if (next === text) return;
      undos.current.push({ path, text });
      setUndoCount(undos.current.length);
      await edits.save(path, next);
    }).catch((error) => console.error(`Painting ${path}: ${error.message}`));
  }, [edits]);

  // A tap on the map paints with the brush, or, in dev mode, brings up
  // what's there.
  const touchHandler = useCallback(({ detail }) => {
    setTouched(detail);
    if (brush !== null) {
      paint(detail, brush);
    } else if (devMode) {
      setStack([{ frame: { id: 'root' }, selected: 1 }, { frame: { id: 'here' }, selected: 0 }]);
    }
  }, [devMode, brush, paint]);
  useEvent('World.touch', touchHandler);

  const brushHandler = useCallback(({ detail: { glyph } }) => setBrush(glyph), []);
  useEvent('Dev.brush', brushHandler);

  const undoHandler = useCallback(() => {
    painting.current = painting.current.then(async () => {
      const last = undos.current.pop();
      if (!last) return;
      setUndoCount(undos.current.length);
      await edits.save(last.path, last.text);
    }).catch((error) => console.error(`Undo: ${error.message}`));
  }, [edits]);
  useEvent('Dev.undo', undoHandler);

  // The file picker has to open inside the key or tap that asked for it.
  const importHandler = useCallback(() => inputRef.current?.click(), []);
  useEvent('Dev.import', importHandler);

  const select = (move) => setStack((stack) => {
    const top = stack[stack.length - 1];
    const count = menu.items.length;
    if (!count) return stack;
    const next = Math.min(count - 1, Math.max(0, at + move));
    return [...stack.slice(0, -1), { ...top, selected: next }];
  });

  const when = (fn) => () => active && fn();
  useEventKeys({
    up: when(() => select(-1)),
    down: when(() => select(1)),
    pageUp: when(() => select(-(height - 1))),
    pageDown: when(() => select(height - 1)),
    use: when(() => {
      const item = menu.items[at];
      if (!item) return;
      if (item.open) {
        setStack((stack) => [...stack, { frame: item.open, selected: 0 }]);
      } else if (item.event) {
        window.dispatchEvent(new CustomEvent(item.event, { detail: item.detail }));
      }
    }),
    cancel: when(() => setStack((stack) => stack.length > 1 ? stack.slice(0, -1) : stack)),
  }, keyMap);

  const onImport = async (e) => {
    const picked = [...e.target.files];
    e.target.value = '';
    for (const file of picked) {
      await edits.save(importPath(file, allFiles), file);
    }
  };

  return (
    <>
      <ScreenStack
        screen="dev"
        gutter="#c7c7c7"
        width={width}
        height={height}
        magnification={magnification}
        hints={[
          `(${keyAlias(keyMap.up)}/${keyAlias(keyMap.down)}) to select, `,
          `(${keyAlias(keyMap.use)}) to use, (${keyAlias(keyMap.cancel)}) to go back`,
        ].join('')}
        buffers={drawList({
          title: menu.title,
          items: menu.items.map(({ name }) => name),
          selected: at,
          width, height,
        })}
      />
      <input ref={inputRef} type="file" multiple hidden onChange={onImport} />
    </>
  );
}
