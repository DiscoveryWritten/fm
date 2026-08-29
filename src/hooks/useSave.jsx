import { useEffect } from 'react';

const IGNORE_VALUES = [undefined, null];

export default function useSave({...vars}) {
  useEffect(() => {
    const saveHandler = (e) => {
      const { slot=localStorage.getItem('latest') || "Hero" } = e.detail || {};
      // console.log("* Saving", slot);
      localStorage.setItem('latest', slot);
      Object.entries(vars).forEach(([key, [value, _]]) => {
        // console.log(slot, key, value);
        localStorage.setItem(`${slot}/${key}`, JSON.stringify(value));
      });
    };
    window.addEventListener('Save', saveHandler);
    return () => {
      window.removeEventListener('Save', saveHandler);
    };
  });
  useEffect(() => {
    const loadHandler = (e) => {
      const { slot=localStorage.getItem('latest') || "Hero" } = e.detail || {};
      // console.log("* Loading", slot);
      localStorage.setItem('latest', slot);
      Object.entries(vars).forEach(([key, [_, setter]]) => {
        const v = JSON.parse(localStorage.getItem(`${slot}/${key}`));
        // console.log(slot, key, v);
        if (!IGNORE_VALUES.includes(v)) {
          setter(v);
        }
      });
    };
    window.addEventListener('load', loadHandler);
    return () => window.removeEventListener('load', loadHandler);
  });
}
