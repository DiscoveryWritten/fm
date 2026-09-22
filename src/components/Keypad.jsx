import { useEffect, useRef } from 'react';

import './Keypad.css';

export const SCREENS = ['stats', 'world', 'menu'];
const SCREEN_LABELS = { stats: 'STAT', world: 'WORLD', menu: 'MENU' };

// Which keymap action each physical pad button performs, per focused screen.
// Screens without an entry for a button leave it inert.
const PAD_ACTIONS = {
  stats: { up: 'up', down: 'down', left: 'left', right: 'right', ok: 'select', back: 'cancel' },
  world: { up: 'up', down: 'down', left: 'left', right: 'right' },
  menu: { up: 'up', down: 'down', left: 'pageUp', right: 'pageDown', ok: 'use', back: 'cancel' },
};

const DIGITS = '1234567890'.split('');
const REPEAT_DELAY = 350;
const REPEAT_INTERVAL = 120;

// The game listens for key events on `window`, so the keypad plays the part
// of a keyboard by dispatching the same events a real key would.
function sendKey(type, key) {
  window.dispatchEvent(new KeyboardEvent(type, { key }));
}

function Key({ label, keyName, repeat=false, className='', ...rest }) {
  const timers = useRef([]);
  const down = useRef(false);

  const stop = () => {
    timers.current.forEach(clearTimeout);  // also clears intervals
    timers.current = [];
    if (down.current) {
      down.current = false;
      sendKey('keyup', keyName);
    }
  };

  useEffect(() => stop, []);

  return (
    <button
      type="button"
      className={`key ${className}`}
      disabled={!keyName}
      onPointerDown={(e) => {
        e.preventDefault();
        if (!keyName) return;
        down.current = true;
        sendKey('keydown', keyName);
        if (repeat) {
          timers.current.push(setTimeout(() => {
            timers.current.push(setInterval(() => sendKey('keydown', keyName), REPEAT_INTERVAL));
          }, REPEAT_DELAY));
        }
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      {...rest}
    >{label}</button>
  );
}

export default function Keypad({ focus, setFocus, keyMaps }) {
  const actions = PAD_ACTIONS[focus];
  const keyFor = (button) => keyMaps[focus][actions[button]];

  return (
    <div className="keypad">
      <div className="keypad-screens">
        {SCREENS.map((screen) => (
          <button
            type="button"
            key={screen}
            className={`key soft ${screen === focus ? 'active' : ''}`}
            onPointerDown={(e) => { e.preventDefault(); setFocus(screen); }}
          >{SCREEN_LABELS[screen]}</button>
        ))}
      </div>

      <div className="keypad-main">
        <div className="keypad-actions">
          <Key className="wide" label="CLEAR" keyName={keyFor('back')} />
          <Key className="wide enter" label="ENTER" keyName={keyFor('ok')} />
        </div>
        <div className="keypad-dpad">
          <Key className="arrow up" label="▲" keyName={keyFor('up')} repeat />
          <Key className="arrow left" label={focus === 'menu' ? '-' : '◀'} keyName={keyFor('left')} repeat />
          <Key className="arrow right" label={focus === 'menu' ? '+' : '▶'} keyName={keyFor('right')} repeat />
          <Key className="arrow down" label="▼" keyName={keyFor('down')} repeat />
        </div>
      </div>

      <div className="keypad-digits">
        {DIGITS.map((digit) => (
          <Key key={digit} className="digit" label={digit} keyName={digit} />
        ))}
      </div>
    </div>
  );
}
