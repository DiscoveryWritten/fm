// Every game file the engine reads comes through here.  A game file is a path
// inside the game's folder, like "world/Terra Montans.txt"; the build serves
// the game at /game/ (see game.config.js).
//
// Sources are asked in order, and the first one that has the file wins.  The
// network (the game as deployed) is always last, so a store of local copies
// or edits can sit in front of it with addSource() and fall back to the
// deployed game for anything it doesn't have.

export function gameUrl(path) {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${import.meta.env.BASE_URL}game/${encoded}`;
}

const network = {
  name: 'network',
  async read(path) {
    const res = await fetch(gameUrl(path), { cache: 'no-cache' });
    return res.ok ? res.text() : null;
  },
};

const sources = [network];

// Put a source in front of the others.  A source is { name, read(path) },
// where read resolves to the file's text, or null if it doesn't have it.
// Returns a function that removes it again.
export function addSource(source) {
  sources.unshift(source);
  return () => {
    const index = sources.indexOf(source);
    if (index >= 0) sources.splice(index, 1);
  };
}

export async function readText(path) {
  for (const source of sources) {
    const text = await source.read(path);
    if (text !== null && text !== undefined) return text;
  }
  throw new Error(`Game file not found: ${path}`);
}
