// A game's game.txt: what it's called and where it begins.  Sections use the
// same shape as NPC files, a name line then text, separated by ---:
//
//   Title
//   Freedom of Movement
//   ---
//   Start
//   Terra Montans.txt (20,22)
//   ---
//   Log
//   You wake up in a small room...
//   You've never been this tired before.
//
// Start is a world file and the 1-based (row,col) to spawn at.  Log lines are
// the opening log, oldest first, one entry per line.

const START = /^(?<world>.+\.txt)\s*\((?<row>\d+),(?<col>\d+)\)$/;

export function parseGame(text) {
  const sections = Object.fromEntries(text.split('---').map((section) => {
    const [name, ...lines] = section.trim().split('\n');
    return [name.trim(), lines.map((line) => line.trim()).filter(Boolean)];
  }));

  const [start=''] = sections.Start || [];
  const match = START.exec(start);
  if (!match) {
    throw new Error(`game.txt needs a Start line like "World.txt (row,col)", got "${start}"`);
  }
  const { world, row, col } = match.groups;
  return {
    title: (sections.Title || [])[0] || 'Untitled',
    world,
    start: [Number(row), Number(col)],
    log: [...(sections.Log || [])].reverse(),  // the game's log is newest first
  };
}
