import './wdyr';
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { readText } from './content'
import { parseGame } from './game'
import './index.css'

const root = document.getElementById('root');

readText('game.txt')
  .then(parseGame)
  .then((game) => {
    document.title = game.title;
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <App game={game} />
      </React.StrictMode>,
    )
  })
  .catch((error) => {
    root.textContent = `This game could not start: ${error.message}`;
  });
