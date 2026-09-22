import { useState, useEffect, useRef } from 'react';

import ScreenStack from './ScreenStack';
import useSave from '../hooks/useSave';
import { renderTemplate, minifyNumbers, bufferize, loadSprite, RARITY_COLORS } from '../utils';

const OPTION_KEYS = '1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export default function DisplayMenu({
  target,
  inventory,
  gold,
  ambientMenu,

  width, height, magnification=1,
  keyMap={
    down: 'j',
    up: 'k',
    pageDown: '=',
    pageUp: '-',
    use: 'Enter',
    cancel: 'Backspace',
  },
}) {

  const [menus, setMenus] = useState([]);
  const [options, setOptions] = useState(null);
  const [optionsViewport, setOptionsViewport] = useState(null);
  const [text, setText] = useState(null);
  const [textViewport, setTextViewport] = useState(null);
  const [selected, setSelected] = useState(0);
  const [info, setInfo] = useState(null);
  const [events, setEvents] = useState([]);
  const [sprites, setSprites] = useState({});
  const _inventory = useRef(inventory);
  const useKeyDownRef = useRef(false);

  const _viewportHeight = height - menus.length - (info ? 1 : 0);
  const _page = Math.floor(selected / _viewportHeight);
  const _offset = _page * _viewportHeight;

  useEffect(() => {
    _inventory.current = inventory;
  }, [inventory]);

  // Set fresh menu on target change
  useEffect(() => {
    if (!target) {
      setSelected(0);
      setOptionsViewport(null);
      setTextViewport(null);
      setMenus(ambientMenu);
      return;
    }

    let items;
    let autoMenu = null;

    const autoAction = Object.values(target).find(({ start }) => start);
    if (!autoAction) {
      items = Object.values(target).filter(({ name, hidden }) => name && !hidden);
    } else {
      items = [autoAction];
      autoMenu = {
        title: autoAction.name,
        ...autoAction,
      };
    }
    setMenus([{
      title: `→${target.sprite} ${target.label}`,
      items,
      autoStart: Boolean(autoMenu),
    }, autoMenu].filter(Boolean));
  }, [`${target?.coordinates}`, ambientMenu, width]);  // fixme: target 'updates' when player inventory changes

  // Set options to current menu
  useEffect(() => {
    const { items=null, text=null, selected } = menus[menus.length - 1] || {};
    setOptions(typeof items === 'function' ? items({ inventory: _inventory.current }) : items);
    setText(text ? renderTemplate(text, target?.attributes || {}) : text);
    if (selected !== undefined) {
      setSelected(selected);
    }
  }, [menus.length, menus[0], width, _viewportHeight]);

  // Set optionsViewport to current menu page
  useEffect(() => {
    if (!options) {
      setOptionsViewport(null);
      return;
    }
    setOptionsViewport(options.slice(_offset, _offset + _viewportHeight));
  }, [options, _viewportHeight, _offset]);

  // Load sprites for current optionsViewport
  useEffect(() => {
    if (!optionsViewport) {
      setSprites({});
      return;
    }
    Promise.all(optionsViewport
      .map(async ({ kind, item }, i) => {
        if (!kind || !item?.template) {
          return [i, null];
        }
        const { icon } = await loadSprite(kind, item, { width: 4, height: 4 }, [1, 1]);
        return [i, icon];
      })
    ).then((sprites) => {
      setSprites(Object.fromEntries(sprites));
    });
  }, [optionsViewport]);

  // Set textViewport to current menu text at offset
  useEffect(() => {
    if (!text) {
      setTextViewport(null);
      return;
    }
    setTextViewport(bufferize(menus.length, text, width, height, selected));
  }, [menus.length, text, width, height, selected]);

  // Key handler for cancel
  useEffect(() => {
    const keyHandler = (e) => {
      if (e.key === keyMap.cancel) {
        setMenus((menus) => {
          if (menus[0].autoStart || menus.length === 1) {
            window.dispatchEvent(new CustomEvent('interaction', { detail: null }));
            return menus;
          } else if (menus.length > 1) {
            const newMenus = menus.slice(0, -1);
            setSelected(newMenus[newMenus.length - 1].selected);
            return newMenus;
          }
          return menus;
        });
      }
    };
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, []);

  // Key handler for current menu
  useEffect(() => {
    if (!options) {
      return;
    }
    // Use the option at `selected` and return the next selection.  Runs inside
    // a setSelected() updater; see the NOTE about double-firing below.
    const useOption = (selected) => {
      const option = options[selected] || {};
      if (option?.price && gold + option.price < 0) return selected;
      if (option.event) {
        const event = new CustomEvent(
          option.event,
          { detail: option }
        );

        // NOTE: setTimeout, window.dispatchEvent, and setState(() => {})
        // all trigger a double-firing bug because of the outer setState()
        // function we're operating in.  To preserve the possibility of
        // multiple events in a keypress, we'll allow the bug to damage
        // the event queue, but they'll be filtered out in the useEffect()
        // that dispatches them.  Debouncing does not work.  The bug only
        // happens once when the optionsViewport changes, and only when
        // this particular keypress is the first one handled afterward.
        setEvents((events) => [...events, event]);

        useKeyDownRef.current = false;

        if (option.consume) {
          setOptions((options) => {
            return options.filter((o) => o !== option);
          });
        }

        // Bail now if option was event-only
        if (!option.items && !option.text) {
          return selected;
        }
      }
      setMenus((menus) => {
        menus[menus.length - 1].selected = selected;
        return [...menus, {
          ...option,
          title: `${OPTION_KEYS[selected]}:${option.name}`,
        }];
      });
      return 0;
    };

    const keyHandler = (e) => {
      switch (e.key) {
        case keyMap.down:
          setSelected((selected) => (selected + 1) % options.length);
          break;
        case keyMap.up:
          setSelected((selected) => (selected - 1 + options.length) % options.length);
          break;
        case keyMap.pageDown:
          setSelected((selected) => Math.min(options.length - 1, selected + _viewportHeight));
          break;
        case keyMap.pageUp:
          setSelected((selected) => Math.max(0, selected - _viewportHeight));
          break;
        case keyMap.use:
          if (useKeyDownRef.current || !options.length) return;
          setSelected((selected) => {
            useKeyDownRef.current = true;
            return useOption(selected);
          });
          break;
        default:
          if (e.key.length === 1) {
            const number = !isNaN(e.key);
            const letter = /^[A-Z]$/.test(e.key);
            if (number || (e.shiftKey && letter)) {
              const index = OPTION_KEYS.indexOf(e.key);
              if (index >= 0 && index < options.length) {
                // An option's key selects it, and pressing it again uses it.
                // Held-key repeats only select, so holding can't chain submenus.
                setSelected((selected) => (
                  selected === index && !e.repeat ? useOption(selected) : index
                ));
              }
            }
          }
      }
    };
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, [options, _viewportHeight]);

  // Key release handler for Use key
  useEffect(() => {
    const keyHandler = (e) => {
      if (e.key === keyMap.use) {
        useKeyDownRef.current = false;
      }
    };
    window.addEventListener('keyup', keyHandler);
    return () => window.removeEventListener('keyup', keyHandler);
  }, []);

  // Key handler for text viewport
  useEffect(() => {
    if (!textViewport) {
      return;
    }
    const keyHandler = (e) => {
      let delta = 0;
      switch (e.key) {
        case keyMap.down: delta = 1; break;
        case keyMap.up: delta = -1; break;
        case keyMap.pageDown: delta = _viewportHeight; break;
        case keyMap.pageUp: delta = -_viewportHeight; break;
        default: return;
      }
      setSelected((selected) => {
        const offset = selected + delta
        if (offset < 0) return 0;
        if (delta > 0 && textViewport.length < height) return selected;
        return offset;
      });
    };
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, [textViewport, width, _viewportHeight]);

  // Dispatch events, avoiding the rapid duplication bug on first keypress in a
  // new optionsViewport.
  useEffect(() => {
    if (!events.length) return;
    const handled = [];
    events.forEach((event) => {
      const repr = `${event.type}:${JSON.stringify(event.detail)}`;
      if (handled.includes(repr)) return;
      handled.push(repr);
      window.dispatchEvent(event);
    });
    setEvents([]);
  }, [events]);

  // Update info label for current menu
  useEffect(() => {
    if (!options || !options.length) {
      setInfo(null);
      return;
    }
    const { price, info=[], item: { kind, rarity, stats }={} } = options[selected] || {};
    const { A, D } = stats || {};
    // copy info to _info
    const _info = info.map(bit => bit);
    const index = selected % _viewportHeight;
    if (sprites[index]) {
      _info.push([RARITY_COLORS[rarity], `➧${sprites[index]}`]);
    }
    if (A !== undefined) {
      _info.push([null, `Atk ${minifyNumbers(A)}`]);
    } else if (D !== undefined) {
      _info.push([null, `Def ${minifyNumbers(D)}`]);
    }
    if (price !== undefined) {
      _info.push([(gold + price >= 0 ? null : 'red'), `G ${Math.abs(price)}`]);
    }

    if (!_info.length) {
      setInfo(null);
      return;
    }
    const layers = [
      [null, { bg: '#333', fg: '#c7c7c7', buffer: [
        ...(' '.repeat(height - 2).split(' ')),
        [],
      ]}],
      ...(
        _info.filter(([color]) => color !== null).map(([color]) => [
          color,
          { bg: '#333', fg: color, buffer: [
            ...(' '.repeat(height - 2).split(' ')),
            [],
          ]},
        ])
      ),
    ];

    _info.forEach(([color, text]) => {
      layers.forEach(([thisColor, layer]) => {
        const { buffer } = layer;
        const insert = color === thisColor ? text.split('').concat(['']) : Array(text.length + 1).fill('');
        buffer[buffer.length - 1].push(...insert);
      });
    });
    setInfo(layers.map(([, layer]) => layer));
  }, [sprites, options, gold, selected, _viewportHeight, height]);

  return (
    <ScreenStack
      gutter="#c7c7c7"
      width={width}
      height={height}
      magnification={magnification}
      hints={[
        `(${keyMap.up}/${keyMap.down}, `,
        `${keyMap.pageUp}/${keyMap.pageDown}, 1-9/0/A-Z) to navigate, `,
        `(${keyMap.use}) to use, `,
        `(${keyMap.cancel}) to end`,
      ].join('')}
      buffers={[
        { bg: 'black', fg: '#c7c7c7', buffer: menus.map(({ title }) => title)},
        (menus.length && optionsViewport) && { bg: '#c7c7c7', fg: 'black', buffer: [
          ...(' '.repeat(menus.length - 1).split(' ')),
          ...optionsViewport.map(
            (option, i) => `${OPTION_KEYS[_offset + i]}:${option.name}`
          ),
        ]},
        (menus.length && optionsViewport) && { bg: 'black', fg: '#c7c7c7', buffer: [
          ...(' '.repeat(menus.length - 1).split(' ')),
          ...optionsViewport.map(
            (_, i) => selected === _offset + i ? `${OPTION_KEYS[_offset + i]}:` : ''
          ),

        ]},
        ...((menus.length && info) || []),
        (menus.length && textViewport) && { fg: 'black', buffer: textViewport}
      ].filter(Boolean)}
    />
  );
}
