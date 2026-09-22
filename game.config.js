// Which game this build is for.  A game is a folder of text files with a
// game.txt at its root; it can live in this repo or be a git submodule.
//
//   GAME=games/fm yarn build     (the default)
//   GAME=../my-game yarn dev     (any folder, relative to this repo)
import { readdirSync, statSync } from 'fs';
import { join, relative, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));

export const GAME_DIR = resolve(ROOT, process.env.GAME || 'games/fm');

// Every file in the game, as paths relative to its folder.  Dotfiles are
// skipped (a submodule has a .git file at its root).
export function gameFiles(dir=GAME_DIR) {
  const walk = (path) => readdirSync(path).flatMap((name) => {
    if (name.startsWith('.')) return [];
    const full = join(path, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
  return walk(dir).map((path) => relative(dir, path).split('\\').join('/')).sort();
}
