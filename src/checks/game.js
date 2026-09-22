import { parseGame } from '../game';
import { addSource, readText } from '../content';

export default function register({ describe, it, expect }) {
  describe('parseGame', () => {
    const text = [
      'Title', 'A Small Game', '---',
      'Start', 'Somewhere Else.txt (3,14)', '---',
      'Log', 'First thing that happened.', 'Second thing.', '---',
      'Stats', 'A  attack  f55  gear', 'H  hearing  fd4',
    ].join('\n');

    it('reads the title, start world and 1-based spawn', () => {
      expect(parseGame(text)).toMatchObject({
        title: 'A Small Game', world: 'Somewhere Else.txt', start: [3, 14],
      });
    });

    it('keeps the opening log newest first, as the game shows it', () => {
      expect(parseGame(text).log).toEqual(['Second thing.', 'First thing that happened.']);
    });

    it('reads the declared stats', () => {
      expect(parseGame(text).stats).toEqual([
        { code: 'A', name: 'attack', color: '#f55', gear: true },
        { code: 'H', name: 'hearing', color: '#fd4', gear: false },
      ]);
    });

    it('needs a start line', () => {
      expect(() => parseGame('Title\nNo start')).toThrow();
      expect(() => parseGame('Start\nnowhere')).toThrow();
    });
  });

  describe('content sources', () => {
    const fake = (name, files) => ({ name, read: async (path) => files[path] ?? null });

    it('asks the newest source first and falls through to older ones', async () => {
      const removeBase = addSource(fake('base', { 'a.txt': 'base a', 'b.txt': 'base b' }));
      const removeEdits = addSource(fake('edits', { 'a.txt': 'edited a' }));
      try {
        expect(await readText('a.txt')).toBe('edited a');
        expect(await readText('b.txt')).toBe('base b');
      } finally {
        removeEdits();
        removeBase();
      }
    });

    it('stops using a source once it is removed', async () => {
      const remove = addSource(fake('base', { 'a.txt': 'base a' }));
      const removeEdits = addSource(fake('edits', { 'a.txt': 'edited a' }));
      removeEdits();
      try {
        expect(await readText('a.txt')).toBe('base a');
      } finally {
        remove();
      }
    });
  });
}
