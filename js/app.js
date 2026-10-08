// Hash router and render loop.
import { getState, subscribe } from './store.js';
import { startEngine } from './engine.js';
import { toast } from './util.js';
import * as site from './views/site.js';
import * as office from './views/office.js';
import * as demoViews from './views/demo.js';

const root = document.getElementById('app');
const embedded = new URLSearchParams(location.search).has('embed');
document.documentElement.classList.toggle('embedded', embedded);

let current = null;
let area = null;
let areaMod = null;
let lastEventId = null;
let tickTimer = null;

function parseHash() {
  const h = location.hash.slice(1) || '/';
  const [path, query = ''] = h.split('?');
  return { path, parts: path.split('/').filter(Boolean), query: new URLSearchParams(query) };
}

function isTyping() {
  const a = document.activeElement;
  return a && root.contains(a) && ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName) && a.type !== 'checkbox';
}

function route() {
  current?.unmount?.();
  const r = parseHash();
  const top = r.parts[0] || '';
  if (top === 'site') { area = 'site'; areaMod = site; }
  else if (top === 'office') { area = 'office'; areaMod = office; }
  else { area = top === 'demo' ? 'demo' : 'launcher'; areaMod = null; }
  current = areaMod ? areaMod.resolve(r) : demoViews.resolve(r);
  current.path = r.path;
  document.body.className = `area-${area}`;
  document.title = `${current.title} · V&B Tiles demo`;
  renderAll();
  window.scrollTo(0, 0);
  clearInterval(tickTimer);
  if (area === 'office') tickTimer = setInterval(() => { if (!isTyping()) { renderChrome(); if (current.reactive) renderView(true); } }, 5000);
}

function renderAll() {
  if (areaMod) {
    root.innerHTML = `<div id="chrome-top"></div><main id="view" class="${areaMod.mainClass}"></main><div id="chrome-bottom"></div>`;
    renderChrome();
  } else {
    root.innerHTML = '<main id="view"></main>';
  }
  renderView(false);
}

function renderChrome() {
  if (!areaMod) return;
  const top = document.getElementById('chrome-top');
  const bottom = document.getElementById('chrome-bottom');
  top.innerHTML = areaMod.chromeTop(current.path);
  bottom.innerHTML = areaMod.chromeBottom(current.path);
  areaMod.bindChrome(root);
}

function renderView(keepScroll) {
  const view = document.getElementById('view');
  const y = window.scrollY;
  view.innerHTML = current.render();
  current.mount?.(view, () => renderView(true));
  if (keepScroll) window.scrollTo(0, y);
}

function onChange(s) {
  // Toasts for events meant for this side of the demo.
  if (lastEventId && s.events.length) {
    const fresh = [];
    for (const e of s.events) {
      if (e.id === lastEventId) break;
      fresh.push(e);
    }
    for (const e of fresh.reverse()) if (e.toast && e.toast === area) toast(e.toastText || e.message, 'live');
  }
  lastEventId = s.events[0]?.id || null;
  if (!areaMod) return;
  renderChrome();
  if (current.reactive && !isTyping()) renderView(true);
}

lastEventId = getState().events[0]?.id || null;
subscribe(onChange);
window.addEventListener('hashchange', route);
startEngine();
route();
