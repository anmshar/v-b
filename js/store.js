// Shared demo state. Persisted in localStorage so the website and back office
// (two tabs, or the two panes of the split-screen demo) see the same data live.
import { buildSeed, SEED_VERSION } from './data/seed.js';

const KEY = 'vb-tiles-demo-state';
let cache = null;
let memory = null; // fallback when storage is blocked (private mode, previews)
const subs = new Set();

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.version === SEED_VERSION) return s;
    }
  } catch (e) {
    /* storage unavailable */
  }
  return memory;
}

function write(s) {
  memory = s;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch (e) {
    /* storage unavailable: keep in memory */
  }
}

export function getState() {
  if (!cache) {
    cache = read();
    if (!cache) {
      cache = buildSeed();
      write(cache);
    }
  }
  return cache;
}

// Always re-read before mutating so changes made in another pane are not overwritten.
export function update(fn) {
  const s = read() || getState();
  const out = fn(s);
  s.rev = (s.rev || 0) + 1;
  write(s);
  cache = s;
  emit();
  return out;
}

export function resetAll() {
  const s = buildSeed();
  write(s);
  cache = s;
  emit();
}

export function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

function emit() {
  for (const fn of [...subs]) {
    try {
      fn(cache);
    } catch (e) {
      console.error(e);
    }
  }
}

window.addEventListener('storage', (e) => {
  if (e.key === KEY || e.key === null) {
    cache = null;
    getState();
    emit();
  }
});

// Demo clock: real time plus an offset the presenter can fast-forward.
export function now(s) {
  return Date.now() + ((s || getState()).clockOffset || 0);
}
