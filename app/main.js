// funboard's router. The shell (index.html) loads this module plus the
// API and format helpers — that is the whole first load. The views are
// one dynamic import away, fetched the first time a route renders and
// kept afterwards, so the board's first paint stays small.
//
// Routes (hash-based, so the app works from any static server and even
// from a file:// page):
//   #/                                  the bounty board
//   #/bounty/<slug>                     one bounty's page
//   #/bounty/<slug>/leaderboard        its leaderboard (?view=overall…)
//   #/user/<handle>                     an account's public profile

import { cachedAnswers } from './api.js';
import { esc, until } from './format.js';

const root = document.getElementById('view');
const cacheNote = document.getElementById('cache-note');
const boardLink = document.getElementById('nav-board');

let viewsPromise = null;
function loadViews() {
  if (!viewsPromise) viewsPromise = import('./views.js');
  return viewsPromise;
}

// Split the current hash into path segments and a query map.
function route() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  return {
    parts: path.split('/').filter(Boolean).map(decodeURIComponent),
    query: new URLSearchParams(qs ?? ''),
  };
}

function showError(err) {
  root.innerHTML = `<section class="error">
    <h1>That view did not load</h1>
    <p>${esc(err?.message ?? String(err))}</p>
    <p><a class="btn" href="#/">Back to the board</a></p>
  </section>`;
}

async function navigate() {
  window.__shotReady = false;
  const { parts, query } = route();
  boardLink.toggleAttribute('aria-current', parts.length === 0);
  root.innerHTML = '<p class="loading" role="status">Loading live data…</p>';
  try {
    const views = await loadViews();
    if (parts.length === 0) {
      await views.boardView(root);
    } else if (parts[0] === 'bounty' && parts.length === 2) {
      await views.bountyView(root, parts[1]);
    } else if (parts[0] === 'bounty' && parts.length === 3 && parts[2] === 'leaderboard') {
      await views.leaderboardView(root, parts[1], query.get('view') ?? undefined);
    } else if (parts[0] === 'user' && parts.length === 2) {
      await views.profileView(root, parts[1]);
    } else {
      root.innerHTML = `<section class="error"><h1>No such page</h1>
        <p>Try the <a href="#/">bounty board</a>.</p></section>`;
    }
  } catch (err) {
    showError(err);
  }
  if (cacheNote) cacheNote.textContent = `${cachedAnswers()} API answers cached`;
  window.__shotReady = true;
}

// Countdowns tick in place: every [data-countdown] element carries its
// deadline and is re-labelled here, so a page left open stays honest
// without re-rendering or refetching anything.
setInterval(() => {
  const now = Date.now();
  for (const el of document.querySelectorAll('[data-countdown]')) {
    el.textContent = until(el.getAttribute('data-countdown'), now);
  }
}, 30_000);

// The header's profile jump: type a handle, land on its profile route.
document.getElementById('jump').addEventListener('submit', (event) => {
  event.preventDefault();
  const handle = new FormData(event.target).get('handle').trim().replace(/^@/, '');
  if (handle) location.hash = '#/user/' + encodeURIComponent(handle);
});

window.addEventListener('hashchange', navigate);
navigate();
