import { useEffect, useState, useCallback, useMemo } from 'react';

import { place } from '../buffers';
import drawLog, { logTextRows } from '../views/log';
import useSave from './useSave';
import useEventKeys from './useEventKeys';


// Log tab of the stats screen: owns the log's scroll and reading state and its
// keys, and places the standalone log view below the stats header.
export default function useSubDisplayLog(enabled, {
  log,
  topOffset=4,

  width, height, keyMap,
}) {
  const [scrollOffset, setScrollOffset] = useState(null);
  const [text, setText] = useState(null);
  const [textOffset, setTextOffset] = useState(0);

  const [logLength, setLogLength] = useState(log.length);

  useSave({
    logLength: [logLength, setLogLength],
    logScrollOffset: [scrollOffset, setScrollOffset],
    logText: [text, setText],
    logTextOffset: [textOffset, setTextOffset],
  });

  useEffect(() => {
    setLogLength((length) => {
      setScrollOffset((offset) => offset === null ? null : offset + (log.length - length));
      return log.length;
    });
  }, [log.length]);

  const logHeight = height - topOffset;
  const textRows = useMemo(
    () => logTextRows({ text, width, height: logHeight, textOffset }),
    [text, width, logHeight, textOffset],
  );

  // console.log('useSubDisplayLog');
  useListKeys({
    log, setScrollOffset, setText,
  }, (enabled && !text) && keyMap);

  useEffect(() => {
    if (!textRows) return;
    const keydown = (e) => {
      switch (e.key) {
        case keyMap.up:
          setTextOffset((offset) => (offset <= 0) ? 0 : offset - 1);
          break;
        case keyMap.down:
          setTextOffset((offset) => (textRows.length < logHeight - 1) ? offset : offset + 1);
          break;
        case keyMap.cancel:
          setTextOffset(0);
          setText(null);
          break;
      }
    }
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [enabled, textRows, logHeight]);

  return useMemo(() => {
    if (!enabled) return null;
    return place(
      drawLog({ log, width, height: logHeight, scrollOffset, text, textOffset }),
      [topOffset, 0],
    );
  }, [enabled, log, width, logHeight, scrollOffset, text, textOffset, topOffset]);
}

function useListKeys({ log, setScrollOffset, setText }, keyMap) {
  // console.log('useListKeys', keyMap);
  const up = useCallback(() => {
    setScrollOffset((offset) => (offset <= 0) ? 0 : offset - 1);
  }, []);
  const down = useCallback(() => {
    setScrollOffset((offset) => (offset >= log.length - 1) ? offset : (offset === null ? 0 : offset + 1));
  }, [log]);
  const cancel = useCallback(() => {
    setScrollOffset(null);
  }, []);
  const select = useCallback(() => {
    setScrollOffset((offset) => { setText(log[offset]); return offset; });
  }, [log]);

  useEventKeys({ up, down, cancel, select }, keyMap);
}
