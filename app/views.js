// The four surfaces of the app, one renderer each. A view receives the
// <main> element, fetches what it needs through api.js (cached), and
// replaces the element's content in one innerHTML write; small updates
// after that (the board filter, a leaderboard growing) repaint only the
// list they touch, never the whole page.

import { board, bounty, leaderboard, profile } from './api.js';
import { absUrl, accepting, ago, count, esc, until, usd, when } from './format.js';

// --- a small Markdown renderer -------------------------------------------
// The API's descriptions and rules are Markdown. Escape everything
// first, then rebuild the handful of constructs those texts use:
// headings, lists, quotes, code fences, bold, inline code and links.

function inline(text) {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label, url) =>
      /^https?:\/\//.test(url) || url.startsWith('/') ? `<a href="${url}" target="_blank" rel="noopener">${label}</a>` : label,
    );
}

export function md(source) {
  const lines = esc(source ?? '').split('\n');
  const out = [];
  let para = [];
  let list = null; // 'ul' | 'ol' | null
  let fence = false;
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      flushPara();
      flushList();
      out.push(fence ? '</code></pre>' : '<pre><code>');
      fence = !fence;
      continue;
    }
    if (fence) {
      out.push(line);
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (heading) {
      flushPara();
      flushList();
      const level = Math.min(6, heading[1].length + 1);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
    } else if (bullet || numbered) {
      flushPara();
      const kind = bullet ? 'ul' : 'ol';
      if (list !== kind) {
        flushList();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inline((bullet ?? numbered)[1])}</li>`);
    } else if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      flushPara();
      flushList();
      out.push('<hr>');
    } else if (line.startsWith('&gt; ')) {
      flushPara();
      flushList();
      out.push(`<blockquote>${inline(line.slice(5))}</blockquote>`);
    } else if (line.trim() === '') {
      flushPara();
      flushList();
    } else {
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  if (fence) out.push('</code></pre>');
  return out.join('\n');
}

// --- shared bits ----------------------------------------------------------

function chip(text, kind = '') {
  return `<span class="chip ${kind}">${esc(text)}</span>`;
}

// One board row: title and summary on the left, the numbers a visitor
// scans for (live pot, fee, entries, time left) on the right.
function boardRow(comp, now) {
  const live = accepting(comp, now);
  const pot = comp.potUsd != null ? comp.potUsd : comp.rewardAmount;
  const fee = Number.parseFloat(comp.entryFeeUsd ?? '0');
  const winner = comp.winner?.handle
    ? `<div class="bwin">Won by <a href="#/user/${esc(comp.winner.handle)}">@${esc(comp.winner.handle)}</a> · ${esc(comp.winner.title ?? '')} · ${usd(comp.winner.amountUsd)}</div>`
    : '';
  return `<article class="brow">
    <div class="bmain">
      <a class="btitle" href="#/bounty/${esc(comp.slug)}">${esc(comp.title)}</a>
      <div class="bmeta">${esc(comp.category ?? '')}${comp.skills?.length ? ' · ' + esc(comp.skills.slice(0, 3).join(' · ')) : ''}</div>
      <p class="bsum">${esc(comp.summary ?? '')}</p>
      ${winner}
    </div>
    <div class="bstats">
      <div class="bpot">${usd(pot)}<span>pot</span></div>
      <div class="bnums">
        ${fee > 0 ? chip(`Fee ${usd(fee)}`, 'fee') : ''}
        ${chip(`${count(comp.submissionCount)} entries`)}
        ${live ? `<span class="chip time" data-countdown="${esc(comp.deadline)}">${esc(until(comp.deadline, now))}</span>` : chip(comp.status === 'resolved' ? 'Resolved' : 'Closed', 'off')}
      </div>
    </div>
  </article>`;
}

// --- the board ------------------------------------------------------------

export async function boardView(root) {
  const items = await board();
  const now = Date.now();
  const open = items.filter((c) => accepting(c, now)).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  const done = items.filter((c) => !accepting(c, now)).sort((a, b) => new Date(b.deadline) - new Date(a.deadline));
  root.innerHTML = `
    <section class="board-head">
      <h1>Live bounties</h1>
      <p class="lede">${open.length} open now · pots are live: the prize plus every entry fee paid so far.</p>
      <label class="filter"><span class="sr">Filter bounties</span>
        <input id="q" type="search" placeholder="Filter by name, category or skill…" autocomplete="off">
      </label>
    </section>
    <section id="open-list" class="blist"></section>
    <h2 class="sect">Finished</h2>
    <section id="done-list" class="blist"></section>`;
  const openEl = root.querySelector('#open-list');
  const doneEl = root.querySelector('#done-list');
  const paint = (query) => {
    const q = query.trim().toLowerCase();
    const match = (c) =>
      !q || [c.title, c.slug, c.category, ...(c.skills ?? [])].join(' ').toLowerCase().includes(q);
    const o = open.filter(match);
    const d = done.filter(match);
    openEl.innerHTML = o.length ? o.map((c) => boardRow(c, now)).join('') : '<p class="empty">No open bounty matches.</p>';
    doneEl.innerHTML = d.length ? d.map((c) => boardRow(c, now)).join('') : '<p class="empty">Nothing here.</p>';
  };
  paint('');
  root.querySelector('#q').addEventListener('input', (event) => paint(event.target.value));
}

// --- one bounty's page ------------------------------------------------------

function rewardsTable(comp) {
  const rows = Array.isArray(comp.rewardsNow) ? comp.rewardsNow : [];
  if (rows.length) {
    const body = rows
      .map(
        (r) => `<tr><td>${esc(r.place)}</td><td>${usd(r.baseUsd)}</td><td>${usd(r.feeShareUsd)}</td><td class="strong">${usd(r.amountUsd)}</td></tr>`,
      )
      .join('');
    return `<table class="nums"><thead><tr><th>Place</th><th>Prize</th><th>Fee share</th><th>Pays now</th></tr></thead><tbody>${body}</tbody></table>`;
  }
  const map = comp.rewards ?? {};
  const places = Object.keys(map).sort((a, b) => Number(a) - Number(b));
  if (!places.length) return '<p class="empty">No rewards table published.</p>';
  const body = places.map((p) => `<tr><td>${esc(p)}</td><td class="strong">${usd(map[p])}</td></tr>`).join('');
  return `<table class="nums"><thead><tr><th>Place</th><th>Prize</th></tr></thead><tbody>${body}</tbody></table>`;
}

export async function bountyView(root, slug) {
  const comp = await bounty(slug);
  const now = Date.now();
  const live = accepting(comp, now);
  const fee = Number.parseFloat(comp.entryFeeUsd ?? '0');
  const subs = (comp.submissions ?? []).slice(0, 8);
  const subRows = subs
    .map(
      (s) => `<li>
        <a href="#/user/${esc(s.hunter)}">@${esc(s.hunter)}</a>
        <span class="stitle">${esc(s.title ?? '')}</span>
        <span class="smeta">${ago(s.createdAt, now)}${typeof s.score === 'number' ? ` · score ${count(s.score)}` : ''}</span>
      </li>`,
    )
    .join('');
  root.innerHTML = `
    <p class="crumbs"><a href="#/">← All bounties</a></p>
    <header class="bhead">
      <h1>${esc(comp.title)}</h1>
      <div class="chips">
        ${live ? `<span class="chip time" data-countdown="${esc(comp.deadline)}">${esc(until(comp.deadline, now))}</span>` : chip(comp.status === 'resolved' ? 'Resolved' : 'Closed', 'off')}
        ${chip(comp.category ?? '')}
        ${fee > 0 ? chip(`Entry fee ${usd(fee)}`, 'fee') : chip('Free to enter')}
        ${chip(`${count(comp.submissionCount)} entries`)}
      </div>
      <p class="lede">${esc(comp.summary ?? '')}</p>
    </header>
    <section class="potband" aria-label="Prize pot">
      <div><strong>${usd(comp.potUsd != null ? comp.potUsd : comp.rewardAmount)}</strong><span>live pot</span></div>
      <div><strong>${usd(comp.rewardAmount)}</strong><span>base prize</span></div>
      <div><strong>${usd(comp.entryFeesUsd ?? 0)}</strong><span>entry fees (${count(comp.entryFeePayers ?? 0)} paid)</span></div>
      <div><strong class="when">${when(comp.opensAt ?? comp.publishedAt)}</strong><span>opened</span></div>
      <div><strong class="when">${when(comp.deadline)}</strong><span>deadline</span></div>
    </section>
    <p class="actions"><a class="btn" href="#/bounty/${esc(comp.slug)}/leaderboard">View the leaderboard →</a></p>
    <section class="cols">
      <div class="col-main">
        <h2>About this bounty</h2>
        <div class="md">${md(comp.description ?? '')}</div>
        ${comp.rules ? `<details class="rules"><summary>Full rules</summary><div class="md">${md(comp.rules)}</div></details>` : ''}
      </div>
      <aside class="col-side">
        <h2>Rewards</h2>
        ${rewardsTable(comp)}
        ${subs.length ? `<h2>Latest entries</h2><ul class="subs">${subRows}</ul>` : ''}
      </aside>
    </section>`;
}

// --- a bounty's leaderboard -------------------------------------------------

const PAGE_ROWS = 100;

export async function leaderboardView(root, slug, view) {
  const [data, comp] = await Promise.all([leaderboard(slug, view), bounty(slug).catch(() => null)]);
  const now = Date.now();
  const cols = (data.columns ?? []).filter((c) => !c.hidden);
  const entries = data.entries ?? [];
  const tabs = (data.views ?? [])
    .map((v) => `<a class="tab ${v === data.view ? 'on' : ''}" href="#/bounty/${esc(slug)}/leaderboard?view=${esc(v)}">${esc(v)}</a>`)
    .join('');
  root.innerHTML = `
    <p class="crumbs"><a href="#/bounty/${esc(slug)}">← ${esc(comp?.title ?? slug)}</a></p>
    <header class="bhead">
      <h1>Leaderboard</h1>
      <div class="chips">
        ${chip(`${esc(data.phase?.title ?? 'Results')}${data.phase?.scores === 'live' ? ' · live scores' : ''}`)}
        ${chip(`${count(entries.length)} ranked entries`)}
        ${data.tie_break ? chip(`Ties: ${esc(data.tie_break.title)} (${esc(data.tie_break.better)} wins)`) : ''}
      </div>
      ${tabs ? `<nav class="tabs" aria-label="Leaderboard view">${tabs}</nav>` : ''}
    </header>
    <div class="tablewrap"><table class="lb">
      <thead><tr><th>#</th><th>Entrant</th><th>Entry</th>${cols.map((c) => `<th class="num">${esc(c.title ?? c.key)}</th>`).join('')}<th>Received</th></tr></thead>
      <tbody id="lb-body"></tbody>
    </table></div>
    <p id="lb-more" class="actions"></p>`;
  const body = root.querySelector('#lb-body');
  const more = root.querySelector('#lb-more');
  const rowHtml = (e) => `<tr>
      <td class="num">${esc(e.rank ?? '')}</td>
      <td><span class="entrant">${e.image ? `<img class="ava" src="${esc(absUrl(e.image))}" crossorigin="anonymous" alt="" loading="lazy" width="22" height="22">` : ''}<a href="#/user/${esc(e.handle)}">@${esc(e.handle)}</a>${e.house ? ' ' + chip('house', 'off') : ''}${e.baseline ? ' ' + chip('baseline', 'off') : ''}</span></td>
      <td class="etitle">${esc(e.title ?? '')}</td>
      ${cols.map((c) => `<td class="num">${esc(e.display?.[c.key] ?? '')}</td>`).join('')}
      <td class="recv">${esc(ago(e.received_at, now))}</td>
    </tr>`;
  let shown = 0;
  const paintMore = () => {
    const left = entries.length - shown;
    more.innerHTML = left > 0 ? `<button class="btn" id="lb-all" type="button">Show all ${count(entries.length)} entries (${count(left)} more)</button>` : '';
    const btn = more.querySelector('#lb-all');
    if (btn) btn.addEventListener('click', () => paintRows(entries.length));
  };
  const paintRows = (upto) => {
    const next = Math.min(upto, entries.length);
    body.insertAdjacentHTML('beforeend', entries.slice(shown, next).map(rowHtml).join(''));
    shown = next;
    paintMore();
  };
  if (!entries.length) {
    body.innerHTML = '<tr><td colspan="99" class="empty">No ranked entries yet.</td></tr>';
  } else {
    paintRows(PAGE_ROWS);
  }
}

// --- an account's public profile ---------------------------------------------

export async function profileView(root, handle) {
  const p = await profile(handle);
  const now = Date.now();
  const rec = p.record ?? {};
  const name = p.display_name || p.handle;
  const stats = [
    ['Entered', count(rec.competitions_entered)],
    ['Placed', count(rec.competitions_placed)],
    ['Won', count(rec.competitions_won)],
    ['Podiums', count(rec.podium_finishes)],
    ['Best place', rec.best_placement ? '#' + count(rec.best_placement) : '—'],
    ['Prizes', usd(rec.prize_usd)],
  ];
  const links = [
    p.github_login ? `<a href="https://github.com/${esc(p.github_login)}" target="_blank" rel="noopener">GitHub @${esc(p.github_login)}</a>` : '',
    p.x ? `<a href="https://x.com/${esc(p.x)}" target="_blank" rel="noopener">X @${esc(p.x)}</a>` : '',
    p.discord ? `<span>Discord ${esc(p.discord)}</span>` : '',
    p.wallet?.address
      ? `<a href="${esc(p.wallet.explorer_url ?? '#')}" target="_blank" rel="noopener">Wallet ${esc(p.wallet.address.slice(0, 6))}…${esc(p.wallet.address.slice(-4))}</a>`
      : '',
  ].filter(Boolean);
  const solutions = (p.solutions ?? [])
    .map((s) => {
      const c = s.competition ?? {};
      const score = s.score ? `${esc(s.score.column?.title ?? 'Score')} ${esc(s.score.display ?? '')}` : '';
      const placed = s.placement ? `Placed #${count(s.placement)}${s.prize_usd ? ' · ' + usd(s.prize_usd) : ''}` : '';
      return `<li>
        <a class="ptitle" href="#/bounty/${esc(c.slug)}">${esc(c.title ?? c.slug ?? '')}</a>
        <span class="stitle">${esc(s.title ?? '')}</span>
        <span class="smeta">${[c.category, c.status, score, placed, 'entered ' + ago(s.entered_at, now)].filter(Boolean).map(esc).join(' · ')}</span>
      </li>`;
    })
    .join('');
  const payouts = (p.payouts ?? [])
    .map(
      (pay) => `<li>
        <strong>${usd(pay.amount_usd)}</strong>
        <span class="stitle">#${count(pay.place)} in <a href="#/bounty/${esc(pay.competition?.slug)}">${esc(pay.competition?.title ?? '')}</a></span>
        <span class="smeta">${when(pay.paid_at)}${pay.explorer_url ? ` · <a href="${esc(pay.explorer_url)}" target="_blank" rel="noopener">transaction</a>` : ''}</span>
      </li>`,
    )
    .join('');
  root.innerHTML = `
    <header class="phead">
      ${p.image || p.avatar?.url ? `<img class="pava" src="${esc(absUrl(p.avatar?.url ?? p.image))}" crossorigin="anonymous" alt="" width="72" height="72">` : ''}
      <div>
        <h1>${esc(name)}</h1>
        <p class="phandle">@${esc(p.handle)}${p.house ? ' ' + chip('house', 'off') : ''}</p>
        ${p.bio ? `<p class="lede">${esc(p.bio)}</p>` : ''}
        <p class="pmeta">Joined ${when(p.joined_at)}</p>
        ${links.length ? `<p class="plinks">${links.join(' · ')}</p>` : ''}
      </div>
    </header>
    <section class="statgrid" aria-label="Record">
      ${stats.map(([label, value]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join('')}
    </section>
    ${solutions ? `<h2 class="sect">Entries</h2><ul class="subs big">${solutions}</ul>` : '<p class="empty">No entries yet.</p>'}
    ${payouts ? `<h2 class="sect">Payouts</h2><ul class="subs big">${payouts}</ul>` : ''}`;
}
