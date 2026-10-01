import { useState, useEffect, useRef } from 'react';
import { RARITY_COLORS, loadSprite } from '../utils';
import useContentVersion from './useContentVersion';

const MAP_KIND_SAME = (kind) => kind;

export default function useSpriteLayers({
  inventory, equipment, positions,
  mapKind=MAP_KIND_SAME,
  offsetLeft=0,
  width, height,  // local width/height, not screen size
}) {
  const inventoryRef = useRef(inventory);
  const [sprites, setSprites] = useState({});
  const [layers, setLayers] = useState(null);
  const version = useContentVersion((path) => path.startsWith('equipment/'));

  useEffect(() => {
    inventoryRef.current = inventory;
  }, [inventory]);

  useEffect(() => {
    const promises = Object.keys(positions).map((kind) => {
      const id = equipment[kind];
      const item = inventoryRef.current[mapKind(kind)]?.find((item) => item.id === id) || {};
      const loadKind = mapKind(kind);
      return loadSprite(
        loadKind,
        { ...item, kind },
        { offsetLeft, width, height },
        ...positions[kind]
      );
    });
    Promise.all(promises).then((sprites) => {
      const spritesByKind = Object.fromEntries(sprites.map((sprite) => {
        return [sprite.kind, sprite];
      }));
      setSprites(spritesByKind);
    });
  }, [equipment, positions, offsetLeft, width, height, mapKind, version]);

  // Flatten buffers into a single buffer per rarity
  useEffect(() => {
    const buffers = Array.from({ length: RARITY_COLORS.length }, () => ({
      fg: '#fff', buffer: [],
    }));
    RARITY_COLORS.forEach((color, i) => {
      buffers[i].fg = color;
      buffers[i].buffer = Array.from({ length: height }, () => Array(width).fill(''));
    });
    Object.values(sprites).forEach(function(sprite) {
      if (!sprite) return;
      sprite && sprite.buffer.forEach((line, y) => {
        line.forEach((char, x) => {
          if (char !== ' ') {
            buffers[sprite.rarity].buffer[y][x] = char;
          }
        });
      });
    });
    setLayers(buffers);
  }, [sprites]);

  return {
    sprites,
    layers,
  };
}
