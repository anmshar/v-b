// Customer-facing website: discovery (text + photo), product detail with configurator
// and BIM links, project board, enquiry/sample form, and the status-only workspace.
import { getState, update } from '../store.js';
import { esc, fmtDateTime, fmtNum, toast } from '../util.js';
import { COLLECTIONS, PRODUCTS, productById, collectionById, APPLICATIONS, BIM_SOFTWARE, TODAY_SELECTOR_RESULTS } from '../data/catalog.js';
import { thumbURL, renderLayout, REFERENCE_PHOTOS, referencePhoto } from '../textures.js';
import { searchText, describeInterpretation, EXAMPLE_QUERIES, analyseImage, searchByFeatures } from '../ai.js';
import { ROLES, COUNTRIES, PROJECT_TYPES, HOAI, publicSteps, hoaiLabel } from '../domain.js';
import * as E from '../engine.js';

const go = (h) => (location.hash = h);

export const mainClass = 'site-main';

export function chromeTop(path) {
  const v = getState().visitor;
  const active = (p) => (path.startsWith(p) ? 'active' : '');
  return `
  <header class="site-header">
    <a class="brand" href="#/site"><span class="logo">V&amp;B</span><span>Tiles <small>for architects</small></span></a>
    <nav class="site-nav">
      <a class="${active('/site/search') || active('/site/photo')}" href="#/site/search">Discover</a>
      <a class="${active('/site/collection')}" href="#/site/collections">Collections</a>
      <a class="${active('/site/saved')}" href="#/site/saved">Project board <span class="pill">${v.saved.length}</span></a>
      <a class="${active('/site/workspace')}" href="#/site/workspace">My requests ${v.requestIds.length ? `<span class="pill">${v.requestIds.length}</span>` : ''}</a>
      <a class="btn small" href="#/site/enquiry">Request samples</a>
    </nav>
  </header>`;
}

export function chromeBottom() {
  const v = getState().visitor;
  const banner =
    v.consentAnalytics === null
      ? `<div class="cookie" role="dialog" aria-label="Cookie consent">
          <div><b>Cookies & analytics.</b> We use analytics to improve product discovery and, with your consent, to tailor advice. <span class="muted">(Consent tool – simulated)</span></div>
          <div class="row gap"><button class="btn ghost" data-act="consent-no">Only necessary</button><button class="btn" data-act="consent-yes">Accept analytics</button></div>
        </div>`
      : '';
  return `
  <footer class="site-footer">
    <div>Prototype · all data simulated · product data would come from Salsify, BIM files from CADENAS, enquiries go to Salesforce.</div>
    <div class="row gap">
      ${v.contact ? `<span class="muted">Visitor: ${esc(v.contact.name)}</span>` : '<span class="muted">Anonymous visitor</span>'}
      <button class="link" data-act="new-visitor">Start as a new visitor</button>
    </div>
  </footer>
  ${banner}`;
}

export function bindChrome(root) {
  root.querySelector('[data-act="consent-yes"]')?.addEventListener('click', () => E.setAnalyticsConsent(true));
  root.querySelector('[data-act="consent-no"]')?.addEventListener('click', () => E.setAnalyticsConsent(false));
  root.querySelector('[data-act="new-visitor"]')?.addEventListener('click', () => {
    E.newVisitor();
    toast('New anonymous visitor');
    go('#/site');
  });
}

// ---------- shared card ----------
function productCard(res, opts = {}) {
  const p = res.product || res;
  const saved = getState().visitor.saved.includes(p.id);
  const match = res.match ? `<span class="match">${Math.round(res.match * 100)}% match</span>` : '';
  return `
  <article class="pcard" data-pid="${p.id}">
    <a class="pthumb" href="#/site/product/${p.id}" data-act="open"><img alt="${esc(p.name)}" src="${thumbURL(p)}">${match}</a>
    <div class="pbody">
      <div class="pmeta">${esc(p.collection.material)} · ${esc(p.collection.formats.slice(0, 3).join(', '))}</div>
      <h3><a href="#/site/product/${p.id}">${esc(p.name)}</a></h3>
      ${res.reasons?.length ? `<ul class="reasons">${res.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : `<p class="muted small">${esc(p.collection.tagline)}</p>`}
      ${res.checks?.length ? `<ul class="checks">${res.checks.map((c) => `<li class="${c.ok ? 'ok' : 'warn'}">${c.ok ? '✓' : '⚠'} ${esc(c.text)}</li>`).join('')}</ul>` : ''}
      <div class="row gap pactions">
        <a class="btn small ghost" href="#/site/product/${p.id}">View & configure</a>
        <button class="btn small ${saved ? 'saved' : 'ghost'}" data-act="save" data-pid="${p.id}">${saved ? '★ Saved' : '☆ Save'}</button>
        ${opts.remove ? `<button class="btn small ghost" data-act="save" data-pid="${p.id}">Remove</button>` : ''}
      </div>
    </div>
  </article>`;
}

function bindCards(root) {
  root.querySelectorAll('[data-act="save"]').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.preventDefault();
      const added = E.toggleSave(b.dataset.pid);
      toast(added ? 'Saved to your project board' : 'Removed from project board');
    }),
  );
}

// ---------- home ----------
function home() {
  return {
    title: 'Discover',
    render() {
      return `
      <section class="hero">
        <div class="hero-text">
          <p class="eyebrow">Product discovery for architects</p>
          <h1>Describe your project — or show us a photo.</h1>
          <p class="lead">Get ranked V&amp;B tiles with reasons and safety checks, instead of ${fmtNum(TODAY_SELECTOR_RESULTS)} unranked results.</p>
          <form class="searchbox" id="hero-search">
            <textarea name="q" rows="2" placeholder="e.g. Hotel lobby floor, warm grey concrete look, large format" aria-label="Describe your project"></textarea>
            <div class="row gap">
              <button class="btn" type="submit">Find tiles</button>
              <a class="btn ghost" href="#/site/photo">📷 Search by photo</a>
              <span class="ai-badge">AI · simulated</span>
            </div>
          </form>
          <div class="chips">${EXAMPLE_QUERIES.map((q) => `<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
        </div>
        <div class="hero-visual">${PRODUCTS.filter((_, i) => i % 3 === 0).slice(0, 6).map((p) => `<img alt="" src="${thumbURL(p)}">`).join('')}</div>
      </section>
      <section class="steps3">
        <div><span>1</span><h4>Discover</h4><p>Text or photo search, ranked with reasons and slip-resistance checks.</p></div>
        <div><span>2</span><h4>Configure & download</h4><p>Preview format, pattern and joint. BIM/CAD files from the CADENAS catalogue.</p></div>
        <div><span>3</span><h4>Request samples</h4><p>One form with project and HOAI phase. You get a named advisor and live status.</p></div>
      </section>
      <section>
        <h2 class="section-title">Collections</h2>
        <div class="collgrid">${COLLECTIONS.map(collCard).join('')}</div>
      </section>`;
    },
    mount(root) {
      root.querySelector('#hero-search').addEventListener('submit', (e) => {
        e.preventDefault();
        const q = new FormData(e.target).get('q').trim();
        if (q) go(`#/site/search?q=${encodeURIComponent(q)}`);
      });
      root.querySelectorAll('.chip[data-q]').forEach((c) => c.addEventListener('click', () => go(`#/site/search?q=${encodeURIComponent(c.dataset.q)}`)));
    },
  };
}

function collCard(c) {
  const p = PRODUCTS.find((x) => x.collectionId === c.id);
  return `<a class="ccard" href="#/site/collection/${c.id}"><img alt="" src="${thumbURL(p)}"><div><h4>${esc(c.name)}</h4><p>${esc(c.tagline)}</p><span class="muted small">${c.colours.length} colours · ${c.formats.length} formats</span></div></a>`;
}

// ---------- search ----------
function search(q) {
  let result = null;
  let tracked = false;
  return {
    title: 'Search',
    render() {
      result = q ? searchText(q) : null;
      const interp = result ? describeInterpretation(result.interpretation, result.requirement) : [];
      return `
      <section class="search-top">
        <form class="searchbox compact" id="search-form">
          <textarea name="q" rows="2" aria-label="Describe your project">${esc(q)}</textarea>
          <div class="row gap"><button class="btn" type="submit">Search</button><a class="btn ghost" href="#/site/photo">📷 Photo</a><span class="ai-badge">AI · simulated</span></div>
        </form>
        ${!q ? `<div class="chips">${EXAMPLE_QUERIES.map((x) => `<button class="chip" data-q="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : ''}
      </section>
      ${
        result
          ? `<section class="search-layout">
          <aside class="interp">
            <h4>We understood</h4>
            ${interp.length ? `<dl>${interp.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : '<p class="muted">No specific requirements recognised; matching by keywords.</p>'}
            <p class="muted small">Today's product selector shows ${fmtNum(TODAY_SELECTOR_RESULTS)} unranked results. Slip guidance is simplified — confirm with V&amp;B technical service.</p>
            <div class="feedback">Helpful? <button class="btn tiny ghost" data-fb="1">👍</button><button class="btn tiny ghost" data-fb="0">👎</button></div>
          </aside>
          <div>
            ${
              result.zero
                ? `<div class="empty"><h3>No exact match</h3><p>Try fewer constraints, or ask an advisor — this query is logged so product management can review zero-result searches.</p>
                   <div class="chips">${EXAMPLE_QUERIES.slice(0, 3).map((x) => `<button class="chip" data-q="${esc(x)}">${esc(x)}</button>`).join('')}</div>
                   <a class="btn" href="#/site/enquiry">Ask an advisor</a></div>`
                : `<p class="muted">${result.results.length} ranked matches</p><div class="pgrid">${result.results.map((r) => productCard(r)).join('')}</div>`
            }
          </div></section>`
          : ''
      }`;
    },
    mount(root) {
      root.querySelector('#search-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const nq = new FormData(e.target).get('q').trim();
        if (nq) go(`#/site/search?q=${encodeURIComponent(nq)}`);
      });
      root.querySelectorAll('.chip[data-q]').forEach((c) => c.addEventListener('click', () => go(`#/site/search?q=${encodeURIComponent(c.dataset.q)}`)));
      root.querySelectorAll('[data-fb]').forEach((b) =>
        b.addEventListener('click', () => {
          E.recordAIFeedback(b.dataset.fb === '1');
          toast('Thanks for the feedback');
        }),
      );
      bindCards(root);
      if (result && !tracked) {
        tracked = true;
        E.track('search', q, { results: result.results.length });
        if (result.zero) E.track('search_zero', q);
      }
    },
  };
}

// ---------- photo search ----------
function photo() {
  let features = null;
  let results = [];
  return {
    title: 'Photo search',
    render() {
      return `
      <section class="photo-top">
        <h1>Search by photo</h1>
        <p class="lead">Upload a reference image (mood board, site photo, competitor product) or pick an example.</p>
        <div class="refphotos">
          ${REFERENCE_PHOTOS.map((r) => `<button class="refphoto" data-ref="${r.id}"><canvas data-refcanvas="${r.id}" width="320" height="220"></canvas><span>${esc(r.label)}</span></button>`).join('')}
          <label class="refphoto upload"><input type="file" accept="image/*" id="photo-upload" hidden><span class="big">＋</span><span>Upload photo</span></label>
        </div>
        <p class="muted small">Uploaded photos can contain personal data — EU-only processing to be confirmed with V&amp;B IT. In this demo the image never leaves your browser.</p>
      </section>
      ${
        features
          ? `<section class="search-layout">
          <aside class="interp">
            <h4>We see</h4>
            <img class="photo-preview" alt="Analysed photo" src="${features.preview}">
            <dl>
              <dt>Dominant tone</dt><dd><span class="swatch" style="background:${features.hex}"></span> ${features.hex}</dd>
              <dt>Texture</dt><dd>${esc(features.look)}</dd>
              <dt>Brightness</dt><dd>${Math.round(features.light * 100)}%</dd>
            </dl>
            <p class="muted small">Production: image embeddings (multimodal) + Claude for the explanation. ≈ USD 0.001–0.008 per photo.</p>
          </aside>
          <div><p class="muted">${results.length} visually similar products</p><div class="pgrid">${results.map((r) => productCard(r)).join('')}</div></div>
        </section>`
          : ''
      }`;
    },
    mount(root, rerender) {
      root.querySelectorAll('canvas[data-refcanvas]').forEach((cv) => {
        const ref = REFERENCE_PHOTOS.find((r) => r.id === cv.dataset.refcanvas);
        cv.getContext('2d').drawImage(referencePhoto(ref, productById), 0, 0);
      });
      const analyse = (src, label) => {
        features = analyseImage(src);
        results = searchByFeatures(features);
        E.track('photo_search', label);
        rerender();
        setTimeout(() => document.querySelector('.search-layout')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      };
      root.querySelectorAll('[data-ref]').forEach((b) =>
        b.addEventListener('click', () => {
          const ref = REFERENCE_PHOTOS.find((r) => r.id === b.dataset.ref);
          analyse(referencePhoto(ref, productById), ref.label);
        }),
      );
      root.querySelector('#photo-upload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const img = new Image();
        img.onload = () => analyse(img, file.name);
        img.src = URL.createObjectURL(file);
      });
      bindCards(root);
    },
  };
}

// ---------- collections ----------
function collections() {
  return {
    title: 'Collections',
    render: () => `<h1>Collections</h1><p class="lead">Placeholder collections for the prototype — real data from Salsify.</p><div class="collgrid">${COLLECTIONS.map(collCard).join('')}</div>`,
  };
}

function collection(id) {
  const c = collectionById(id);
  if (!c) return notFound();
  return {
    title: c.name,
    render() {
      const prods = PRODUCTS.filter((p) => p.collectionId === c.id);
      return `
      <p class="crumbs"><a href="#/site/collections">Collections</a> / ${esc(c.name)}</p>
      <h1>${esc(c.name)}</h1><p class="lead">${esc(c.tagline)}</p>
      <div class="facts">
        <div><b>Material</b>${esc(c.material)}</div><div><b>Formats</b>${esc(c.formats.join(', '))}</div>
        <div><b>Surfaces</b>${c.surfaces.map((s) => `${esc(s.name)} ${s.slip}${s.barefoot ? '/' + s.barefoot : ''}`).join(' · ')}</div>
        <div><b>Applications</b>${c.applications.map((a) => APPLICATIONS[a].label).join(', ')}</div>
      </div>
      <div class="pgrid">${prods.map((p) => productCard(p)).join('')}</div>`;
    },
    mount: bindCards,
  };
}

// ---------- product detail ----------
function product(id) {
  const p = productById(id);
  if (!p) return notFound();
  const c = p.collection;
  const cfg = { format: c.formats.find((f) => /120|60×60/.test(f)) || c.formats[0], pattern: c.look === 'wood' ? 'third' : 'stack', joint: '#bdb8b0', jointMm: 3, vertical: false };
  let viewed = false;
  return {
    title: p.name,
    render() {
      const s = getState();
      const saved = s.visitor.saved.includes(p.id);
      const siblings = PRODUCTS.filter((x) => x.collectionId === c.id && x.id !== p.id);
      const reg = s.visitor.registered;
      return `
      <p class="crumbs"><a href="#/site/collections">Collections</a> / <a href="#/site/collection/${c.id}">${esc(c.name)}</a> / ${esc(p.colourName)}</p>
      <section class="pdp">
        <div class="pdp-media"><img alt="${esc(p.name)}" src="${thumbURL(p, 560)}"></div>
        <div class="pdp-info">
          <p class="eyebrow">${esc(c.material)} · Art. ${esc(p.article)}</p>
          <h1>${esc(p.name)}</h1>
          <p class="lead">${esc(c.tagline)}</p>
          <table class="spec">
            <tr><th>Formats</th><td>${esc(c.formats.join(', '))} cm</td></tr>
            <tr><th>Surfaces</th><td>${c.surfaces.map((s) => `${esc(s.name)}: <b>${s.slip}</b>${s.barefoot ? ` · barefoot ${s.barefoot}` : ''}`).join('<br>')}</td></tr>
            <tr><th>Applications</th><td>${c.applications.map((a) => APPLICATIONS[a].label).join(', ')}</td></tr>
            <tr><th>Thickness</th><td>${esc(c.thickness)}${c.rectified ? ' · rectified' : ''}</td></tr>
            <tr><th>Frost resistant</th><td>${c.frost ? 'Yes' : 'No'}</td></tr>
          </table>
          <div class="row gap wrap">
            <button class="btn ${saved ? 'saved' : 'ghost'}" data-act="save" data-pid="${p.id}">${saved ? '★ Saved to project board' : '☆ Save to project board'}</button>
            <a class="btn" href="#/site/enquiry?p=${p.id}" data-act="enquire">Request samples / advice</a>
          </div>
          ${siblings.length ? `<div class="siblings"><span class="muted small">Other colours</span>${siblings.map((x) => `<a href="#/site/product/${x.id}" title="${esc(x.name)}"><img alt="${esc(x.name)}" src="${thumbURL(x, 120)}"></a>`).join('')}</div>` : ''}
        </div>
      </section>

      <section class="config">
        <div>
          <h2>Configurator</h2>
          <label>Format<select id="cf-format">${c.formats.map((f) => `<option ${f === cfg.format ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></label>
          <label>Laying pattern<select id="cf-pattern">
            <option value="stack" ${cfg.pattern === 'stack' ? 'selected' : ''}>Stack bond</option>
            <option value="half" ${cfg.pattern === 'half' ? 'selected' : ''}>½ offset</option>
            <option value="third" ${cfg.pattern === 'third' ? 'selected' : ''}>⅓ offset</option></select></label>
          <label>Joint colour<select id="cf-joint">
            ${[['#bdb8b0', 'Silver grey'], ['#efede7', 'White'], ['#7c7873', 'Cement grey'], ['#3d3c3a', 'Anthracite'], ['#c9b89a', 'Sand']].map(([v, n]) => `<option value="${v}" ${cfg.joint === v ? 'selected' : ''}>${n}</option>`).join('')}
          </select></label>
          <label>Joint width<select id="cf-jmm">${[2, 3, 5, 8].map((m) => `<option ${m === cfg.jointMm ? 'selected' : ''} value="${m}">${m} mm</option>`).join('')}</select></label>
          <label class="check"><input type="checkbox" id="cf-vert" ${cfg.vertical ? 'checked' : ''}> Rotate 90°</label>
          <button class="btn small ghost" id="cf-download">Download visual (PNG)</button>
        </div>
        <canvas id="cf-canvas" width="900" height="540" aria-label="Configured layout preview"></canvas>
      </section>

      <section class="bim">
        <div class="bim-head">
          <div><h2>BIM & CAD</h2><p class="muted">Files are delivered by V&amp;B's CADENAS catalogue. Initial release: existing files only, no conversion.</p></div>
          <span class="muted small">${reg ? `Registered as ${esc(reg.name)}` : 'CADENAS asks for a one-time registration'}</span>
        </div>
        <div class="bimgrid">
          ${BIM_SOFTWARE.map((sw) => {
            const st = c.bim[sw.id];
            const label = st === true ? 'Available' : st === false ? 'Not in catalogue' : 'Coverage unconfirmed';
            return `<div class="bimcard ${st === true ? 'ok' : st === false ? 'no' : 'unk'}"><b>${esc(sw.label)}</b><span class="muted small">${esc(sw.ext)}</span><span class="tag">${label}</span>
              ${st === true ? `<button class="btn small" data-bim="${sw.id}">Download</button>` : st === null ? `<button class="btn small ghost" data-bim-ask="${sw.id}">Ask advisor</button>` : ''}</div>`;
          }).join('')}
        </div>
      </section>
      <div id="modal-root"></div>`;
    },
    mount(root, rerender) {
      if (!viewed) {
        viewed = true;
        E.track('view_product', p.name, { productId: p.id });
      }
      bindCards(root);
      const canvas = root.querySelector('#cf-canvas');
      const draw = () => renderLayout(canvas, p, cfg);
      draw();
      const bind = (sel, key, fn = (v) => v) =>
        root.querySelector(sel).addEventListener('change', (e) => {
          cfg[key] = fn(e.target.type === 'checkbox' ? e.target.checked : e.target.value);
          draw();
          E.track('configure', `${p.name} ${cfg.format} ${cfg.pattern}`);
        });
      bind('#cf-format', 'format');
      bind('#cf-pattern', 'pattern');
      bind('#cf-joint', 'joint');
      bind('#cf-jmm', 'jointMm', Number);
      bind('#cf-vert', 'vertical');
      root.querySelector('#cf-download').addEventListener('click', () => {
        const a = document.createElement('a');
        a.download = `${p.id}-${cfg.format.replace(/[^\dx×]/g, '')}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
      });
      root.querySelectorAll('[data-bim]').forEach((b) =>
        b.addEventListener('click', () => {
          const sw = BIM_SOFTWARE.find((x) => x.id === b.dataset.bim);
          E.track('bim_click', `${p.name} · ${sw.label}`);
          if (!getState().visitor.registered) cadenasModal(root, () => doDownload(sw));
          else doDownload(sw);
        }),
      );
      root.querySelectorAll('[data-bim-ask]').forEach((b) => b.addEventListener('click', () => go(`#/site/enquiry?p=${p.id}&bim=1`)));
      function doDownload(sw) {
        E.track('bim_download', `${p.name} · ${sw.label}`, { productId: p.id, software: sw.id });
        update((s) => E.logEvent(s, 'CADENAS', `Download ${sw.label} (${sw.ext}) for ${p.name} → buying signal (+15 score when the visitor is known)`));
        toast(`Download started via CADENAS: <b>${esc(p.name)}</b> ${sw.ext} <span class="muted">(simulated)</span>`);
      }
    },
  };
}

function cadenasModal(root, onDone) {
  const mr = root.querySelector('#modal-root');
  const v = getState().visitor.contact || {};
  mr.innerHTML = `
  <div class="modal-bg"><div class="modal" role="dialog" aria-label="CADENAS registration">
    <div class="modal-head"><b>CADENAS PARTcommunity</b><span class="muted small">V&amp;B BIM catalogue · registration (simulated)</span></div>
    <form id="cad-form" class="form">
      <label>Name<input name="name" required value="${esc(v.name || '')}"></label>
      <label>Email<input name="email" type="email" required value="${esc(v.email || '')}"></label>
      <label>Company<input name="company" value="${esc(v.company || '')}"></label>
      <label>Role<select name="role">${ROLES.map((r) => `<option ${r === (v.role || 'Architect') ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
      <label class="check"><input type="checkbox" required> I accept the CADENAS terms of use</label>
      <p class="muted small">Finding: about 60% of architects drop out here. Pre-filling known visitors is one of the proposed A/B tests.</p>
      <div class="row gap"><button class="btn" type="submit">Register & download</button><button class="btn ghost" type="button" data-close>Cancel</button></div>
    </form>
    <div class="row gap" style="margin-top:8px"><button class="link small" data-fill>Fill demo architect</button></div>
  </div></div>`;
  const form = mr.querySelector('#cad-form');
  mr.querySelector('[data-close]').addEventListener('click', () => (mr.innerHTML = ''));
  mr.querySelector('[data-fill]').addEventListener('click', () => {
    form.name.value = 'Julia Brandt';
    form.email.value = 'julia.brandt@example.com';
    form.company.value = 'Brandt Architekten';
    form.role.value = 'Architect';
    form.querySelector('input[type=checkbox]').checked = true;
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    E.registerCadenas({ name: d.name, email: d.email, company: d.company, role: d.role });
    E.track('bim_register', d.email);
    mr.innerHTML = '';
    onDone();
  });
}

// ---------- saved ----------
function saved() {
  return {
    title: 'Project board',
    reactive: true,
    render() {
      const ids = getState().visitor.saved;
      return `<h1>Project board</h1>
      ${ids.length ? `<p class="lead">${ids.length} saved product(s). Request samples or advice for all of them in one go.</p>
        <div class="row gap"><a class="btn" href="#/site/enquiry?p=${ids.join(',')}">Request samples for these</a></div>
        <div class="pgrid">${ids.map((id) => productCard(productById(id))).join('')}</div>`
        : `<div class="empty"><p>Nothing saved yet. Use ☆ Save on any product.</p><a class="btn" href="#/site/search">Discover tiles</a></div>`}`;
    },
    mount: bindCards,
  };
}

// ---------- enquiry ----------
function enquiry(query) {
  const preset = (query.get('p') || '').split(',').filter((id) => productById(id));
  const bim = query.get('bim') === '1';
  let started = false;
  return {
    title: 'Request samples',
    render() {
      const s = getState();
      const v = s.visitor;
      const c = v.contact || v.registered || {};
      const pool = [...new Set([...preset, ...v.saved])];
      return `
      <section class="enq">
        <div>
          <p class="eyebrow">Samples & advice</p>
          <h1>Tell us about your project</h1>
          <p class="lead">A named advisor contacts you within one working day. You can follow the status of your request online.</p>
          <button class="btn small ghost" id="fill-demo" type="button">Fill with demo architect</button>
        </div>
        <form class="form enq-form" id="enq-form" novalidate>
          <fieldset><legend>What do you need?</legend>
            <div class="row gap wrap">${['Samples', 'Advice', 'BIM support', 'Tender texts'].map((t) => `<label class="check box"><input type="checkbox" name="types" value="${t}" ${t === 'Samples' && !bim ? 'checked' : ''}${t === 'BIM support' && bim ? 'checked' : ''}${t === 'Advice' ? ' checked' : ''}> ${t}</label>`).join('')}</div>
          </fieldset>
          <fieldset><legend>Products</legend>
            ${pool.length ? `<div class="enq-products">${pool.map((id) => { const p = productById(id); return `<label class="enq-prod"><input type="checkbox" name="products" value="${id}" checked><img alt="" src="${thumbURL(p, 120)}"><span>${esc(p.name)}<br><select name="fmt-${id}">${p.collection.formats.map((f) => `<option>${esc(f)}</option>`).join('')}</select></span></label>`; }).join('')}</div>`
              : `<p class="muted">No products selected — that's fine, your advisor will suggest some. <a href="#/site/search">Discover tiles</a></p>`}
          </fieldset>
          <fieldset><legend>Project</legend>
            <div class="grid2">
              <label>Project name *<input name="projectName" required></label>
              <label>Project type<select name="projectType">${PROJECT_TYPES.map((t) => `<option>${t}</option>`).join('')}</select></label>
              <label>Project phase (HOAI) *<select name="phase" required><option value="">Choose…</option>${HOAI.map((h) => `<option value="${h.n}">LP${h.n} – ${h.en} (${h.de})</option>`).join('')}<option value="0">Not sure</option></select></label>
              <label>Area (m²)<input name="area" type="number" min="0" step="10"></label>
              <label>Planned start<input name="start" type="month"></label>
            </div>
            <div class="row gap wrap apps">${Object.entries(APPLICATIONS).map(([k, a]) => `<label class="check box"><input type="checkbox" name="applications" value="${k}"> ${esc(a.label)}</label>`).join('')}</div>
          </fieldset>
          <fieldset><legend>Your details</legend>
            <div class="grid2">
              <label>Name *<input name="name" required value="${esc(c.name || '')}"></label>
              <label>Email *<input name="email" type="email" required value="${esc(c.email || '')}"></label>
              <label>Company<input name="company" value="${esc(c.company || '')}"></label>
              <label>Role<select name="role">${ROLES.map((r) => `<option ${r === (c.role || 'Architect') ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
              <label>Phone <span class="muted">(optional)</span><input name="phone" value="${esc(c.phone || '')}"></label>
              <label>Country<select name="country">${COUNTRIES.map((x) => `<option ${x === (c.country || 'Germany') ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
              <label>Postcode *<input name="postcode" required value="${esc(c.postcode || '')}"></label>
              <label>City<input name="city" value="${esc(c.city || '')}"></label>
            </div>
            <label>Message<textarea name="message" rows="3" placeholder="Anything we should know: deadlines, tender, special requirements"></textarea></label>
          </fieldset>
          <fieldset class="consent"><legend>Consent</legend>
            <label class="check"><input type="checkbox" name="privacy" required> I agree that V&amp;B processes my data to handle this request (privacy notice). *</label>
            <label class="check"><input type="checkbox" name="marketing"> Send me project-relevant news and invitations (double opt-in).</label>
          </fieldset>
          <div class="form-error" id="enq-error" hidden></div>
          <button class="btn big" type="submit">Send request</button>
          <p class="muted small">Posts to the Account Engagement form handler → prospect → Sales Cloud lead with an owner and a due task.</p>
        </form>
      </section>`;
    },
    mount(root) {
      const form = root.querySelector('#enq-form');
      form.addEventListener('input', () => {
        if (!started) {
          started = true;
          E.track('enquiry_start', 'form');
        }
      }, { once: true });
      root.querySelector('#fill-demo').addEventListener('click', () => {
        const set = (n, v) => (form.elements[n].value = v);
        set('projectName', 'Hotel Speicherstadt refurbishment');
        set('projectType', 'Hotel');
        set('phase', '5');
        set('area', '1200');
        set('start', '2027-04');
        set('name', 'Julia Brandt');
        set('email', 'julia.brandt@example.com');
        set('company', 'Brandt Architekten');
        set('role', 'Architect');
        set('phone', '');
        set('country', 'Germany');
        set('postcode', '20457');
        set('city', 'Hamburg');
        set('message', 'Lobby and corridors, plus guest bathrooms. Tender planned for Q1.');
        form.querySelectorAll('input[name=applications]').forEach((i) => (i.checked = ['floor-com', 'wet'].includes(i.value)));
        form.privacy.checked = true;
        form.marketing.checked = true;
        if (!started) {
          started = true;
          E.track('enquiry_start', 'form');
        }
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const err = [];
        const types = fd.getAll('types');
        if (!types.length) err.push('Choose at least one request type.');
        for (const [n, l] of [['projectName', 'Project name'], ['name', 'Name'], ['email', 'Email'], ['postcode', 'Postcode']]) if (!String(fd.get(n) || '').trim()) err.push(`${l} is required.`);
        if (fd.get('phase') === '') err.push('Choose the project phase (or “Not sure”).');
        if (fd.get('email') && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fd.get('email'))) err.push('Email looks invalid.');
        if (!fd.get('privacy')) err.push('Please accept the privacy notice.');
        const box = root.querySelector('#enq-error');
        if (err.length) {
          box.hidden = false;
          box.innerHTML = err.map(esc).join('<br>');
          box.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        const products = fd.getAll('products');
        const sampleFormat = Object.fromEntries(products.map((id) => [id, fd.get(`fmt-${id}`)]));
        const ref = E.submitEnquiry({
          types, products, sampleFormat, projectName: fd.get('projectName'), projectType: fd.get('projectType'),
          phase: fd.get('phase'), area: fd.get('area'), start: fd.get('start'), applications: fd.getAll('applications'),
          name: fd.get('name'), email: fd.get('email'), company: fd.get('company'), role: fd.get('role'), phone: fd.get('phone'),
          country: fd.get('country'), postcode: fd.get('postcode'), city: fd.get('city'), message: fd.get('message'), marketing: !!fd.get('marketing'),
        });
        go(`#/site/workspace/${ref}?new=1`);
      });
    },
  };
}

// ---------- workspace (status only) ----------
function workspace(ref, query) {
  let viewedOnce = false;
  return {
    title: 'My requests',
    reactive: true,
    render() {
      const s = getState();
      const mine = s.visitor.requestIds.map((id) => s.requests.find((r) => r.id === id)).filter(Boolean);
      if (!mine.length) {
        return `<h1>My requests</h1><div class="empty"><p>No requests yet in this browser session.</p><a class="btn" href="#/site/enquiry">Request samples or advice</a></div>`;
      }
      const req = (ref && mine.find((r) => r.ref === ref)) || mine[0];
      const { steps, owner } = publicSteps(s, req);
      const p = s.prospects.find((x) => x.id === req.prospectId);
      const doi = p && p.consent.marketing === 'pending-doi';
      const doneIdx = steps.reduce((acc, st, i) => (st.at ? i : acc), -1);
      return `
      ${query.get('new') ? `<div class="notice ok"><b>Thank you!</b> Request ${esc(req.ref)} received. We're assigning your advisor now.</div>` : ''}
      ${doi ? `<div class="notice"><b>Simulated email:</b> “Please confirm your subscription” <button class="btn small" data-act="doi">Confirm subscription</button></div>` : ''}
      <div class="ws">
        <aside class="ws-list"><h4>My requests</h4>${mine.map((r) => `<a class="${r.id === req.id ? 'active' : ''}" href="#/site/workspace/${r.ref}"><b>${esc(r.ref)}</b><span>${esc(r.project.name)}</span><span class="muted small">${fmtDateTime(r.t)}</span></a>`).join('')}</aside>
        <section>
          <p class="eyebrow">Request ${esc(req.ref)} · ${esc(req.types.join(' + '))}</p>
          <h1>${esc(req.project.name)}</h1>
          <ol class="tracker">
            ${steps.map((st, i) => `<li class="${st.at ? 'done' : i === doneIdx + 1 ? 'current' : ''}"><span class="dot">${st.at ? '✓' : i + 1}</span><div><b>${esc(st.label)}</b><span class="muted small">${st.at ? fmtDateTime(st.at) : i === doneIdx + 1 ? 'in progress' : ''}</span><p>${esc(st.desc)}</p></div></li>`).join('')}
            <li class="later"><span class="dot">·</span><div><b>Offer, order &amp; delivery tracking</b><p class="muted small">Later phase, once the SAP chain is connected.</p></div></li>
          </ol>
          <p class="muted small">You see the status of your request. Internal sales stages are not shown.</p>
        </section>
        <aside class="ws-side">
          ${owner ? `<div class="advisor"><span class="avatar" style="background:${owner.color}">${owner.initials}</span><div><b>${esc(owner.name)}</b><span class="muted small">${esc(owner.publicRole)}</span><a href="tel:${esc(owner.phone)}">${esc(owner.phone)}</a><a href="mailto:${esc(owner.email)}">${esc(owner.email)}</a></div></div>` : `<div class="advisor pending"><span class="spinner"></span><div><b>Assigning your advisor…</b><span class="muted small">Account Engagement → Sales Cloud sync</span></div></div>`}
          <div class="card"><h4>Your request</h4>
            <dl class="dl">
              <dt>Phase</dt><dd>${esc(hoaiLabel(req.project.phase))}</dd>
              <dt>Area</dt><dd>${req.project.area ? fmtNum(req.project.area) + ' m²' : '—'}</dd>
              <dt>Use</dt><dd>${req.project.applications.map((a) => esc(APPLICATIONS[a]?.label)).join(', ') || '—'}</dd>
            </dl>
            ${req.products.length ? `<div class="mini-products">${req.products.map((id) => { const pr = productById(id); return `<a href="#/site/product/${id}" title="${esc(pr.name)}"><img alt="" src="${thumbURL(pr, 80)}"><span>${esc(pr.name)}</span></a>`; }).join('')}</div>` : ''}
          </div>
        </aside>
      </div>`;
    },
    mount(root) {
      root.querySelector('[data-act="doi"]')?.addEventListener('click', () => {
        const s = getState();
        E.confirmDoubleOptIn(s.visitor.prospectId);
        toast('Subscription confirmed');
      });
      if (!viewedOnce) {
        viewedOnce = true;
        E.track('workspace_view', ref || '');
      }
    },
  };
}

function notFound() {
  return { title: 'Not found', render: () => `<div class="empty"><h2>Not found</h2><a class="btn" href="#/site">Home</a></div>` };
}

export function resolve(r) {
  const [, a, b] = r.parts;
  if (!a) return home();
  if (a === 'search') return search(r.query.get('q') || '');
  if (a === 'photo') return photo();
  if (a === 'collections') return collections();
  if (a === 'collection') return collection(b);
  if (a === 'product') return product(b);
  if (a === 'saved') return saved();
  if (a === 'enquiry') return enquiry(r.query);
  if (a === 'workspace') return workspace(b, r.query);
  return notFound();
}
