import { useState, useCallback, useRef } from 'react';
import manifest from 'virtual:content-manifest';

import ScreenStack from './ScreenStack';
import drawList from '../views/list';
import devMenu, { importPath } from '../devMenus';
import { edits as gameEdits } from '../edits';
import useEvent from '../hooks/useEvent';
import useEventKeys from '../hooks/useEventKeys';
import useDevMode from '../hooks/useDevMode';
import { keyAlias } from '../utils';

// The creator's screen: browse and open every game file, see what's at a
// tapped spot on the map, pause saves while experimenting, and jump around.
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
  const inputRef = useRef(null);

  const allFiles = [...new Set([...files, ...edited])].sort();
  const state = { devMode, files: allFiles, edited, touched, start };
  const { frame, selected } = stack[stack.length - 1];
  const menu = devMenu(frame.id === 'here' && !touched ? { id: 'root' } : frame, state);
  const at = Math.min(selected, Math.max(0, menu.items.length - 1));

  const contentHandler = useCallback(() => setEdited(edits.paths()), [edits]);
  useEvent('Content.changed', contentHandler);

  // In dev mode a tap on the map brings up what's there.
  const touchHandler = useCallback(({ detail }) => {
    setTouched(detail);
    if (devMode) {
      setStack([{ frame: { id: 'root' }, selected: 1 }, { frame: { id: 'here' }, selected: 0 }]);
    }
  }, [devMode]);
  useEvent('World.touch', touchHandler);

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
