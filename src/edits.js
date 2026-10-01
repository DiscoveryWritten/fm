// Local edits to game files: the creator's own copies, kept in the browser
// in front of the deployed game (see content.js).  The deployed files are the
// clean defaults; an edit masks one until it's reverted.
//
// Edits are not game state.  A save never touches them, and they survive
// starting over.  Each change dispatches `Content.changed` with its path, so
// whatever showed that file can read it again without a restart.
//
// A value is a file's text, or a Blob for anything too big or too binary to
// hold as a string (read back as text by readText).

export function createEdits(backend) {
  const edits = new Map();

  const changed = (path) => {
    window.dispatchEvent(new CustomEvent('Content.changed', { detail: { path } }));
  };

  return {
    // Load what was kept from last time.  Call once, before the game starts.
    async load() {
      (await backend.all()).forEach(([path, value]) => edits.set(path, value));
    },

    // The content source: the edited copy, or null to fall through.
    source: {
      name: 'edits',
      async read(path) {
        if (!edits.has(path)) return null;
        const value = edits.get(path);
        return typeof value === 'string' ? value : value.text();
      },
    },

    has: (path) => edits.has(path),
    paths: () => [...edits.keys()].sort(),
    get: (path) => edits.get(path),

    async save(path, value) {
      edits.set(path, value);
      await backend.put(path, value);
      changed(path);
    },

    async revert(path) {
      if (!edits.delete(path)) return;
      await backend.remove(path);
      changed(path);
    },
  };
}

// Keeps nothing past the page; for tests, and when IndexedDB is unavailable.
export function memoryBackend() {
  const kept = new Map();
  return {
    all: async () => [...kept.entries()],
    put: async (path, value) => { kept.set(path, value); },
    remove: async (path) => { kept.delete(path); },
  };
}

// IndexedDB holds far more than localStorage, and holds Blobs as they are.
export function indexedDBBackend(name='fm-edits') {
  const STORE = 'files';
  const db = new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const run = (mode, work) => db.then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const result = work(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  }));
  return {
    all: () => run('readonly', (store) => {
      const entries = [];
      store.openCursor().onsuccess = ({ target: { result: cursor } }) => {
        if (!cursor) return;
        entries.push([cursor.key, cursor.value]);
        cursor.continue();
      };
      return entries;
    }),
    put: (path, value) => run('readwrite', (store) => { store.put(value, path); }),
    remove: (path) => run('readwrite', (store) => { store.delete(path); }),
  };
}

// The game's edits.  main.jsx loads them and puts them in front of the network.
export const edits = createEdits(
  typeof indexedDB === 'undefined' ? memoryBackend() : indexedDBBackend()
);
