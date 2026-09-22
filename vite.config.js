import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, existsSync, statSync } from 'fs'
import { join, resolve } from 'path'

import { GAME_DIR, gameFiles } from './game.config.js'

// The game's folder is served at /game/: from disk under `yarn dev`, and
// copied into dist/game/ by `yarn build`.  `import files from
// 'virtual:content-manifest'` lists its files, since a static host can't list
// directories (the /tests/ page uses it, and offline caching will).
function game() {
  const id = 'virtual:content-manifest';
  const resolvedId = '\0' + id;

  return {
    name: 'game',
    resolveId: (source) => source === id ? resolvedId : null,
    load(loadId) {
      if (loadId !== resolvedId) return null;
      return `export default ${JSON.stringify(gameFiles())};`;
    },
    configureServer(server) {
      server.watcher.add(GAME_DIR);
      const refresh = (path) => {
        if (!path.startsWith(GAME_DIR)) return;
        const mod = server.moduleGraph.getModuleById(resolvedId);
        if (mod) server.moduleGraph.invalidateModule(mod);
      };
      server.watcher.on('add', refresh);
      server.watcher.on('unlink', refresh);

      server.middlewares.use('/game/', (req, res, next) => {
        const path = decodeURIComponent(req.url.split('?')[0]);
        const file = join(GAME_DIR, path);
        if (!file.startsWith(GAME_DIR) || !existsSync(file) || !statSync(file).isFile()) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(readFileSync(file));
      });
    },
    generateBundle() {
      gameFiles().forEach((file) => this.emitFile({
        type: 'asset',
        fileName: `game/${file}`,
        source: readFileSync(join(GAME_DIR, file)),
      }));
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      jsxImportSource: '@welldone-software/why-did-you-render',
    }),
    game(),
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
