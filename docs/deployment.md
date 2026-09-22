# Deployment

## Current setup

- `.github/workflows/jekyll-gh-pages.yml` builds on pushes to `main` and
  publishes `dist/` to GitHub Pages. It checks out submodules, for games
  mounted from their own repos (see [games.md](games.md)).
- `public/CNAME` pins the custom domain `fm.discoverywritten.com`.
- `vite.config.js` sets `base: '/'`.

## Cloudflare Pages

Build settings:

| Setting | Value |
| -- | -- |
| Build command | `yarn build` |
| Output directory | `dist` |
| Node | 20 or later (verified locally with 22) |

Things that matter:

1. **Remove the ONNX model from the output.** At 25.7 MiB it's over the
   25 MiB per-file limit, so the upload will fail as-is. It's unused at
   runtime, so the simplest fix is to move `public/models/` out of `public/`
   until the classifier comes back. When it does, host it on R2 or load it
   from the Hugging Face CDN (`env.allowLocalModels = false`) instead of
   bundling it.
2. **Hostname vs path mounting.** Assets and game files are served from the
   site root (`/assets/…`, `/game/…`), because `base: '/'`.
   - Mounted at the root of a hostname (e.g. a deep subdomain): works as-is.
   - Mounted under a path like `/state/city/fm/`: set `base` to that path.
     Game files follow automatically, because `gameUrl()` builds on
     `import.meta.env.BASE_URL`.
   - One game per deploy: build with `GAME=<folder>` (see
     [games.md](games.md)).
3. **`public/CNAME`** is harmless on Cloudflare (it's served as a static
   file), but it's GitHub-Pages-specific. Leave it or drop it depending on
   whether GitHub Pages stays live.
4. **Filenames with spaces** (`Terra Montans.txt`) are fetched URL-encoded
   (`%20`). Cloudflare serves them fine.

## Self-test page

The build has a second page, `dist/tests/index.html`, served at `/tests/`. It
runs the portable checks against the deployed text files (see
[testing.md](testing.md)). It's about 22 KB, and the game never loads it.

## Offline (service worker) groundwork

There's no service worker yet. Notes for building one:

- **Everything the game needs is static:** `index.html`, `assets/*`, the
  font, and the game under `game/`. None of these fetches carry credentials.
- **The file list exists:** `virtual:content-manifest` (a plugin in
  `vite.config.js`) lists every game text file. The `/tests/` page already
  uses it, and a service worker can precache from it.
- **One seam for every game file:** `readText()` in `src/content.js`, with
  its list of sources. An offline copy can be a source in front of the
  network, instead of intercepting fetches in a service worker.
- **Leave the model out of the precache.** When it returns, use a separate
  on-demand cache.
- **Keep text files network-first or stale-while-revalidate.** (The network
  source already asks with `cache: 'no-cache'`, so the browser revalidates
  each file.) The authoring
  loop is "edit a text file, reload", and cache-first would make edits look
  like they didn't take.
