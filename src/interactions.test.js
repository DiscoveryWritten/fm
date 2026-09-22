import { describe, it, expect } from 'vitest';

import { classifyObjectSpec, parseInteraction, TYPES } from './interactions';

describe('classifyObjectSpec', () => {
  it('reads a sprite with a short label and actions', () => {
    const spec = classifyObjectSpec(
      '⌸:~bed#Climb=You shamble onto the bed.#Sleep{quality:120}=You lie down.'
    );
    expect(spec).toMatchObject({
      type: TYPES.SPRITE,
      sprite: '⌸',
      label: '~bed',
      attributes: {
        Climb: 'You shamble onto the bed.',
        'Sleep{quality:120}': 'You lie down.',
      },
    });
  });

  it('reads a global zone with directions and weather rolls', () => {
    const spec = classifyObjectSpec('rain.txt@v2:#fg=fff8#100-100=clouds.txt');
    expect(spec).toMatchObject({
      type: TYPES.ZONE,
      dataFile: 'rain.txt',
      boxes: [],
      directions: [[2, 0]],
      attributes: { fg: 'fff8', '100-100': 'clouds.txt' },
    });
  });

  it('reads zone boxes', () => {
    const spec = classifyObjectSpec('dust.txt@v1^1:[19,37,23,44];[1,2,3,4]#fg=8888');
    expect(spec.boxes).toEqual([[19, 37, 23, 44], [1, 2, 3, 4]]);
    expect(spec.directions).toEqual([[1, 0], [-1, 0]]);
  });

  it('reads a world door', () => {
    expect(classifyObjectSpec('(22,36)=(1,1):Debugger/debug.txt')).toMatchObject({
      type: TYPES.WORLD, coordinates: [22, 36], destination: [1, 1], dataFile: 'debug.txt',
    });
  });

  it('reads an NPC with attributes', () => {
    expect(classifyObjectSpec('(21,38):Bard/bard.txt#idle=v1>1^1<1')).toMatchObject({
      type: TYPES.NPC, coordinates: [21, 38], label: 'Bard', dataFile: 'bard.txt',
      attributes: { idle: 'v1>1^1<1' },
    });
  });

  it('reads a locked door', () => {
    expect(classifyObjectSpec('(23,38)=(25,36):Room 1#key=Bat-shaped key#text=Locked.'))
      .toMatchObject({
        type: TYPES.DOOR, coordinates: [23, 38], destination: [25, 36], label: 'Room 1',
        attributes: { key: 'Bat-shaped key', text: 'Locked.' },
      });
  });

  it('rejects file names outside \\w+ (spaces, hyphens)', () => {
    expect(() => classifyObjectSpec('(1,1)=(2,2):Canopy/High Canopy.txt')).toThrow();
    expect(() => classifyObjectSpec('my-rain.txt@v1:#fg=fff')).toThrow();
  });

  it('requires zone directions', () => {
    expect(() => classifyObjectSpec('rain.txt@:#fg=fff')).toThrow();
  });
});

describe('parseInteraction', () => {
  const context = { name: 'Hero', possesses: () => false };

  it('splits an NPC file into named sections and renders templates', () => {
    const npc = classifyObjectSpec('(1,1):Bard/bard.txt');
    const text = 'Look\nA bard.\n---\nSave\n"Forever, ${name}."';
    const parsed = parseInteraction(npc, text, context);
    expect(parsed.name).toBe('Bard');
    expect(parsed.Look).toEqual({ name: 'Look', text: 'A bard.' });
    expect(parsed.Save).toMatchObject({ name: 'Save', text: '"Forever, Hero."', event: 'Save' });
  });

  it('hides ?reaction sections under their plain name', () => {
    const npc = classifyObjectSpec('(1,1):Shopkeeper/jacynthe.txt');
    const parsed = parseInteraction(npc, '?Shout\nQuiet!', context);
    expect(parsed.Shout).toMatchObject({ name: 'Shout', hidden: true, text: 'Quiet!' });
    expect(parsed['?Shout']).toBeUndefined();
  });

  it('builds a Buy menu that hides items you own', () => {
    const npc = classifyObjectSpec('(1,1):Shopkeeper/jacynthe.txt');
    const parsed = parseInteraction(npc, 'Buy\nweapon/sword/0/Sword/4\nweapon/whip/0/Whip/3', context);
    const [weapons] = parsed.Buy.items({ inventory: {} });
    expect(weapons.items({ inventory: { weapon: [{ name: 'Sword' }] } }).map((i) => i.name))
      .toEqual(['Whip']);
  });

  it('opens an unlocked door and refuses a locked one', () => {
    const door = classifyObjectSpec('(1,1)=(2,2):Room#key=Key#text=Need a ${key}.');
    expect(parseInteraction(door, '', { possesses: () => true }).Open)
      .toMatchObject({ event: 'destination', destination: [2, 2] });
    // The locked text stays a template; DisplayMenu renders it with the
    // door's attributes when it's shown.
    expect(parseInteraction(door, '', { possesses: () => false }).Open)
      .toEqual({ name: 'Open', text: 'Need a ${key}.' });
  });

  it('turns capitalized sprite attributes into player actions', () => {
    const bed = classifyObjectSpec('⌸:~bed#Sleep{quality:120}=Zzz.#color=red');
    const parsed = parseInteraction(bed, '', context);
    expect(parsed).toMatchObject({ label: 'bed', short: true, incidental: true });
    expect(parsed.Sleep).toEqual({ name: 'Sleep', text: 'Zzz.', event: 'Sleep.player', quality: 120 });
    expect(parsed.color).toBeUndefined();
  });
});
