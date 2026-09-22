// Checks every shipped text file the way the engine will read it, so an
// authoring mistake fails here instead of silently vanishing in game.
import { classifyObjectSpec, TYPES } from '../interactions';

// World files with no object section (pure art).
const ART_ONLY = ['world/debug.txt'];

export default function register({ describe, it, expect }, content) {
  const worlds = content.files.filter((f) => f.startsWith('world/') && !ART_ONLY.includes(f));

  worlds.forEach((world) => describe(world, () => {
    const sections = content.text[world].trim().split('---\n');
    const rows = sections[0].trim().split('\n');
    const lines = (sections[1] || '').split('\n').filter(Boolean);
    // Lines that parse; the others fail their own "parses" check below.
    const specs = lines.flatMap((line) => {
      try {
        return [classifyObjectSpec(line)];
      } catch {
        return [];
      }
    });

    it('has exactly one --- separator (the loader ignores any further sections)', () => {
      expect(sections).toHaveLength(2);
    });

    lines.forEach((line) => it(`parses: ${line}`, () => {
      expect(() => classifyObjectSpec(line)).not.toThrow();
    }));

    it('points at files that exist', () => {
      const missing = specs.flatMap(({ type, label, dataFile }) => {
        const file = {
          [TYPES.ZONE]: `overlays/${dataFile}`,
          [TYPES.NPC]: `interactions/${label}/${dataFile}`,
          [TYPES.WORLD]: `world/${dataFile}`,
        }[type];
        return file && !content.exists(file) ? [file] : [];
      });
      expect(missing).toEqual([]);
    });

    it('keeps coordinates and boxes on the map', () => {
      const off = (r, c) => r < 1 || c < 1 || r > rows.length || c > rows[r - 1].length;
      const bad = specs.flatMap((spec) => {
        const points = [
          spec.coordinates,
          spec.type === TYPES.DOOR ? spec.destination : null,
          ...(spec.boxes || []).flatMap(([r1, c1, r2, c2]) => [[r1, c1], [r2, c2]]),
        ].filter(Boolean);
        return points.filter(([r, c]) => off(r, c)).map((p) => `${spec.type} ${p}`);
      });
      expect(bad).toEqual([]);
    });
  }));

  const npcFiles = content.files.filter((f) => f.startsWith('interactions/'));

  npcFiles.forEach((file) => describe(file, () => {
    const sections = content.text[file].split('---').map((s) => s.trim());

    it('sells and equips only items whose sprites exist', () => {
      const missing = sections
        .filter((s) => /^(Buy|Fight)\n/.test(s))
        .flatMap((s) => s.split('\n').slice(1))
        .map((line) => line.split('/'))
        .filter((parts) => parts.length >= 5)
        .map(([kind, template]) => `equipment/${kind}/${template}.txt`)
        .filter((sprite) => !content.exists(sprite));
      expect(missing).toEqual([]);
    });
  }));
}
