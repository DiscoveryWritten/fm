import { useEffect } from 'react';

const IGNORE_VALUES = [undefined, null];

function currentSlot(detail) {
  const { slot=localStorage.getItem('latest') || "Hero" } = detail || {};
  return slot;
}

function restore(vars, slot) {
  // console.log("* Loading", slot);
  localStorage.setItem('latest', slot);
  Object.entries(vars).forEach(([key, [_, setter]]) => {
    const v = JSON.parse(localStorage.getItem(`${slot}/${key}`));
    // console.log(slot, key, v);
    if (!IGNORE_VALUES.includes(v)) {
      setter(v);
    }
  });
}

export default function useSave({...vars}) {
  useEffect(() => {
    const saveHandler = (e) => {
      const slot = currentSlot(e.detail);
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

  // Restore the latest save as soon as this hook mounts.  Waiting for the
  // window 'load' event alone is a race: it often fires before React has
  // registered the listener below.
  useEffect(() => {
    if (localStorage.getItem('latest') !== null) {
      restore(vars, currentSlot());
    }
  }, []);

  useEffect(() => {
    const loadHandler = (e) => restore(vars, currentSlot(e.detail));
    window.addEventListener('load', loadHandler);
    return () => window.removeEventListener('load', loadHandler);
  });
}
