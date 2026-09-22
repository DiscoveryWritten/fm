import { describe, it, expect } from 'vitest';

import {
  bufferize, bufferizeList, parseDirectionsList, price, minifyNumbers,
  groupEquipment, renderTemplate,
} from './utils';

describe('parseDirectionsList', () => {
  it('turns direction steps into [dy, dx] pairs', () => {
    expect(parseDirectionsList('v1>2^3<4')).toEqual([[1, 0], [0, 2], [-3, 0], [0, -4]]);
  });

  it('keeps multi-digit and zero steps', () => {
    expect(parseDirectionsList('>0v12')).toEqual([[0, 0], [12, 0]]);
  });
});

describe('bufferize', () => {
  it('word-wraps text to the width', () => {
    expect(bufferize(0, 'the bard plucks slowly', 10, 8, 0))
      .toEqual(['the bard', 'plucks', 'slowly']);
  });

  it('reserves blank rows at the top for the menu titles', () => {
    expect(bufferize(2, 'a b', 10, 8, 0)).toEqual(['', '', 'a b']);
  });

  it('scrolls by whole lines and fits the height below the margin', () => {
    const text = 'one two three four five';
    expect(bufferize(1, text, 5, 3, 1)).toEqual(['', 'two', 'three']);
  });
});

describe('bufferizeList', () => {
  it('pages a list the same way, without wrapping', () => {
    expect(bufferizeList(1, ['a', 'b', 'c', 'd'], 5, 3, 1)).toEqual(['', 'b', 'c']);
  });
});

describe('price', () => {
  it('is (rarity + 1) * (stat total + 1)', () => {
    expect(price({ rarity: 2, stats: { A: 3 } })).toBe(12);
    expect(price({})).toBe(1);
  });
});

describe('minifyNumbers', () => {
  it('swaps digits for subscript glyphs', () => {
    expect(minifyNumbers('Atk 12')).toBe('Atk ₁₂');
    expect(minifyNumbers(7)).toBe('₇');
  });
});

describe('groupEquipment', () => {
  const lines = [
    'body/tunic/0/Tunic/1',
    'weapon/sword/1/Sword/4',
    'weapon/whip/0/Whip/3/7',
  ].join('\n');

  it('groups lines by kind in equipment order', () => {
    const groups = groupEquipment(lines);
    expect(groups.map((g) => [g.kind, g.name])).toEqual([
      ['weapon', 'Weapons'],
      ['body', 'Body armor'],
    ]);
  });

  it('gives weapons attack and everything else defence, priced as a cost', () => {
    const [weapons, body] = groupEquipment(lines);
    expect(weapons.items[0]).toMatchObject({ name: 'Sword', stats: { A: 4 }, price: -10 });
    expect(body.items[0]).toMatchObject({ name: 'Tunic', stats: { D: 1 }, price: -2 });
  });

  it('reads an optional id', () => {
    const [weapons] = groupEquipment(lines);
    expect(weapons.items.map((i) => i.item.id)).toEqual([null, 7]);
  });

  it('omits items already owned, by name', () => {
    const groups = groupEquipment(lines, { weapon: [{ name: 'Sword' }] });
    expect(groups[0].items.map((i) => i.name)).toEqual(['Whip']);
  });

  it('merges extra fields into every entry', () => {
    const [weapons] = groupEquipment(lines, {}, { event: 'Buy.player' });
    expect(weapons.items.every((i) => i.event === 'Buy.player')).toBe(true);
  });
});

describe('renderTemplate', () => {
  it('evaluates ${} against the data', () => {
    expect(renderTemplate('Hi ${name}, need a ${key}?', { name: 'Hero', key: 'Bat-shaped key' }))
      .toBe('Hi Hero, need a Bat-shaped key?');
  });

  it('ignores {parameters} on data keys', () => {
    expect(renderTemplate('${Sleep}', { 'Sleep{quality:1}': 'zzz' })).toBe('zzz');
  });
});
