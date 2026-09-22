// Checks every shipped text file the way the engine will read it, so an
// authoring mistake fails here instead of silently vanishing in game.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

import { classifyObjectSpec, TYPES } from './interactions';

const PUBLIC = join(__dirname, '..', 'public');
const read = (...parts) => readFileSync(join(PUBLIC, ...parts), 'utf8');
const exists = (...parts) => existsSync(join(PUBLIC, ...parts));

// World files with no object section (pure art).
const ART_ONLY = ['debug.txt'];

const worlds = readdirSync(join(PUBLIC, 'world')).filter((f) => f.endsWith('.txt'));

describe.each(worlds.filter((w) => !ART_ONLY.includes(w)))('world/%s', (world) => {
  const sections = read('world', world).trim().split('---\n');
  const rows = sections[0].trim().split('\n');
  const lines = (sections[1] || '').split('\n').filter(Boolean);

  it('has exactly one --- separator (the loader ignores any further sections)', () => {
    expect(sections).toHaveLength(2);
  });

  it.each(lines)('parses: %s', (line) => {
    expect(() => classifyObjectSpec(line)).not.toThrow();
  });

  it('points at files that exist', () => {
    const missing = lines.map(classifyObjectSpec).flatMap(({ type, label, dataFile }) => {
      if (type === TYPES.ZONE && !exists('overlays', dataFile)) return [`overlays/${dataFile}`];
      if (type === TYPES.NPC && !exists('interactions', label, dataFile)) return [`interactions/${label}/${dataFile}`];
      if (type === TYPES.WORLD && !exists('world', dataFile)) return [`world/${dataFile}`];
      return [];
    });
    expect(missing).toEqual([]);
  });

  it('keeps coordinates and boxes on the map', () => {
    const off = (r, c) => r < 1 || c < 1 || r > rows.length || c > rows[r - 1].length;
    const bad = lines.map(classifyObjectSpec).flatMap((spec) => {
      const points = [
        spec.coordinates,
        spec.type === TYPES.DOOR ? spec.destination : null,
        ...(spec.boxes || []).flatMap(([r1, c1, r2, c2]) => [[r1, c1], [r2, c2]]),
      ].filter(Boolean);
      return points.filter(([r, c]) => off(r, c)).map((p) => `${spec.type} ${p}`);
    });
    expect(bad).toEqual([]);
  });
});

const npcFiles = readdirSync(join(PUBLIC, 'interactions')).flatMap((label) => (
  readdirSync(join(PUBLIC, 'interactions', label)).map((file) => [label, file])
));

describe.each(npcFiles)('interactions/%s/%s', (label, file) => {
  const sections = read('interactions', label, file).split('---').map((s) => s.trim());

  it('sells and equips only items whose sprites exist', () => {
    const lines = sections
      .filter((s) => /^(Buy|Fight)\n/.test(s))
      .flatMap((s) => s.split('\n').slice(1))
      .filter((line) => line.split('/').length >= 5);
    const missing = lines
      .map((line) => line.split('/'))
      .filter(([kind, template]) => !exists('equipment', kind, `${template}.txt`))
      .map(([kind, template]) => `equipment/${kind}/${template}.txt`);
    expect(missing).toEqual([]);
  });
});
