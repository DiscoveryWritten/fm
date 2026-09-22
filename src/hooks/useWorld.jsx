import { useState, useEffect } from 'react';

import { loadZones } from '../zones';
import { parseWorld } from '../world';

export default function useWorld({ world }) {
  const [walls, setWalls] = useState({});
  const [size, setSize] = useState([0, 0]);
  const [map, setMap] = useState([]);
  const [interactions, setInteractions] = useState({});
  const [zones, setZones] = useState([]);

  useEffect(() => {
    fetch(`world/${world}`)
      .then((res) => res.text())
      .then((text) => {
        window.dispatchEvent(new CustomEvent('world', { detail: text }));
        const { map, size, walls, interactions, zoneSpecs, errors } = parseWorld(text);
        errors.forEach((e) => console.error(e));
        setMap(map);
        setSize(size);
        setWalls(walls);
        setInteractions(interactions);
        return [size, zoneSpecs];
      }).then(async ([size, boxGroups]) => {
        const zones = await loadZones(
          boxGroups,
          size,
          (dataFile) => fetch(`overlays/${dataFile}`).then((res) => res.text()),
          (detail) => window.dispatchEvent(new CustomEvent('_overlay', { detail })),
        );
        setZones(zones);
      });
  }, [world]);

  return { map, size, walls, interactions, zones };
}
