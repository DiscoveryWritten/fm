# FM developer docs

Notes written on a return visit to the codebase, 2026-09. Everything here was
checked against the code as of `f817dd3` (the salvage merge). Where a claim was
confirmed by running the app in a browser, it says so.

| Doc | What it answers |
| -- | -- |
| [architecture.md](architecture.md) | How the app boots, how the three displays draw, how state and saves work, the full event catalog |
| [file-formats.md](file-formats.md) | The exact grammar of every hand-edited text file under `public/`, including the gotchas the regexes impose |
| [weather-zones.md](weather-zones.md) | How overlay zones are loaded, chosen, rolled and drawn, and why nesting order is not reliably honored |
| [known-issues.md](known-issues.md) | Everything found broken or fragile, ranked, with evidence |
| [deployment.md](deployment.md) | What it takes to host the build on Cloudflare Pages and later cache it offline |

## One-screen mental model

- **Static SPA, no backend.** Vite + React 18. `yarn build` produces `dist/`,
  which is `index.html`, one JS bundle, and a verbatim copy of `public/`.
- **The game is data.** At runtime the app `fetch()`es plain text from
  `public/world`, `public/overlays`, `public/interactions` and
  `public/equipment`, parses it with regexes, and never writes it back.
- **Three independent "calculator screens"** (status, world, menu), each with
  its own keymap, are drawn as stacks of transparent character grids. See
  [architecture.md § Rendering](architecture.md#rendering-the-buffer-stack).
- **`window` is the message bus.** Almost every game action is a
  `CustomEvent` dispatched on `window` and caught by whichever hook cares.
  Anything that can dispatch an event (including the DevTools console) can
  drive the game.
- **State is `useState` plus localStorage.** Every hook that wants
  persistence calls `useSave({...})`, which listens for `Save` and `load`
  events and reads/writes `localStorage["<slot>/<key>"]`.
- **The ML classifier is dormant.** `src/worker.js` plus a 26 MB ONNX model are
  in the repo and the build, but `useAnalyzer` is commented out in `App.jsx`.
