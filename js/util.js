// Small shared helpers: escaping, ids, seeded random, dates, colours, toasts.

export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const uid = (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 10)}`;

export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- numbers & dates ----------
const nf = new Intl.NumberFormat('en-GB');
export const fmtNum = (n) => nf.format(Math.round(n));
export const fmtEur = (n) => `EUR ${nf.format(Math.round(n))}`;
export const fmtPct = (n, d = 0) => `${(n * 100).toFixed(d)}%`;

export const HOUR = 3600e3;
export const DAY = 24 * HOUR;

export function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function fmtDateTime(ts) {
  return new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
export function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
export function fmtDuration(ms) {
  const neg = ms < 0;
  ms = Math.abs(ms);
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / HOUR);
  const m = Math.floor((ms % HOUR) / 60e3);
  let out;
  if (d > 0) out = `${d} d ${h} h`;
  else if (h > 0) out = `${h} h ${m} min`;
  else if (m > 0) out = `${m} min`;
  else out = '< 1 min';
  return neg ? `-${out}` : out;
}
export function fmtAgo(ts, now) {
  const diff = now - ts;
  if (diff < 45e3) return 'just now';
  return `${fmtDuration(diff)} ago`;
}

export function isWeekend(ts) {
  const d = new Date(ts).getDay();
  return d === 0 || d === 6;
}
// Adds n working days (Mon–Fri) keeping the time of day.
export function addWorkingDays(ts, n) {
  let t = ts;
  let left = n;
  while (left > 0) {
    t += DAY;
    if (!isWeekend(t)) left--;
  }
  return t;
}

export function median(arr) {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

// ---------- colours ----------
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
export function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + amt, g + amt, b + amt);
}
export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
// Perceptual-ish distance ("redmean"), 0..~765
export function colorDist(a, b) {
  const [r1, g1, b1] = typeof a === 'string' ? hexToRgb(a) : a;
  const [r2, g2, b2] = typeof b === 'string' ? hexToRgb(b) : b;
  const rm = (r1 + r2) / 2;
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}
// Coarse colour families used by search
export function colorFamilies(hex) {
  const [h, s, l] = rgbToHsl(...hexToRgb(hex));
  const fam = new Set();
  if (l > 0.8) fam.add('light');
  if (l < 0.36) fam.add('dark');
  if (s < 0.14) fam.add('grey');
  if (s >= 0.08 && h >= 18 && h <= 55) fam.add('warm');
  if (s >= 0.12 && h > 55 && h < 170) fam.add('green');
  if (s >= 0.12 && h >= 170 && h < 260) fam.add('blue');
  if (s >= 0.25 && (h < 18 || h > 330)) fam.add('red');
  if (l >= 0.36 && l <= 0.8 && s < 0.14) fam.add('mid-grey');
  return fam;
}

// ---------- DOM ----------
export function toast(msg, kind = 'info') {
  let wrap = document.getElementById('toasts');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toasts';
    document.body.appendChild(wrap);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.innerHTML = msg;
  wrap.appendChild(el);
  setTimeout(() => el.classList.add('out'), 4200);
  setTimeout(() => el.remove(), 4700);
}

export function parseFormat(f) {
  const m = String(f).match(/(\d+)\s*[×x]\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : [60, 60];
}
