import { useState, useEffect } from 'react';

function inViewport(y, x, bump, h, w) {
  const [by, bx] = bump;
  return (
    by >= 0 && bx >= 0
    && parseInt(by / h) === parseInt(y / h)
    && parseInt(bx / w) === parseInt(x / w)
  );
}

export default function useInteraction({
  x, y, w, h,
  bump, walls, layers, interactions,
  marker='▒', emptyMarker='⬚',
}) {
  const [interaction, setInteraction] = useState(null);
  const [interactionBuffer, setInteractionBuffer] = useState([[]]);

  useEffect(() => {
    const buffer = Array.from({ length: h }, () => Array.from({ length: w }, () => ''));
    let foundInteraction = null;
    if (bump) {
      const [by, bx] = bump;
      if (!inViewport(y, x, bump, h, w)) return;

      const lbx = bx % w;
      const lby = by % h;

      let interaction = interactions[`${by + 1},${bx + 1}`];
      buffer[lby][lbx] = interaction ? marker : emptyMarker;
      if (interaction) {
        foundInteraction = interaction;
      } else {
        // Nothing solid here means whatever was bumped has moved away (an NPC
        // on patrol), so there's no longer a target.
        const sprite = layers.solid[lby]?.[lbx];
        if (sprite && interactions[sprite]?.short) {
          // Reach one space farther to see if something is on the other side.
          const xDiff = bx - x;
          const yDiff = by - y;
          if (inViewport(y, x, [by + yDiff, bx + xDiff], h, w)) {
            interaction = interactions[`${by + yDiff + 1},${bx + xDiff + 1}`];
            if (interaction) {
              foundInteraction = interaction;
              buffer[lby + yDiff][lbx + xDiff] = marker;
            }
          }
        }

        if (!foundInteraction && sprite) {
          foundInteraction = {
            sprite,
            coordinates: [by, bx],
            ...interactions[sprite],
          }
        }
      }
    }
    setInteraction(foundInteraction);
    setInteractionBuffer(buffer);
  }, [bump, interactions]);

  return {
    interaction,
    interactionBuffer,
  };
}
