import { useEffect, useState } from 'react';

import ScreenStack from './ScreenStack';
import useSubDisplayEquip from '../hooks/useSubDisplayEquip';
import useSubDisplayRings from '../hooks/useSubDisplayRings';
import useSubDisplayLog from '../hooks/useSubDisplayLog';
import useSave from '../hooks/useSave';
import { keyAlias } from '../utils';

const TABS_ORDER = ['Equip', 'Rings', 'Log'];

export default function DisplayStats({
  name, hp, strength, defense, speed,
  inventory, equipment, equip, gold, log,

  width, height, magnification=1,
  keyMap={
    up: 'w',
    down: 's',
    left: 'a',
    right: 'd',
    select: ' ',
    cancel: 'Escape',
  },
}) {
  const [menuChoice, setMenuChoice] = useState(0);

  useSave({
    menuChoice: [menuChoice, setMenuChoice],
  });

  // Change horizontal menu category
  useEffect(() => {
    const keydown = (e) => {
      switch (e.key) {
        case keyMap.left: setMenuChoice((choice) => (choice + TABS_ORDER.length - 1) % TABS_ORDER.length); break;
        case keyMap.right: setMenuChoice((choice) => (choice + 1) % TABS_ORDER.length); break;
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, []);

  const equipmentBuffers = useSubDisplayEquip(menuChoice === 0, {
    inventory, equipment, equip,
    width, height, keyMap,
  });
  const ringsBuffers = useSubDisplayRings(menuChoice === 1, {
    inventory, equipment, equip,
    width, height, keyMap,
  });
  const logBuffers = useSubDisplayLog(menuChoice === 2, {
    log,
    width, height, keyMap,
  });
  const lowerBuffers = [
    ...(equipmentBuffers || []),
    ...(ringsBuffers || []),
    ...(logBuffers || []),
  ];

  return (
    <ScreenStack
      width={width}
      height={height}
      magnification={magnification}
      gutter='black'
      hints={[
        `(${keyAlias(keyMap.up)}/`,
        `${keyAlias(keyMap.down)}) to select,`,
        ` (${keyAlias(keyMap.left)}/`,
        `${keyAlias(keyMap.right)}) to change menu,`,
        ` (${keyAlias(keyMap.select)}) to select`,
        ` (${keyAlias(keyMap.cancel)}) to cancel`,
      ].join('')}
      buffers={[
        { fg: '#c7c7c7', buffer: [
          `➧${name}`,
          [`HP:${hp}`.padStart(3, ' ').padEnd(width - (`G:${gold}`.length), ' ') + `G:${gold}`].join(''),
          [
            'A:', `${strength}`.padStart(2, ' '),
            '  D:', `${defense}`.padStart(2, ' '),
            '  S:', `${speed}`.padStart(2, ' '),
          ].join(''),
          TABS_ORDER.join(' '),
        ]},

        // Active tab highlight
        { bg: '#c7c7c7', fg: 'black', buffer: [
          '', '', '',
          [
            ...Array.from(TABS_ORDER.slice(0, menuChoice).join(' '), () => ''),
            ...(menuChoice ? [''] : []), // skip injection of extra space for first tab
            ...TABS_ORDER[menuChoice].split('')
          ]
        ]},
        ...lowerBuffers,
      ]}
    />
  );
}

DisplayStats.whyDidYouRender = true;
