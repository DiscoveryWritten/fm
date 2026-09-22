import { useState, useEffect, useCallback, useRef } from 'react';

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

const START_WORLD = 'Terra Montans.txt'
const [START_Y, START_X] = [20, 22];
const START_LOG = [
  "You've never been this tired before.",
  'You wake up in a small room, the walls are made of stone and the floor is dirt.',
];

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
const COMPACT_GUTTER = 8;

export default function App({
  startMagnification=2,
  beginWorld=START_WORLD,
  beginX=START_X - 1,
  beginY=START_Y - 1,
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
  const keypadRef = useRef(null);
  const fitMagnification = useFitMagnification({
    enabled: compact, width, height, reservedRef: keypadRef,
  });
  const displayMagnification = compact ? fitMagnification : magnification;
  const {
    stats,
    inventory, equipment, log,
    handlers,
  } = useInventory('player', { startLog: START_LOG });

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

      <div className={compact ? 'calculator compact' : 'calculator'} style={{display: 'flex', flexDirection: 'column', alignItems: 'stretch', maxWidth: 'fit-content', margin: 'auto'}}>
        <div className="displays" style={{display: 'flex', flexDirection: 'row', justifyContent: 'center'}}>
          <div hidden={compact && focus !== 'stats'}>
          <DisplayStats
            {...stats.current}
            inventory={inventory}
            equipment={equipment}
            equip={handlers.current.equip}
            log={log}

            width={width}
            height={height}
            magnification={displayMagnification}
            keyMap={KEYMAP_STATS}
          />
          </div>
          <div hidden={compact && focus !== 'world'}>
          <DisplayWorld
            battle={battle}
            target={interaction}

            possesses={handlers.current.possesses}

            startWorld={startWorld}
            startX={startX}
            startY={startY}
            width={width}
            height={height}
            magnification={displayMagnification}
            keyMap={KEYMAP_WORLD}
          />
          </div>
          <div hidden={compact && focus !== 'menu'}>
          <DisplayMenu
            target={interaction}
            gold={stats.current.gold}
            ambientMenu={ambientMenu}

            inventory={inventory}
            equipment={equipment}
            acquire={handlers.current.acquire}

            width={width}
            height={height}
            magnification={displayMagnification}
            keyMap={KEYMAP_MENU}
          />
          </div>
        </div>
        {compact && (
          <div ref={keypadRef}>
            <Keypad focus={focus} setFocus={setFocus} keyMaps={KEYMAPS} />
          </div>
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
      <div>
        <a href="https://github.com/tiliv/fm">GitHub</a> • <a href="https://ko-fi.com/discoverywritten#">Donate</a>
      </div>
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

// Largest magnification (in 0.05 steps) that fits one screen plus the keypad
// in the window.
function useFitMagnification({ enabled, width, height, reservedRef }) {
  const [fit, setFit] = useState(1);

  useEffect(() => {
    if (!enabled) return;
    const update = () => {
      const reserved = reservedRef.current?.offsetHeight || 0;
      const byWidth = (window.innerWidth - 2 * COMPACT_GUTTER) / (width * FONT_WIDTH);
      const byHeight = (window.innerHeight - reserved - 2 * COMPACT_GUTTER) / (height * FONT_HEIGHT);
      setFit(Math.max(0.5, Math.floor(Math.min(byWidth, byHeight) * 20) / 20));
    };
    update();
    window.addEventListener('resize', update);
    const observer = new ResizeObserver(update);
    if (reservedRef.current) observer.observe(reservedRef.current);
    return () => {
      window.removeEventListener('resize', update);
      observer.disconnect();
    };
  }, [enabled, width, height]);

  return fit;
}
