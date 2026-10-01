import { useState, useCallback, useRef } from 'react';

import useEvent from './useEvent';

// A number that goes up each time a game file this hook cares about changes
// (a `Content.changed` event whose path passes `matches`).  Put it in a
// loading effect's dependencies, and the effect reads the file again.
export default function useContentVersion(matches) {
  const [version, setVersion] = useState(0);
  const matchesRef = useRef(matches);
  matchesRef.current = matches;

  const handler = useCallback(({ detail: { path } }) => {
    if (matchesRef.current(path)) setVersion((v) => v + 1);
  }, []);
  useEvent('Content.changed', handler);

  return version;
}
