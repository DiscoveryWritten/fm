// Overlay zones: loading them from a world's zone specs, finding the one the
// player is standing in, and rolling weather changes.
//
// Coordinates follow the world files: boxes are 1-based [r1, c1, r2, c2],
// inclusive at both ends.  Player positions are 0-based [y, x].

// Fetch each overlay's art and expand every spec into one zone per box.
// A spec without boxes covers the whole map.
//
// Declaration order matters (see zoneAt), so each spec *returns* its zones and
// Promise.all keeps them in spec order, however the fetches happen to finish.
export async function loadZones(boxGroups, size, fetchOverlay, onOverlay=() => {}) {
  const groups = await Promise.all(boxGroups.map(async (data) => {
    const { boxes, dataFile } = data;
    const overlay = await fetchOverlay(dataFile);
    onOverlay({ dataFile, overlay, ...data });
    const buffer = overlay.replace(/\n+$/, '').split('\n');
    const maxWidth = Math.max(...buffer.map((row) => row.length));
    return (boxes.length ? boxes : [[1, 1, ...size]]).map((box) => (
      { ...data, buffer, box, maxWidth }
    ));
  }));
  return groups.flat();
}

// The last declared zone containing the player wins, so small interior zones
// declared after the global weather take over while you're inside them.
export function zoneAt(zones, y, x) {
  let found = null;
  for (const zone of zones) {
    const [r, c, r2, c2] = zone.box.map((v) => v - 1);
    if (y >= r && y <= r2 && x >= c && x <= c2) {
      found = zone;
    }
  }
  return found;
}

// A zone's `#min-max=other.txt` attributes are weather rolls.  Roll an integer
// from 1 to the largest max; the first range containing it names the zone to
// switch to.  Returns that zone, or null to stay put.
export function rollWeather(zone, zones, random=Math.random) {
  const ranges = Object.entries(zone?.attributes || {}).map(([name, next]) => {
    const { min, max } = /(?<min>\d+)-(?<max>\d+)/.exec(name)?.groups || {};
    if (min === undefined) return false;
    return [Number(min), Number(max), next];
  }).filter(Boolean);
  if (!ranges.length) return null;

  const [, max] = ranges.reduce((a, b) => a[1] > b[1] ? a : b);
  const value = Math.floor(random() * max) + 1;
  const [,, next] = ranges.find(([min, max]) => value >= min && value <= max) || [];
  if (!next) return null;
  return zones.find(({ dataFile }) => dataFile === next) || null;
}
