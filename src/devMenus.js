// The DEV screen's menus, built from state as plain data.  An item either
// opens another menu (`open`: a frame) or dispatches an event (`event` and
// `detail`), the same events the game already speaks: `destination` to go
// somewhere, `load` to go back to the last save, and the Dev.* events.
//
// state: {
//   devMode,  // saves paused, edits live
//   files,    // every game file path: the deployed ones and local-only edits
//   edited,   // paths with a local edit
//   touched,  // the last World.touch: { world, row, col, glyph, files }
//   start,    // { world, row, col }: where the game begins
//   palette,  // what the world on screen can be painted with: [{ glyph, label }]
//   brush,    // the glyph a tap paints, or null
//   undos,    // how many paints can be undone
// }

const basename = (path) => path.split('/').pop();
// Nearly every game file is .txt; the menu is only 14 columns wide.
const short = (path) => path.replace(/\.txt$/, '');

// Folders and files directly inside `prefix` ('' for the top).
export function folderEntries(files, prefix) {
  const folders = new Set();
  const inside = [];
  files.filter((path) => path.startsWith(prefix)).forEach((path) => {
    const rest = path.slice(prefix.length);
    const slash = rest.indexOf('/');
    if (slash < 0) inside.push(path);
    else folders.add(rest.slice(0, slash + 1));
  });
  return { folders: [...folders].sort(), files: inside.sort() };
}

const editItem = (path, edited, label=basename(path)) => ({
  name: `${edited.includes(path) ? '*' : ''}${short(label)}`,
  event: 'Dev.open',
  detail: { path },
});

export default function devMenu(frame, state) {
  const { devMode, files, edited, touched, start, palette=[], brush=null, undos=0 } = state;

  switch (frame.id) {
    case 'folder': {
      const { folders, files: inside } = folderEntries(files, frame.prefix);
      return {
        title: frame.prefix ? `${frame.prefix.split('/').slice(-2).join('/')}` : 'FILES',  // its own name: a deep path won't fit
        items: [
          ...folders.map((folder) => ({
            name: folder, open: { id: 'folder', prefix: frame.prefix + folder },
          })),
          ...inside.map((path) => editItem(path, edited)),
        ],
      };
    }

    case 'edited':
      return {
        title: 'EDITED',
        items: edited.map((path) => editItem(path, edited, path)),
      };

    case 'here': {
      const { world, row, col, glyph, files: here } = touched;
      return {
        title: `${glyph || ' '} ${row},${col}`,
        items: [
          ...here.map(({ path, label }) => editItem(path, edited, label)),
          { name: 'Jump here', event: 'destination', detail: {
            destination: [row, col], dataFile: world,
          }},
        ],
      };
    }

    case 'paint':
      return {
        title: brush === null ? 'PAINT' : `PAINT ${brush}`,
        // Always the same rows, so nothing moves under the cursor.
        items: [
          { name: 'Stop painting', event: 'Dev.brush', detail: { glyph: null } },
          { name: `Undo:${undos}`, event: 'Dev.undo' },
          ...palette.map(({ glyph, label }) => ({
            name: `${glyph === brush ? '>' : ' '}${glyph} ${label}`,
            event: 'Dev.brush',
            detail: { glyph },
          })),
        ],
      };

    default:
      return {
        title: 'DEV',
        items: [
          { name: `Dev mode:${devMode ? 'ON' : 'off'}`, event: 'Dev.mode.set', detail: { on: !devMode } },
          touched
            ? { name: `Here ${touched.row},${touched.col}`, open: { id: 'here' } }
            : { name: 'Here:tap map' },
          { name: `Paint:${brush === null ? 'off' : brush}`, open: { id: 'paint' } },
          { name: 'Files', open: { id: 'folder', prefix: '' } },
          { name: `Edited:${edited.length}`, open: { id: 'edited' } },
          { name: 'Import files', event: 'Dev.import' },
          { name: 'Last save', event: 'load', detail: {} },
          { name: 'Go to start', event: 'destination', detail: {
            destination: [start.row, start.col], dataFile: start.world,
          }},
        ],
      };
  }
}

// Where an imported file belongs: its path inside a picked game folder, or
// the one known file with its name, or else a new file at that name.
export function importPath(file, known) {
  const relative = (file.webkitRelativePath || '').split('/').slice(1).join('/');
  if (relative && known.includes(relative)) return relative;
  const named = known.filter((path) => basename(path) === file.name);
  if (named.length === 1) return named[0];
  return relative || file.name;
}
