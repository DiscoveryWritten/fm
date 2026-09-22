import { useState, useCallback } from 'react';

import useEvent from './useEvent';
import useSave from './useSave';
import { applyChange } from '../stats';

// Characters' stats as dialogue has changed them, by character name.
//
// Showing text that marks a change (R+1:HEY!) sends a 'Stats.change' event:
//   { character, base: { code: value }, changes: [{ code, op, value, phrase }] }
// where `base` holds the stat tokens from the character's map line.  Each
// change applies once per character, the first time its line is shown, on
// top of the character's current value (or its base, or 0).
export default function useCharacterStats() {
  const [state, setState] = useState({ values: {}, seen: [] });

  useSave({ characterStats: [state, setState] });

  const changeHandler = useCallback(({ detail: { character, base={}, changes=[] } }) => {
    setState(({ values, seen }) => {
      const current = { ...base, ...values[character] };
      const fresh = changes.filter((change) => !seen.includes(changeKey(character, change)));
      if (!fresh.length) return { values, seen };
      fresh.forEach((change) => {
        current[change.code] = applyChange(current[change.code], change);
      });
      return {
        values: { ...values, [character]: current },
        seen: [...seen, ...fresh.map((change) => changeKey(character, change))],
      };
    });
  }, []);
  useEvent('Stats.change', changeHandler);

  return state.values;
}

function changeKey(character, { code, op, value, phrase }) {
  return `${character}|${code}|${op}|${value}|${phrase}`;
}
