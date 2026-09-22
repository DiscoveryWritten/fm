import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readdirSync, statSync } from 'fs'
import { join, relative, resolve } from 'path'

// Text trees under public/ that make up a game.
const CONTENT_DIRS = ['world', 'overlays', 'interactions', 'equipment'];

// `import files from 'virtual:content-manifest'` lists every game text file,
// relative to public/.  A static host can't list directories, so this is how
// the in-browser checks (and later, offline caching) know what exists.
function contentManifest() {
  const id = 'virtual:content-manifest';
  const resolvedId = '\0' + id;
  const publicDir = resolve(__dirname, 'public');
  const walk = (dir) => readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

  return {
    name: 'content-manifest',
    resolveId: (source) => source === id ? resolvedId : null,
    load(loadId) {
      if (loadId !== resolvedId) return null;
      const files = CONTENT_DIRS
        .flatMap((dir) => walk(join(publicDir, dir)))
        .filter((path) => path.endsWith('.txt'))
        .map((path) => relative(publicDir, path).split('\\').join('/'))
        .sort();
      return `export default ${JSON.stringify(files)};`;
    },
    configureServer(server) {
      const refresh = (path) => {
        if (!path.startsWith(publicDir)) return;
        const mod = server.moduleGraph.getModuleById(resolvedId);
        if (mod) server.moduleGraph.invalidateModule(mod);
      };
      server.watcher.on('add', refresh);
      server.watcher.on('unlink', refresh);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      jsxImportSource: '@welldone-software/why-did-you-render',
    }),
    contentManifest(),
  ],
  base: '/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        tests: resolve(__dirname, 'tests/index.html'),
      },
    },
  },
  test: {
    environment: 'node',
  },
})
