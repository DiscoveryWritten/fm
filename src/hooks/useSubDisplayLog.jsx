import { useEffect, useState, useCallback } from 'react';

import { bufferize, bufferizeList, minifyNumbers } from '../utils';
import useSave from './useSave';
import useEventKeys from './useEventKeys';


export default function useSubDisplayLog(enabled, {
  log,
  topOffset=4,

  width, height, keyMap,
}) {
  const [buffers, setBuffers] = useState(null);
  const [scrollBuffer, setScrollBuffer] = useState(null);
  const [scrollSelectionBuffer, setScrollSelectionBuffer] = useState(null);
  const [scrollOffset, setScrollOffset] = useState(null);

  const [text, setText] = useState(null);
  const [textViewport, setTextViewport] = useState(null);
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

  // console.log('useSubDisplayLog');
  useListKeys({
    log, setScrollOffset, setText,
  }, (enabled && !text) && keyMap);

  useEffect(() => {
    if (!enabled === null || !textViewport) return;
    const keydown = (e) => {
      switch (e.key) {
        case keyMap.up:
          setTextOffset((offset) => (offset <= 0) ? 0 : offset - 1);
          break;
        case keyMap.down:
          setTextOffset((offset) => (textViewport.length < height) ? offset : offset + 1);
          break;
        case keyMap.cancel:
          setTextOffset(0);
          setText(null);
          break;
      }
    }
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [enabled, textViewport, height]);

  useEffect(() => {
    if (!enabled) return;
    const list = log.map((msg, i) => `${minifyNumbers(log.length - i)} ${msg}`.padEnd(width, ' '));
    const buffer = bufferizeList(topOffset, [''].concat(list, ['']), width, height, scrollOffset || 0);
    setScrollBuffer(buffer);
    setScrollSelectionBuffer(buffer.map(
      (line, i) => i === topOffset + 1 ? line : ''
    ));
  }, [enabled, log, scrollOffset, topOffset, height, width]);

  useEffect(() => {
    if (!text) {
      setTextViewport(null);
      return;
    }
    setTextViewport(bufferize(topOffset + 1, text, width, height, textOffset));
  }, [text, width, height, topOffset, textOffset]);

  useEffect(() => {
    if (!enabled) {
      setBuffers(null);
      return;
    }
    if (!textViewport) {
      setBuffers([
        scrollBuffer && { fg: '#555', buffer: scrollBuffer },
        (scrollOffset !== null && scrollSelectionBuffer) && { bg: '#555', fg: 'black', buffer: scrollSelectionBuffer },
      ].filter(Boolean));
    } else {
      setBuffers([
        { bg: '#888', fg: 'black', buffer: [
          '', '', '', '',
          `Entry ${log.length - (scrollOffset || 0)}:`.padEnd(width, ' '),
        ]},
        { bg: '#c7c7c7', fg: '#c7c7c7', buffer: [
          '', '', '', '', '',
          ...(Array.from({ length: height - topOffset - 1 }, () => ' '.repeat(width))),
        ]},
        textViewport && { fg: 'black', buffer: textViewport},
      ].filter(Boolean));
    }
  }, [enabled, textViewport, scrollBuffer, height, width, scrollSelectionBuffer]);

  return buffers;
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
