import { useState, useEffect } from 'react';

import useSave from './useSave';
import { zoneAt, rollWeather } from '../zones';

export default function usePosition({
  marker='Θ',
  defaultX=0,
  defaultY=0,
  map,
  walls,
  interactions,
  zones,
  possesses,
  keyMap={
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
  },
}) {

  const [x, setX] = useState(defaultX);
  const [y, setY] = useState(defaultY);
  const [bump, setBump] = useState(null);
  const [zone, setZone] = useState(null);
  const [priorBox, setPriorBox] = useState(null);

  useSave({
    x: [x, (v) => setTimeout(() => setX(v), 50)],
    y: [y, (v) => setTimeout(() => setY(v), 50)],
    zone: [zone, setZone],
  });

  // Reset position when map changes
  useEffect(() => {
    setBump(null);
    setX(defaultX);
    setY(defaultY);
  }, [defaultX, defaultY]);

  // Player movement & bump detection
  useEffect(() => {
    const keydown = (e) => {
      let [newY, newX] = [y, x];
      switch (e.key) {
        case keyMap.up: newY--; break;
        case keyMap.down: newY++; break;
        case keyMap.left: newX--; break;
        case keyMap.right: newX++; break;
        default: return;
      }
      if (!walls[map[newY]?.[newX]] && !interactions[`${newY + 1},${newX + 1}`]) {
        setX(newX);
        setY(newY);
        setBump(null);
        window.dispatchEvent(new CustomEvent('interaction', { detail: null }));
      } else if (`${bump}` === `${newY},${newX}`) {  // same bump twice in a row
        const interaction = interactions[`${newY + 1},${newX + 1}`];
        if (interaction?.destination) {
          const { key } = interaction.attributes || {};
          if (!key || possesses('ring', key)) {
            const event = new CustomEvent('destination', { detail: interaction });
            window.dispatchEvent(event);
          }
        }
      } else {
        setBump([newY, newX]);
      }
    };

    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [map, walls, zones, x, y, bump, keyMap, interactions]);

  // Detect current zone
  useEffect(() => {
    const newZone = zoneAt(zones, y, x);
    if (priorBox !== newZone?.box) {
      setZone(newZone);
      setPriorBox(newZone?.box || null);
    }
  }, [zones, x, y]);

  // Try to change weather zones
  useEffect(() => {
    const nextZone = rollWeather(zone, zones);
    if (nextZone) {
      setZone(nextZone);
    }
  });

  // Respond to movement-based interaction events
  useEffect(() => {
    if (!bump) return;
    const climb = function() {
      setX(bump[1]);
      setY(bump[0]);
    };
    window.addEventListener('Climb.player', climb);
    return () => window.removeEventListener('Climb.player', climb);
  }, [bump]);

  return { marker, bump, zone, x, y };
}
