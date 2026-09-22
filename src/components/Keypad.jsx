import { useRef, useState, useEffect } from 'react';

import './Keypad.css';

export const SCREENS = ['stats', 'world', 'menu'];
const SCREEN_LABELS = { stats: 'STAT', world: 'WORLD', menu: 'MENU' };

// Which keymap action each pad zone performs, per focused screen.
// Screens without an entry for a zone leave it inert.
const PAD_ACTIONS = {
  stats: { up: 'up', down: 'down', left: 'left', right: 'right', ok: 'select', back: 'cancel' },
  world: { up: 'up', down: 'down', left: 'left', right: 'right' },
  menu: { up: 'up', down: 'down', left: 'pageUp', right: 'pageDown', ok: 'use', back: 'cancel' },
};

const DIGITS = '1234567890'.split('');
const ARROWS = ['up', 'right', 'down', 'left'];
const REPEAT_DELAY = 350;
const REPEAT_INTERVAL = 120;
const KEYUP_DELAY = 60;  // Menu 'use' needs its keyup after React has rendered the keydown
const LONG_PRESS = 450;

// The game listens for key events on `window`, so the keypad plays the part
// of a keyboard by dispatching the same events a real key would.
function sendKey(type, key) {
  window.dispatchEvent(new KeyboardEvent(type, { key }));
}
function tapKey(key) {
  sendKey('keydown', key);
  setTimeout(() => sendKey('keyup', key), KEYUP_DELAY);
}

// How each zone reacts to a finger:
//  repeat:  fires on entry and repeats while held (arrows)
//  live:    fires on entry, so dragging across previews selections (digits)
//  release: highlights on entry, fires only if the finger lifts inside (enter, clear)
function zoneKind(zone) {
  if (ARROWS.includes(zone)) return 'repeat';
  if (DIGITS.includes(zone)) return 'live';
  return 'release';
}

// One pointer is tracked across the whole surface, so a finger can slide from
// key to key.  Zones are any descendants carrying `data-zone`.
function usePadGesture(keyForZone) {
  const surfaceRef = useRef(null);
  const active = useRef(null);
  const timers = useRef([]);
  const keyFor = useRef(keyForZone);
  const [pressed, setPressed] = useState(null);
  keyFor.current = keyForZone;

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);  // also clears intervals
    timers.current = [];
  };

  const enter = (zone) => {
    active.current = zone;
    setPressed(zone);
    const key = zone && keyFor.current(zone);
    if (!key) return;
    switch (zoneKind(zone)) {
      case 'repeat':
        sendKey('keydown', key);
        timers.current.push(setTimeout(() => {
          timers.current.push(setInterval(() => sendKey('keydown', key), REPEAT_INTERVAL));
        }, REPEAT_DELAY));
        break;
      case 'live':
        tapKey(key);
        break;
    }
  };

  const leave = ({ release=false }={}) => {
    const zone = active.current;
    active.current = null;
    setPressed(null);
    clearTimers();
    const key = zone && keyFor.current(zone);
    if (!key) return;
    const kind = zoneKind(zone);
    if (kind === 'repeat') sendKey('keyup', key);
    if (kind === 'release' && release) tapKey(key);
  };

  const zoneAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    if (!el || !surfaceRef.current?.contains(el)) return null;
    return el.closest('[data-zone]')?.dataset.zone || null;
  };

  useEffect(() => clearTimers, []);

  const handlers = {
    onPointerDown: (e) => {
      const zone = zoneAt(e.clientX, e.clientY);
      if (!zone) return;  // let non-pad elements (the pin slot) handle their own taps
      e.preventDefault();
      surfaceRef.current.setPointerCapture(e.pointerId);
      enter(zone);
    },
    onPointerMove: (e) => {
      if (!surfaceRef.current.hasPointerCapture(e.pointerId)) return;
      const zone = zoneAt(e.clientX, e.clientY);
      if (zone !== active.current) {
        leave();
        enter(zone);
      }
    },
    onPointerUp: () => leave({ release: true }),
    onPointerCancel: () => leave(),
    onContextMenu: (e) => e.preventDefault(),
  };

  return { surfaceRef, handlers, pressed };
}

// Annular sector centred on `angle` (degrees, 0 = right, clockwise).
function arcPath(cx, cy, rIn, rOut, angle, span) {
  const rad = (a) => (a * Math.PI) / 180;
  const [a0, a1] = [rad(angle - span / 2), rad(angle + span / 2)];
  const pt = (r, a) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  return [
    `M ${pt(rOut, a0)}`,
    `A ${rOut} ${rOut} 0 0 1 ${pt(rOut, a1)}`,
    `L ${pt(rIn, a1)}`,
    `A ${rIn} ${rIn} 0 0 0 ${pt(rIn, a0)}`,
    'Z',
  ].join(' ');
}

const ARC_ANGLES = { right: 0, down: 90, left: 180, up: 270 };
const ARC_GLYPHS = { up: '▲', right: '▶', down: '▼', left: '◀' };
const PAGER_GLYPHS = { left: '−', right: '+' };

function Donut({ focus, keyFor, pressed }) {
  const [c, rIn, rOut, span] = [100, 44, 86, 74];
  const clear = { x: 176, y: 24, r: 16 };
  const isPager = (zone) => focus === 'menu' && (zone === 'left' || zone === 'right');
  const cls = (zone, base) => [
    base,
    keyFor(zone) ? '' : 'inert',
    pressed === zone ? 'pressed' : '',
    isPager(zone) ? 'pager' : '',
  ].join(' ');

  return (
    <svg className="donut" viewBox="0 0 200 200" aria-label="Direction pad">
      <defs>
        <radialGradient id="well" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#141414" />
          <stop offset="75%" stopColor="#1f1f1f" />
          <stop offset="100%" stopColor="#3a3a3a" />
        </radialGradient>
      </defs>
      <circle className="donut-base" cx={c} cy={c} r={rOut + 8} />
      {ARROWS.map((zone) => {
        const angle = ARC_ANGLES[zone];
        const [lx, ly] = [c + 65 * Math.cos(angle * Math.PI / 180), c + 65 * Math.sin(angle * Math.PI / 180)];
        return (
          <g key={zone}>
            <path data-zone={zone} className={cls(zone, 'arc')} d={arcPath(c, c, rIn, rOut, angle, span)} />
            <text className="glyph" x={lx} y={ly}>{isPager(zone) ? PAGER_GLYPHS[zone] : ARC_GLYPHS[zone]}</text>
          </g>
        );
      })}
      <circle data-zone="ok" className={cls('ok', 'well')} cx={c} cy={c} r={rIn - 6} fill="url(#well)" />
      <text className="glyph small" x={c} y={c}>ENTER</text>
      <circle data-zone="back" className={cls('back', 'clear')} cx={clear.x} cy={clear.y} r={clear.r} />
      <text className="glyph small" x={clear.x} y={clear.y}>CLR</text>
    </svg>
  );
}

function SoftKey({ screen, focus, pinned, setFocus, togglePin }) {
  const timer = useRef(null);
  const longPressed = useRef(false);

  const cancel = () => {
    clearTimeout(timer.current);
    timer.current = null;
  };

  return (
    <button
      type="button"
      className={[
        'key', 'soft',
        screen === focus ? 'active' : '',
        screen === pinned ? 'pinned' : '',
      ].join(' ')}
      onPointerDown={(e) => {
        e.preventDefault();
        longPressed.current = false;
        timer.current = setTimeout(() => {
          longPressed.current = true;
          navigator.vibrate?.(10);
          togglePin(screen);
        }, LONG_PRESS);
      }}
      onPointerUp={() => {
        if (timer.current && !longPressed.current) setFocus(screen);
        cancel();
      }}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
    >{SCREEN_LABELS[screen]}</button>
  );
}

export default function Keypad({ focus, setFocus, pinned, setPinned, keyMaps, pinRef }) {
  const keyFor = (zone) => {
    if (DIGITS.includes(zone)) return zone;
    const action = PAD_ACTIONS[focus][zone];
    return action ? keyMaps[focus][action] : null;
  };
  const { surfaceRef, handlers, pressed } = usePadGesture(keyFor);
  const togglePin = (screen) => setPinned((current) => current === screen ? null : screen);

  return (
    <div className="keypad">
      <div className="keypad-screens">
        {SCREENS.map((screen) => (
          <SoftKey
            key={screen}
            screen={screen}
            focus={focus}
            pinned={pinned}
            setFocus={setFocus}
            togglePin={togglePin}
          />
        ))}
      </div>

      <div className="pad-surface" ref={surfaceRef} {...handlers}>
      <div className="keypad-main">
        <div
          ref={pinRef}
          className={`pin-slot ${pinned ? 'filled' : ''} ${pinned && pinned === focus ? 'raised' : ''}`}
          onPointerUp={() => pinned && setFocus(pinned)}
        >
          {!pinned && <span className="pin-hint">hold a screen key to pin it here</span>}
          {pinned && pinned === focus && <span className="pin-hint">▲ {SCREEN_LABELS[pinned]}</span>}
        </div>
        <Donut focus={focus} keyFor={keyFor} pressed={pressed} />
      </div>

      <div className="keypad-digits">
        {DIGITS.map((digit) => (
          <div key={digit} data-zone={digit} className={`key digit ${pressed === digit ? 'pressed' : ''}`}>
            {digit}
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
