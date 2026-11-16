// The one place this app talks to the network: GET requests against
// make.fun's public API, held in a small in-memory cache.
//
// Two layers keep repeat views cheap:
//  - a freshness window (FRESH_MS) in which a cached answer is reused
//    with no request at all, so bouncing between routes costs nothing;
//  - ETag revalidation after that: the API binds its ETags to the
//    minute, so an If-None-Match usually answers 304 and the cached
//    body is served again instead of re-downloading it.
// Identical requests already in flight are shared, never duplicated.

const ORIGIN = 'https://make.fun/api';
const FRESH_MS = 20_000;

const cache = new Map(); // url -> { etag, body, at }
const pending = new Map(); // url -> Promise<body>

async function fetchBody(url) {
  const hit = cache.get(url);
  const headers = {};
  if (hit?.etag) headers['If-None-Match'] = hit.etag;
  const res = await fetch(url, { headers });
  if (res.status === 304 && hit) {
    hit.at = Date.now();
    return hit.body;
  }
  if (!res.ok) throw new Error(`make.fun API answered ${res.status} for ${url}`);
  const body = await res.json();
  cache.set(url, { etag: res.headers.get('ETag'), body, at: Date.now() });
  return body;
}

// GET one API path (relative to /api), through the cache.
export function get(path) {
  const url = ORIGIN + path;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < FRESH_MS) return Promise.resolve(hit.body);
  if (!pending.has(url)) {
    pending.set(
      url,
      fetchBody(url).finally(() => pending.delete(url)),
    );
  }
  return pending.get(url);
}

// The board: every competition, following the cursor if the list ever
// grows past one page. Items arrive newest-first from the API.
export async function board() {
  const items = [];
  let cursor = null;
  for (let page = 0; page < 5; page += 1) {
    const qs = cursor ? `?limit=100&cursor=${encodeURIComponent(cursor)}` : '?limit=100';
    const data = await get('/competitions' + qs);
    if (Array.isArray(data?.items)) items.push(...data.items);
    cursor = data?.next_cursor ?? null;
    if (!cursor) break;
  }
  return items;
}

// One bounty's full record: summary, description, rules, live rewards.
export function bounty(slug) {
  return get(`/competitions/${encodeURIComponent(slug)}`);
}

// One bounty's leaderboard in a view ("overall", "performance", ...);
// the default view when none is named.
export function leaderboard(slug, view) {
  const qs = view ? `?view=${encodeURIComponent(view)}` : '';
  return get(`/competitions/${encodeURIComponent(slug)}/leaderboard${qs}`);
}

// An account's public profile: record, entries and payouts.
export function profile(handle) {
  return get(`/profiles/${encodeURIComponent(handle)}`);
}

// How many API answers the cache currently holds (shown in the footer).
export function cachedAnswers() {
  return cache.size;
}
