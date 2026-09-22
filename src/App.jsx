import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';

import Visualizer from './Visualizer';
import DisplayStats from './components/DisplayStats';
import DisplayWorld from './components/DisplayWorld';
import DisplayMenu from './components/DisplayMenu';
import Analysis from './components/Analysis';
import Keypad from './components/Keypad';
import { FONT_WIDTH, FONT_HEIGHT } from './components/Screen';
import useAnalyzer from './hooks/useAnalyzer';
import useInventory from './hooks/useInventory';
import useSave from './hooks/useSave';
import useEvent from './hooks/useEvent';
import useMediaQuery from './hooks/useMediaQuery';


const VIEWPORT_WIDTH = 16;
const VIEWPORT_HEIGHT = 8;

const KEYMAP_STATS = {
  up: 'w',
  down: 's',
  left: 'a',
  right: 'd',
  select: ' ',
  cancel: 'Escape',
};
const KEYMAP_WORLD = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
};
const KEYMAP_MENU = {
  down: 'j',
  up: 'k',
  pageDown: '=',
  pageUp: '-',
  use: 'Enter',
  cancel: 'Backspace',
};
const KEYMAPS = { stats: KEYMAP_STATS, world: KEYMAP_WORLD, menu: KEYMAP_MENU };

// Below this width the game becomes a calculator: one screen at a time, with an
// on-screen keypad instead of a keyboard.
const COMPACT_QUERY = '(max-width: 900px)';

export default function App({
  game,  // from game.txt: { title, world, start: [row, col], log }
  startMagnification=2,
  beginWorld=game.world,
  beginX=game.start[1] - 1,
  beginY=game.start[0] - 1,
  startWidth=VIEWPORT_WIDTH,
  startHeight=VIEWPORT_HEIGHT,
}) {
  const [input, setInput] = useState('');
  // const { ready, analyze, blocks } = useAnalyzer();

  const [magnification, setMagnification] = useState(startMagnification);
  const [width, setWidth] = useState(startWidth);
  const [height, setHeight] = useState(startHeight);
  const [startWorld, setStartWorld] = useState(beginWorld);
  const [startX, setStartX] = useState(beginX);
  const [startY, setStartY] = useState(beginY);
  const [ambientMenu, setAmbientMenu] = useState([]);
  const [battle, setBattle] = useState(null);

  const [interaction, setInteraction] = useState(null);
  const [focus, setFocus] = useState('world');
  const compact = useMediaQuery(COMPACT_QUERY);
  const [pinned, setPinned] = useState(null);
  const calculatorRef = useRef(null);
  const mainSlotRef = useRef(null);
  const pinSlotRef = useRef(null);
  const slotRects = {
    main: useRelativeRect(mainSlotRef, calculatorRef, compact),
    pin: useRelativeRect(pinSlotRef, calculatorRef, compact && Boolean(pinned)),
  };
  const place = (screen) => placeScreen({
    compact, focus, pinned, screen, slotRects, width, height, magnification,
  });

  useEffect(() => {
    document.documentElement.classList.toggle('compact', compact);
  }, [compact]);
  const {
    stats,
    inventory, equipment, log,
    handlers,
  } = useInventory('player', { startLog: game.log });

  useSave({
    magnification: [magnification, setMagnification],
    width: [width, setWidth],
    height: [height, setHeight],
    startWorld: [startWorld, setStartWorld],
    startX: [startX, setStartX],
    startY: [startY, setStartY],
  });

  useEventInteraction({ setInteraction });
  useEventFight({ setBattle, setInteraction });
  useEventDestination({ startWorld, setStartWorld, setStartY, setStartX });
  useEventFocus({ setFocus });

  // Set up world
  useEffect(() => {
    setAmbientMenu([{
      title: startWorld.replace(/\.txt$/, '').toUpperCase(),
      items: [
        {name: 'Wait', event: 'Wait'},
        {name: 'Shout', event: 'Ambient'},
        {name: 'Hide', event: 'Ambient'},
      ].filter(Boolean),
    }]);
  }, [startWorld]);

  return (
    <>
      {!compact && <>
      <h1>Make games with text files.</h1>
      <p>
        <label style={{ margin: '0 0 0 1em' }} htmlFor="magnification">Zoom: </label>
        <input id="magnification"
          type="number"
          value={magnification}
          onChange={(e) => setMagnification(Number(e.target.value))}
          onKeyDown={(e) => e.stopPropagation()}
          style={{width: 50}}
        />
        <label style={{ margin: '0 0 0 1em' }} htmlFor="width">Width: </label>
        <input id="width"
          type="number"
          value={width}
          onChange={(e) => setWidth(parseInt(e.target.value))}
          onKeyDown={(e) => e.stopPropagation()}
          style={{width: 50}}
        />
        <label style={{ margin: '0 0 0 1em' }} htmlFor="height">Height: </label>
        <input id="height"
          type="number"
          value={height}
          onChange={(e) => setHeight(parseInt(e.target.value))}
          onKeyDown={(e) => e.stopPropagation()}
          style={{width: 50}}
        />
      </p>
      </>}

      <div ref={calculatorRef} className={compact ? 'calculator compact' : 'calculator'} style={compact ? undefined : {display: 'flex', flexDirection: 'column', alignItems: 'stretch', maxWidth: 'fit-content', margin: 'auto'}}>
        {compact && <div ref={mainSlotRef} className="main-slot" />}
        <div className="displays" style={{display: 'flex', flexDirection: 'row', justifyContent: 'center'}}>
          <div {...place('stats').wrapper}>
          <DisplayStats
            {...stats.current}
            inventory={inventory}
            equipment={equipment}
            equip={handlers.current.equip}
            log={log}

            width={width}
            height={height}
            magnification={place('stats').magnification}
            keyMap={KEYMAP_STATS}
          />
          </div>
          <div {...place('world').wrapper}>
          <DisplayWorld
            battle={battle}
            target={interaction}

            possesses={handlers.current.possesses}

            startWorld={startWorld}
            startX={startX}
            startY={startY}
            width={width}
            height={height}
            magnification={place('world').magnification}
            keyMap={KEYMAP_WORLD}
          />
          </div>
          <div {...place('menu').wrapper}>
          <DisplayMenu
            target={interaction}
            gold={stats.current.gold}
            ambientMenu={ambientMenu}

            inventory={inventory}
            equipment={equipment}
            acquire={handlers.current.acquire}

            width={width}
            height={height}
            magnification={place('menu').magnification}
            keyMap={KEYMAP_MENU}
          />
          </div>
        </div>
        {compact && (
          <Keypad
            focus={focus} setFocus={setFocus}
            pinned={pinned} setPinned={setPinned}
            keyMaps={KEYMAPS}
            pinRef={pinSlotRef}
          />
        )}
        <div hidden>
        {/* <div style={{display: 'flex', flexDirection: 'row'}}> */}
          <input
            className="ti large"
            style={{flex: 1}}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                // analyze(e, input);
                e.target.blur();
              }
            }}
          />
          <button
            className="ti inverted large"
            onClick={(e) => null/* analyze(e, input) */}
          >Analyze</button>
        </div>
      </div>

      {/* <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-around'}}>
        {ready && (
          blocks.map((block, i) => (
            <div key={i} style={{width: 200, padding: 5}}>
              <Analysis {...block} />
            </div>
          ))
        )}
      </div> */}
      {!compact && <label><input
        type="checkbox"
        id="visualizer-toggle"
        onChange={e => document.getElementById('visualizer').hidden =! e.target.checked}
      />Visualizer</label>}
      {!compact && <div>
        <a href="https://github.com/tiliv/fm">GitHub</a> • <a href="https://ko-fi.com/discoverywritten#">Donate</a>
      </div>}
      <Visualizer startWorld={startWorld} width={width} height={height} />
    </>
  )
}


function useEventInteraction({ setInteraction }) {
  const interactionHandler = useCallback(({ detail: interaction }) => {
    if (!interaction) {
      setInteraction(null);
      return;
    }
    const { start=null, ...startInteraction } = interaction;
    if (start) {
      Object.assign(startInteraction, {
        [start]: { ...startInteraction[start], start: true },
      });
    }
    setInteraction(startInteraction);
  }, []);
  useEvent('interaction', interactionHandler);
}

function useEventFight({ setBattle, setInteraction }) {
  const fightHandler = useCallback(({ detail: battle }) => {
    setBattle(battle);
    setInteraction(null);
  }, []);
  useEvent('Fight', fightHandler);

  const sheatheHandler = useCallback(() => {
    setBattle(null);
    setInteraction(null);
  }, []);
  useEvent('Sheathe', sheatheHandler);
}

function useEventDestination({ startWorld, setStartWorld, setStartY, setStartX }) {
  const destinationHandler = useCallback(({ detail: { destination: [r, c], dataFile }}) => {
    setStartWorld(dataFile || startWorld);
    setStartY(r - 1);
    setStartX(c - 1);
  }, [startWorld]);
  useEvent('destination', destinationHandler);
}


// An interaction opens the menu only if it has something to pick; bumping a
// plain wall shouldn't pull you out of the world.
function hasMenuItems(interaction) {
  return Boolean(interaction.start) || Object.values(interaction).some(
    (value) => value?.name && !value.hidden
  );
}

function useEventFocus({ setFocus }) {
  const interactionHandler = useCallback(({ detail: interaction }) => {
    if (interaction && hasMenuItems(interaction)) {
      setFocus('menu');
    } else if (!interaction) {
      setFocus((focus) => focus === 'menu' ? 'world' : focus);
    }
  }, []);
  useEvent('interaction', interactionHandler);

  const worldHandler = useCallback(() => setFocus('world'), []);
  useEvent('destination', worldHandler);
  useEvent('Fight', worldHandler);
}

// Where each screen is drawn.  Screens never unmount (their hooks hold game
// state); in compact mode they are absolutely positioned over the main slot
// or the pin slot, or hidden, and each gets a magnification fitted to its slot.
function placeScreen({ compact, focus, pinned, screen, slotRects, width, height, magnification }) {
  if (!compact) return { magnification, wrapper: {} };
  const slot = screen === focus ? 'main' : screen === pinned ? 'pin' : null;
  const rect = slot && slotRects[slot];
  if (!rect) return { magnification, wrapper: { hidden: true } };

  const fit = Math.min(rect.w / (width * FONT_WIDTH), rect.h / (height * FONT_HEIGHT));
  const mag = Math.max(0.25, Math.floor(fit * 20) / 20);
  return {
    magnification: mag,
    wrapper: {
      className: `screen-slot ${slot}`,
      style: {
        left: rect.x + (rect.w - width * FONT_WIDTH * mag) / 2,
        top: rect.y + (rect.h - height * FONT_HEIGHT * mag) / 2,
      },
    },
  };
}

// An element's box relative to another, kept current as either resizes.
function useRelativeRect(ref, rootRef, enabled) {
  const [rect, setRect] = useState(null);

  useLayoutEffect(() => {
    if (!enabled || !ref.current || !rootRef.current) {
      setRect(null);
      return;
    }
    const update = () => {
      const r = ref.current.getBoundingClientRect();
      const o = rootRef.current.getBoundingClientRect();
      const next = { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height };
      setRect((prev) => (
        prev && Object.keys(next).every((k) => Math.abs(prev[k] - next[k]) < 0.5) ? prev : next
      ));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(ref.current);
    observer.observe(rootRef.current);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [enabled]);

  return rect;
}
