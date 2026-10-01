import { useState, useCallback } from 'react';

import useEvent from './useEvent';
import { isDevMode, setDevMode } from '../dev';

// Whether dev mode is on, kept current by `Dev.mode` events.
export default function useDevMode() {
  const [on, setOn] = useState(isDevMode);
  const handler = useCallback(({ detail }) => setOn(detail.on), []);
  useEvent('Dev.mode', handler);
  return [on, setDevMode];
}
