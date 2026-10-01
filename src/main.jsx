import './wdyr';
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { readText, addSource } from './content'
import { edits } from './edits'
import { parseGame } from './game'
import './index.css'

const root = document.getElementById('root');

// The creator's local edits sit in front of the deployed game.  If they
// can't be read (a private window), the game still starts without them.
edits.load()
  .catch((error) => console.error('Local edits unavailable:', error))
  .then(() => addSource(edits.source))
  .then(() => readText('game.txt'))
  .then(parseGame)
  .then((game) => {
    const reactRoot = ReactDOM.createRoot(root);
    const render = (game) => {
      document.title = game.title;
      reactRoot.render(
        <React.StrictMode>
          <App game={game} />
        </React.StrictMode>,
      );
    };
    render(game);

    // An edit to game.txt applies live too: its stats and title.  (Where the
    // game starts only matters to a new game.)
    window.addEventListener('Content.changed', ({ detail: { path } }) => {
      if (path !== 'game.txt') return;
      readText('game.txt')
        .then(parseGame)
        .then(render)
        .catch((error) => console.error(`game.txt: ${error.message}`));
    });
  })
  .catch((error) => {
    root.textContent = `This game could not start: ${error.message}`;
  });
