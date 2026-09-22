// The /tests/ page: loads the game's text files over the network and runs
// every portable check against them, right in the browser.
import files from 'virtual:content-manifest';

import checks from '.';
import { loadContent } from './content';
import { collect, run } from './runner';
import { readText } from '../content';
import './page.css';

const root = document.getElementById('checks');
const params = new URLSearchParams(location.search);
const grep = (params.get('grep') || '').toLowerCase();

function el(tag, attrs={}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, attrs);
  node.append(...children);
  return node;
}

const summary = el('p', { className: 'summary', textContent: 'Loading game files…' });
const list = el('ol', { className: 'results' });
root.append(
  el('h1', { textContent: 'FM checks' }),
  summary,
  el('p', { className: 'hint' },
    'Every text file in this game, and the engine that reads it, checked in this browser. ',
    el('a', { href: '../', textContent: 'Back to the game' }),
  ),
  list,
);

async function main() {
  // Read files the way the game does, through the same content sources.
  let failedLoads = [];
  const content = await loadContent(files, (file) => (
    readText(file).catch((error) => {
      failedLoads.push(`${file} (${error.message})`);
      return '';
    })
  ));

  let [passed, failed] = [0, 0];
  const started = performance.now();
  const update = (done) => {
    const ms = Math.round(performance.now() - started);
    summary.textContent = `${passed} passed, ${failed} failed${done ? ` in ${ms} ms` : '…'}`;
    summary.className = `summary ${failed ? 'bad' : done ? 'good' : ''}`;
  };

  if (failedLoads.length) {
    list.append(el('li', { className: 'fail' },
      el('strong', { textContent: `Could not load ${failedLoads.length} file(s)` }),
      el('pre', { textContent: failedLoads.join('\n') }),
    ));
  }

  for (const { name, register } of checks) {
    const section = el('ol');
    const heading = el('li', { className: 'group' }, el('strong', { textContent: name }), section);
    list.append(heading);
    let tree;
    try {
      tree = collect(register, content);
    } catch (error) {
      failed++;
      section.append(el('li', { className: 'fail' }, `could not load: ${error.message}`));
      continue;
    }
    await run(tree, {
      onResult: ({ path, ok, error }) => {
        const title = path.join(' › ');
        if (grep && !`${name} ${title}`.toLowerCase().includes(grep)) return;
        ok ? passed++ : failed++;
        section.append(el('li', { className: ok ? 'pass' : 'fail' },
          `${ok ? '✓' : '✗'} ${title}`,
          ...(ok ? [] : [el('pre', { textContent: error?.message || String(error) })]),
        ));
        update(false);
      },
    });
    if (![...section.children].some((li) => li.classList.contains('fail'))) {
      heading.classList.add('collapsed');
    }
    heading.querySelector('strong').addEventListener('click', () => heading.classList.toggle('collapsed'));
  }
  update(true);
  document.title = `${failed ? '✗' : '✓'} FM checks`;
}

main().catch((error) => {
  summary.textContent = `The checks could not run: ${error.message}`;
  summary.className = 'summary bad';
});
