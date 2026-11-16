// Display helpers for the funboard client: escaping, money, dates and
// countdown text. Pure functions only, no state, so every view formats
// the same values the same way.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Escape a value for safe interpolation into HTML text or attributes.
export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// The API answers some paths relative to the make.fun origin (avatars,
// profile pictures); make those absolute, leave full URLs untouched.
export function absUrl(path) {
  if (!path) return '';
  return path.startsWith('/') ? 'https://make.fun' + path : path;
}

// Money as the site shows it: $1,325 or $637.50 when cents are non-zero.
// Accepts numbers and numeric strings ("0.50"), null-safe.
export function usd(value) {
  const n = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  const fixed = Math.abs(n % 1) > 0.0001 ? n.toFixed(2) : String(Math.trunc(n));
  const [whole, cents] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return '$' + grouped + (cents ? '.' + cents : '');
}

// Plain grouped integer, for entry counts and row numbers.
export function count(value) {
  const n = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// "15 Nov 2026 · 12:30 UTC" from an ISO timestamp.
export function when(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} · ${hh}:${mm} UTC`;
}

// Human distance between now and a deadline: "2d 4h left", "3h 12m left",
// "41m left", "12s left", or "ended" once it has passed. A bounty is only
// taking entries while this has not run out, whatever its status says.
export function until(iso, now = Date.now()) {
  const ms = new Date(iso).getTime() - now;
  if (!Number.isFinite(ms)) return '—';
  if (ms <= 0) return 'ended';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  if (m > 0) return `${m}m left`;
  return `${s}s left`;
}

// Short relative past: "just now", "5m ago", "3h ago", "2d ago".
export function ago(iso, now = Date.now()) {
  const ms = now - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const s = Math.floor(ms / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// True while a competition still takes entries: the API status can keep
// reading "open" after the deadline until results publish, so the
// deadline is the source of truth, per the bounty's own rules.
export function accepting(comp, now = Date.now()) {
  return comp.status === 'open' && new Date(comp.deadline).getTime() > now;
}
