// Dev mode: the creator is experimenting.  Edits apply live, and saves are
// paused so the experiment can't overwrite the game being played.  It's a
// meta setting, kept outside every save slot.
const KEY = 'meta:dev';

export function isDevMode() {
  try {
    return localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
}

export function setDevMode(on) {
  try {
    if (on) localStorage.setItem(KEY, 'on');
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: dev mode still applies until the page reloads.
  }
  window.dispatchEvent(new CustomEvent('Dev.mode', { detail: { on } }));
}
