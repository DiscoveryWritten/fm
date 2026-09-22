import { loadZones, zoneAt, rollWeather } from '../zones';

export default function register({ describe, it, expect }) {
  const SIZE = [37, 80];

  function spec(dataFile, boxes=[], attributes={}) {
    return { type: 'zone', dataFile, boxes, attributes, directions: [[0, 0]] };
  }

  // A fake fetch whose responses resolve after the given delays, so tests can
  // control which overlay arrives first.
  function fetchWithDelays(delays) {
    return (dataFile) => new Promise((resolve) => {
      setTimeout(() => resolve(`${dataFile} art\n`), delays[dataFile] ?? 0);
    });
  }

  describe('loadZones', () => {
    it('keeps declaration order even when fetches finish out of order', async () => {
      const specs = [
        spec('rain.txt'),
        spec('clouds.txt'),
        spec('dust.txt', [[19, 37, 23, 44]]),
      ];
      // The global weather arrives last, as it can from a CDN.
      const zones = await loadZones(specs, SIZE, fetchWithDelays({
        'rain.txt': 30, 'clouds.txt': 20, 'dust.txt': 0,
      }));
      expect(zones.map((z) => z.dataFile)).toEqual(['rain.txt', 'clouds.txt', 'dust.txt']);
    });

    it('gives a spec without boxes the whole map', async () => {
      const [zone] = await loadZones([spec('rain.txt')], SIZE, fetchWithDelays({}));
      expect(zone.box).toEqual([1, 1, 37, 80]);
    });

    it('makes one zone per box, in box order', async () => {
      const zones = await loadZones(
        [spec('dust.txt', [[1, 1, 2, 2], [5, 5, 6, 6]])], SIZE, fetchWithDelays({}),
      );
      expect(zones.map((z) => z.box)).toEqual([[1, 1, 2, 2], [5, 5, 6, 6]]);
    });

    it('splits the art into rows and measures the widest', async () => {
      const fetchOverlay = async () => 'ab\nabcd\n\n\n';
      const [zone] = await loadZones([spec('x.txt')], SIZE, fetchOverlay);
      expect(zone.buffer).toEqual(['ab', 'abcd']);
      expect(zone.maxWidth).toBe(4);
    });
  });

  describe('zoneAt', () => {
    const rain = { dataFile: 'rain.txt', box: [1, 1, 37, 80] };
    const dust = { dataFile: 'dust.txt', box: [19, 37, 23, 44] };

    it('lets a later, smaller zone override the global one', () => {
      expect(zoneAt([rain, dust], 21, 38)).toBe(dust);
    });

    it('falls back to the global zone outside the interior', () => {
      expect(zoneAt([rain, dust], 0, 0)).toBe(rain);
    });

    it('is decided by declaration order, not size', () => {
      // Declared small-then-large, the large zone wins everywhere.
      expect(zoneAt([dust, rain], 21, 38)).toBe(rain);
    });

    it('treats box edges as inside (1-based, inclusive)', () => {
      // Box rows 19..23 and cols 37..44 are 0-based 18..22 and 36..43.
      expect(zoneAt([dust], 18, 36)).toBe(dust);
      expect(zoneAt([dust], 22, 43)).toBe(dust);
      expect(zoneAt([dust], 17, 36)).toBe(null);
      expect(zoneAt([dust], 22, 44)).toBe(null);
    });
  });

  describe('rollWeather', () => {
    const rain = { dataFile: 'rain.txt', attributes: { fg: 'fff8', '100-100': 'clouds.txt' } };
    const clouds = { dataFile: 'clouds.txt', attributes: { '100-100': 'rain.txt' } };
    const zones = [rain, clouds];
    const roll = (n, max=100) => () => (n - 1) / max;  // random() that rolls exactly n

    it('switches only when the roll lands in a range', () => {
      expect(rollWeather(rain, zones, roll(100))).toBe(clouds);
      expect(rollWeather(rain, zones, roll(99))).toBe(null);
    });

    it('rolls up to the largest max across ranges', () => {
      const zone = { attributes: { '1-3': 'rain.txt', '4-10': 'clouds.txt' } };
      expect(rollWeather(zone, zones, roll(3, 10))).toBe(rain);
      expect(rollWeather(zone, zones, roll(4, 10))).toBe(clouds);
      expect(rollWeather(zone, zones, roll(10, 10))).toBe(clouds);
    });

    it('ignores attributes that are not ranges', () => {
      expect(rollWeather({ attributes: { fg: '888' } }, zones, roll(1))).toBe(null);
      expect(rollWeather(null, zones, roll(1))).toBe(null);
    });
  });
}
