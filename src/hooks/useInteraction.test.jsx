// @vitest-environment jsdom
//
// Drives useInteraction as DisplayWorld does: a bump, the interactions on the
// page, and the terrain layers, re-rendered as the world changes.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import useInteraction from './useInteraction';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const [W, H] = [16, 8];
const blank = () => Array.from({ length: H }, () => Array(W).fill(''));
const bard = { type: 'npc', name: 'Bard', coordinates: [21, 38], sprite: 'β' };

let root, result;

function Probe(props) {
  result = useInteraction({ w: W, h: H, ...props });
  return null;
}
const render = (props) => act(() => root.render(<Probe {...props} />));

beforeEach(() => {
  root = createRoot(document.createElement('div'));
});
afterEach(() => act(() => root.unmount()));

describe('useInteraction', () => {
  // Player at 0-based [20, 38], bumping left into the Bard at [20, 37] (1-based 21,38).
  const bump = [20, 37];
  const at = { x: 38, y: 20 };

  it('targets what was bumped', () => {
    render({ ...at, bump, walls: {}, layers: { solid: blank() }, interactions: { '21,38': bard } });
    expect(result.interaction).toBe(bard);
  });

  it('lets go, instead of crashing, when the bumped NPC walks away', () => {
    render({ ...at, bump, walls: {}, layers: { solid: blank() }, interactions: { '21,38': bard } });
    // The Bard patrols on (Wait): the bumped cell is now empty floor.
    render({ ...at, bump, walls: {}, layers: { solid: blank() }, interactions: { '22,38': bard } });
    expect(result.interaction).toBeNull();
  });

  it('targets a wall by its glyph', () => {
    const solid = blank();
    solid[20 % H][37 % W] = '█';
    const interactions = { '█': { label: 'wall', incidental: true } };
    render({ ...at, bump, walls: { '█': {} }, layers: { solid }, interactions });
    expect(result.interaction).toMatchObject({ sprite: '█', label: 'wall', coordinates: [20, 37] });
  });
});
