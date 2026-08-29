import { useMemo, useCallback } from 'react';

import useEvent from './useEvent';

export default function useEventKeys(binds, keyMap) {
  const inverseKeyMap = useMemo(() => Object.fromEntries(
    Object.entries(keyMap).map(([k, v]) => [v, k])
  ), [keyMap]);

  const keydownHandler = useCallback(({ key }) => {
    binds[inverseKeyMap[key]]?.();
  }, [inverseKeyMap, ...Object.values(binds)]);
  useEvent('keydown', keydownHandler);
}
