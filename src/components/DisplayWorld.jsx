import { useState, useEffect } from 'react';

import ScreenStack from './ScreenStack';
import useLocation from '../hooks/useLocation';
import useInteraction from '../hooks/useInteraction';
import useSave from '../hooks/useSave';
import { keyAlias } from '../utils';
import { TYPES } from '../interactions';

export default function DisplayWorld({
  target,
  battle,

  possesses,

  width, height,
  startWorld, startX, startY,
  magnification=1,
  keyMap={
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
  },
}) {
  const [activeBuffer, setActiveBuffer] = useState(null);
  const [zoneBuffer, setZoneBuffer] = useState(null);
  const [animation, setAnimation] = useState(0);
  const [buffers, setBuffers] = useState([]);

  // This is redundant to the outer App.jsx useSave, because that one fails a
  // race condition to save data before it's unmounted and re-mounted. This one
  // saves data fine, but won't load anything, as the setters are no-op.
  // Magnification is left to App, since on mobile this prop is a fitted value
  // that shouldn't overwrite the saved desktop zoom.
  useSave({
    width: [width, () => {}],
    height: [height, () => {}],
    startWorld: [startWorld, () => {}],
    startX: [startX, () => {}],
    startY: [startY, () => {}],
  });

  const {
    marker, size, walls, layers, bump, zone, local, origin, position, interactions,
  } = useLocation({
    world: startWorld, x: startX, y: startY, width, height,
    possesses,
    keyMap,
  });
  const { interaction, interactionBuffer } = useInteraction({
    bump,
    walls, layers, interactions,
    x: position.x, y: position.y, w: width, h: height,
  });

  // Start interaction event
  useEffect(() => {
    const event = new CustomEvent('interaction', { detail: interaction });
    window.dispatchEvent(event);
  }, [interaction]);

  // Animation counter
  useEffect(() => {
    const interval = setInterval(() => setAnimation(a => a + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Build the zone overlay, if applicable
  useEffect(() => {
    if (!zone) {
      setZoneBuffer(null);
      return;
    }
    const { box, buffer, maxWidth, directions, attributes: { fg='f00', bg=null }={} } = zone;    
    const [startY, startX] = [box[0] - origin.y - 1, box[1] - origin.x - 1];

    let offset = [0, 0];  // total of prior loops, plus current loop
    if (directions) {
      const loops = Math.floor(animation / directions.length);

      // The current frames which are being used by the current loop of the animation.
      // Each frame in directions is a [dy,dx] pair that describes one part of the defined
      // animations frames. [dy,dx] is a single step, but all are applied additively.
      const frames = directions.slice(0, (animation % directions.length) + 1);

      // Because `frames` is just the current loop progress,
      // the offset result of all prior loops should be applied too.
      // We reduce the direction list to one [dy,dx] vector by summing.
      const priorOffset = directions
        .map(([dy, dx]) => [dy * loops, dx * loops])  // Amplify per finished loop
        .reduce(([y, x], [dy, dx]) => [y + dy, x + dx], [0, 0])  // Sum separately
        ;

      // Sum the current loop's progress as a single [dy,dx] result,
      // starting from the priorOffset above.
      offset = frames.reduce(([y, x], [dy, dx]) => [y + dy, x + dx], priorOffset);
    }

    // The sprite is a 2d array, but each array is probably truncating blank spaces
    // at the end of the line and is short the real screen width.
    // Note that if the sprite is smaller than the screen dimensions anyway,
    // none of the sprite's rows will long enough in the first place.
    //
    // Here, we build a viewport-sized 2d array and then fill it with the tiled sprite,
    // while treating truncated sprite positions as blank.
    // There is math here because the entire `priorOffset` found above pushes the tiled
    // sprite around indefinitely, guaranteeing our [1,1] viewport position won't be
    // drawing [1,1] of the tile template.
    const rendered = Array.from(
      { length: height },
      (_, y) => Array.from({ length: width }, (_, x) => {
        // y,x are abstractly walking across the viewport in zero-indexed array space.

        // r,c is the unique coordinate on the map that represents the top-left corner.
        const [r, c] = [y + origin.y + 1, x + origin.x + 1];

        // If the current zone is not applicable, ignore the attempt for this coord.
        if (r < box[0] || r > box[2] || c < box[1] || c > box[3]) return '';
        
        // The buffer-space br,bc is the position in the sprite that should be used for
        // this y,x screen position. If any animation exists, this result changes over time.
        const br = ((y - startY + offset[0]) % size[0] + size[0]) % size[0];
        const bc = ((x - startX + offset[1]) % size[1] + size[1]) % size[1];
        const row = buffer[br % buffer.length];
        return row[bc % maxWidth] || ' ';
      })
    );
    setZoneBuffer({
      bg: bg ? `#${bg}` : null,
      fg: `#${fg}`,
      buffer: rendered,
    });
  }, [zone, origin, size, animation]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('origin', { detail: origin }));
  }, [origin])

  // Find responders to ambient events, if present on the screen.
  useEffect(() => {
    const ambientHandler = ({ detail: { name }}) => {
      Object.entries(interactions)
        .filter(([, { type, [name]: data }]) => type === TYPES.NPC && data)
        .forEach(([, interaction]) => {
          // Auto-throw an interaction-style event that normally the player
          // triggers, not the NPC. The `start` field declares an action is
          // already in progress as of now.
          const event = new CustomEvent('interaction', {
            detail: { ...interaction, start: name },
          });
          window.dispatchEvent(event);
        });
    };
    window.addEventListener('Ambient', ambientHandler);
    return () => window.removeEventListener('Ambient', ambientHandler);
  }, [interactions]);

  // Build the full-screen opacity buffer and copy over player & target sprites.
  // `incidental` interactions have no options available, like a wall that simply
  // blocks your movement.  The coordinate will be highlighted anyway, but it will
  // not dim the whole screen like it needs your attention.
  useEffect(() => {
    if (!target || target.incidental) {
      setActiveBuffer(null);
      return;
    }
    const buffer = Array.from({ length: height }, () => Array.from({ length: width }, () => ' '));
    const [r, c] = target.coordinates;
    buffer[local.y][local.x] = marker;
    buffer[(r - 1) % height][(c - 1) % width] = target.sprite;
    setActiveBuffer(buffer);
  }, [target, width, height]);

  useEffect(() => {
    const buffers = [];

    if (battle) {
      // Battle view compresses the screen into one horizontal strip.
      // The spacers are rows that are empty but get shown above the
      // battle view.
      const spacers = Array.from({ length: parseInt(height / 2) }, () => Array.from({ length: width }, () => ' '));

      // The viewport already offers a 3-layer system of opacity for distance.
      const strips = [
        (layers.foreground || []).join(''),
        (layers.background1 || []).join(''),
        (layers.background2 || []).join(''),
      ];
      const y = position.y + 1;

      // Extreme shorthand for this npc's position and if it's in the battle view
      const prefix = `^(${y}|${y-1}|${y-2}),`;
      const see = Object.entries(interactions).filter(([k]) => k.match(prefix));      
      see.forEach(([coord, data]) => {
        // Put the npc sprite on the opacity layer it currently belongs to
        const [r, c] = coord.split(',').map(Number);
        const x = (c - 1) % width;
        const layer = Math.abs(r - position.y - 1);
        strips[layer] = strips[layer].slice(0, x) + data.sprite + strips[layer].slice(x + 1);
      });
      buffers.push(
        { fg: '#5553', buffer: [...spacers, strips[2]] },
        { fg: '#5558', buffer: [...spacers, strips[1]] },
        { fg: '#555', buffer: [...spacers, strips[0]] },
        { fg: '#000', buffer: [...spacers, ' '.repeat(local.x) + marker] },
      );
    } else {

      // When not in battle mode, this is the standard buffer stack.
      buffers.push(...[
        { fg: '#555', buffer: layers.solid },
        { fg: '#888', buffer: layers.passable },
        { fg: '#f50', buffer: interactionBuffer },
        { fg: '#000', buffer: layers.objects },
        { fg: '#000', buffer: [
          ...Array.from({ length: local.y }, () => ''),
          ' '.repeat(local.x) + marker,  // draw player on their row
        ]},

        // The current viewport
        activeBuffer && { bg: '#ccc7', fg: '#000', buffer: activeBuffer },
        
        // The weather or whatever
        zoneBuffer,
      ].filter(Boolean));
    }

    setBuffers(buffers);
  }, [
    battle, local, layers.solid, layers.passable, layers.objects,
    interactionBuffer, activeBuffer, zoneBuffer,
  ]);

  return (
    <ScreenStack
      gutter="#c7c7c7"
      defaultFg="black"
      width={width}
      height={height}
      hints={[
        `(${keyAlias(keyMap.up)}`,
        `${keyAlias(keyMap.down)}`,
        `${keyAlias(keyMap.left)}`,
        `${keyAlias(keyMap.right)})`,
        ' to move, bump into a target to select',
      ].join('')}
      magnification={magnification}
      buffers={buffers}
    />
  );
}
