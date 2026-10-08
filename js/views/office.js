// Back office: simulated Account Engagement + Sales Cloud + customer service,
// assignment rules, AI insights and an integration log with a live system map.
import { getState, now, resetAll } from '../store.js';
import { esc, fmtDateTime, fmtDuration, fmtAgo, fmtNum, fmtEur, fmtPct, median, toast } from '../util.js';
import { productById, APPLICATIONS } from '../data/catalog.js';
import { thumbURL } from '../textures.js';
import { OWNERS, ownerById, OPP_STAGES, REGIONS, SEGMENTS, hoaiLabel, NURTURE_EMAILS, publicSteps, applyRules, SCORE } from '../domain.js';
import { journeyFunnel } from '../ai.js';
import * as E from '../engine.js';

const go = (h) => (location.hash = h);
export const mainClass = 'office-main';

// ---------- chrome ----------
export function chromeTop(path) {
  const s = getState();
  const t = now(s);
  const openLeads = s.leads.filter((l) => l.status === 'New').length;
  const overdue = s.tasks.filter((k) => k.status === 'Open' && k.due < t).length;
  const newOrders = s.orders.filter((o) => o.status === 'New').length;
  const item = (href, label, badge, cls = '') => `<a class="${path === href || (href !== '/office' && path.startsWith(href)) ? 'active' : ''} ${cls}" href="#${href}">${label}${badge ? `<span class="nb">${badge}</span>` : ''}</a>`;
  const pending = s.jobs.length;
  return `
  <header class="of-top">
    <div class="of-brand"><span class="of-grid">⋮⋮⋮</span><b>V&amp;B Back office</b><span class="of-sub">Concept prototype · simulated Salesforce org · not a V&amp;B system</span></div>
    <div class="of-clock">
      ${pending ? `<span class="sync-pill" title="Connector jobs waiting">⟳ ${pending} sync job${pending > 1 ? 's' : ''} pending <button class="link" data-act="sync-now">run now</button></span>` : ''}
      <span title="Demo clock">🕑 ${new Date(t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
      <button class="btn tiny ghost" data-act="ff" title="Move the demo clock forward one working day">+1 day</button>
    </div>
  </header>
  <nav class="of-nav">
    ${item('/office', '🏠 Home')}
    <div class="of-sec">Account Engagement</div>
    ${item('/office/prospects', '👤 Prospects')}
    <div class="of-sec">Sales Cloud</div>
    ${item('/office/leads', '📥 Leads', openLeads)}
    ${item('/office/opps', '📈 Opportunities')}
    ${item('/office/tasks', '✅ Tasks', overdue ? `${overdue}!` : '', overdue ? 'warn' : '')}
    <div class="of-sec">Service</div>
    ${item('/office/service', '📦 Sample orders', newOrders)}
    <div class="of-sec">Insights & admin</div>
    ${item('/office/insights', '📊 Journey insights')}
    ${item('/office/integration', '🔌 Integration & map')}
    ${item('/office/rules', '⚙️ Rules & scoring')}
    <div class="of-foot"><button class="link small" data-act="reset">Reset demo data</button></div>
  </nav>`;
}

export function chromeBottom() {
  return '';
}

export function bindChrome(root) {
  root.querySelector('[data-act="ff"]')?.addEventListener('click', () => {
    E.fastForward(24);
    toast('Clock moved forward 24 h — check SLA on tasks');
  });
  root.querySelector('[data-act="sync-now"]')?.addEventListener('click', () => E.syncNow());
  root.querySelector('[data-act="reset"]')?.addEventListener('click', () => {
    if (confirm('Reset all demo data (both website and back office)?')) {
      resetAll();
      toast('Demo data reset');
      go('#/office');
    }
  });
}

// ---------- helpers ----------
const owner = (id) => {
  const o = ownerById(id);
  return `<span class="owner"><span class="avatar sm" style="background:${o.color}">${o.initials}</span>${esc(o.name)}</span>`;
};
const statusBadge = (st) => `<span class="badge st-${st.toLowerCase().replace(/[^a-z]/g, '')}">${esc(st)}</span>`;
const prioBadge = (p) => (p ? `<span class="badge pr-${p.toLowerCase()}">${p}</span>` : '<span class="muted">—</span>');
function slaCell(task, t) {
  if (!task) return '<span class="muted">—</span>';
  if (task.status === 'Done') return `<span class="sla ok">done ${fmtDuration(task.doneAt - task.createdAt)}</span>`;
  const left = task.due - t;
  return left < 0 ? `<span class="sla bad">overdue ${fmtDuration(-left)}</span>` : `<span class="sla ${left < 4 * 3600e3 ? 'warn' : ''}">due in ${fmtDuration(left)}</span>`;
}
const firstTask = (s, leadId) => s.tasks.find((k) => k.leadId === leadId && k.kind === 'first-contact');
const isLive = (x) => !x.seed;

// ---------- home ----------
function home() {
  return {
    title: 'Home',
    reactive: true,
    render() {
      const s = getState();
      const t = now(s);
      const contactTimes = s.leads.filter((l) => l.firstContactAt).map((l) => l.firstContactAt - l.createdAt);
      const med = median(contactTimes);
      const needs = s.leads.filter((l) => !l.firstContactAt && !['Disqualified'].includes(l.status)).sort((a, b) => (firstTask(s, a.id)?.due || 0) - (firstTask(s, b.id)?.due || 0));
      const overdue = s.tasks.filter((k) => k.status === 'Open' && k.due < t).length;
      const decided = s.leads.filter((l) => l.ai && l.ai.status !== 'pending');
      const accepted = decided.filter((l) => l.ai.status === 'accepted').length;
      const openOpps = s.opps.filter((o) => !o.lost && o.stage < 9);
      const pipe = openOpps.reduce((a, o) => a + o.amount, 0);
      const byStage = OPP_STAGES.map((_, i) => s.opps.filter((o) => !o.lost && o.stage === i + 1));
      const maxStage = Math.max(1, ...byStage.map((x) => x.length));
      return `
      <h1>Good morning — sales overview</h1>
      <div class="kpis">
        <div class="kpi"><span>Leads waiting for first contact</span><b>${needs.length}</b></div>
        <div class="kpi ${overdue ? 'bad' : ''}"><span>Overdue tasks</span><b>${overdue}</b></div>
        <div class="kpi"><span>Median time to first contact</span><b>${med ? fmtDuration(med) : '—'}</b><em>target: 1 working day</em></div>
        <div class="kpi"><span>Open sample orders</span><b>${s.orders.filter((o) => o.status !== 'Delivered').length}</b></div>
        <div class="kpi"><span>Open pipeline</span><b>${fmtEur(pipe)}</b><em>${openOpps.length} opportunities</em></div>
        <div class="kpi"><span>AI suggestions accepted</span><b>${decided.length ? fmtPct(accepted / decided.length) : '—'}</b><em>${accepted}/${decided.length}</em></div>
      </div>
      <div class="cols2">
        <section class="card">
          <h3>Needs first contact</h3>
          ${needs.length ? `<table class="tbl"><thead><tr><th>Lead</th><th>Project</th><th>Owner</th><th>Priority</th><th>SLA</th></tr></thead><tbody>
            ${needs.slice(0, 8).map((l) => `<tr class="${isLive(l) ? 'live' : ''}"><td><a href="#/office/leads/${l.id}">${esc(l.name)}</a><div class="muted small">${esc(l.company)}</div></td><td>${esc(l.project.name || '—')}<div class="muted small">${esc(hoaiLabel(l.project.phase))}</div></td><td>${owner(l.ownerId)}</td><td>${prioBadge(l.priority)}</td><td>${slaCell(firstTask(s, l.id), t)}</td></tr>`).join('')}
          </tbody></table>` : '<p class="muted">All leads contacted. 🎉</p>'}
        </section>
        <section class="card">
          <h3>Pipeline by stage <span class="muted small">(9 stages · placeholder names, to confirm with V&amp;B)</span></h3>
          <div class="stagebars">${byStage.map((arr, i) => `<div><span>${i + 1}. ${esc(OPP_STAGES[i])}</span><i style="width:${(arr.length / maxStage) * 100}%"></i><b>${arr.length}</b></div>`).join('')}</div>
        </section>
      </div>
      <section class="card">
        <h3>Live integration feed <a class="small" href="#/office/integration">open log & system map →</a></h3>
        ${eventList(s.events.slice(0, 8), t)}
      </section>`;
    },
  };
}

function eventList(events, t) {
  return `<ul class="feed">${events
    .map((e) => `<li><span class="sys sys-${e.system.toLowerCase().replace(/[^a-z]/g, '')}">${esc(e.system)}</span><span>${esc(e.message)}</span><span class="muted small">${fmtAgo(e.t, t)}</span></li>`)
    .join('')}</ul>`;
}

// ---------- prospects ----------
function prospects(query) {
  const filter = query.get('f') || 'all';
  return {
    title: 'Prospects',
    reactive: true,
    render() {
      const s = getState();
      const t = now(s);
      let list = s.prospects;
      if (filter === 'nurture') list = list.filter((p) => !p.leadId && !p.syncQueued);
      if (filter === 'sales') list = list.filter((p) => p.leadId || p.syncQueued);
      const th = s.settings.threshold;
      return `
      <div class="page-head"><div><p class="eyebrow">Account Engagement</p><h1>Prospects</h1></div>
        <div class="tabs">${[['all', 'All'], ['nurture', 'Nurturing'], ['sales', 'Sent to sales']].map(([k, l]) => `<a class="${filter === k ? 'active' : ''}" href="#/office/prospects?f=${k}">${l}</a>`).join('')}</div></div>
      <p class="muted">Score threshold for sales: <b>${th}</b>. Hand-raisers (sample/advice requests) go to sales immediately; downloads and visits stay in nurture until the threshold.</p>
      <table class="tbl"><thead><tr><th>Prospect</th><th>Score</th><th>Grade</th><th>Marketing consent</th><th>Programme</th><th>Status</th><th>Last activity</th></tr></thead><tbody>
      ${list.map((p) => `<tr class="${isLive(p) ? 'live' : ''}">
        <td><a href="#/office/prospects/${p.id}">${esc(p.name)}</a><div class="muted small">${esc(p.company)} · ${esc(p.role)}</div></td>
        <td><div class="scorebar"><i style="width:${Math.min(100, (p.score / (th * 1.5)) * 100)}%" class="${p.score >= th ? 'hot' : ''}"></i><span>${p.score}</span></div></td>
        <td><span class="grade g-${p.grade}">${p.grade}</span></td>
        <td>${consentBadge(p.consent.marketing)}</td>
        <td class="small">${esc(p.programme)}</td>
        <td>${p.leadId ? '<span class="badge st-working">Lead in Sales Cloud</span>' : p.syncQueued ? '<span class="badge st-new">Sync queued</span>' : '<span class="badge">Nurturing</span>'}</td>
        <td class="small">${fmtAgo(p.lastActivity, t)}</td></tr>`).join('')}
      </tbody></table>`;
    },
  };
}

const consentBadge = (c) =>
  c === 'confirmed' ? '<span class="badge ok">Opted in</span>' : c === 'pending-doi' ? '<span class="badge warn">Pending double opt-in</span>' : '<span class="badge">No marketing consent</span>';

function prospect(id) {
  return {
    title: 'Prospect',
    reactive: true,
    render() {
      const s = getState();
      const p = s.prospects.find((x) => x.id === id);
      if (!p) return '<p>Prospect not found.</p>';
      const emails = NURTURE_EMAILS[p.programme] || [];
      const th = s.settings.threshold;
      return `
      <p class="crumbs"><a href="#/office/prospects">Prospects</a> / ${esc(p.name)}</p>
      <div class="page-head"><div><p class="eyebrow">Account Engagement · prospect</p><h1>${esc(p.name)}</h1><p class="muted">${esc(p.email)} · ${esc(p.company)} · ${esc(p.role)} · ${esc(p.city || '')}</p></div>
        <div class="row gap">${p.leadId ? `<a class="btn" href="#/office/leads/${p.leadId}">Open lead in Sales Cloud</a>` : `<button class="btn" data-act="to-sales" ${p.syncQueued ? 'disabled' : ''}>${p.syncQueued ? 'Sync queued…' : 'Send to sales now'}</button>`}</div></div>
      <div class="cols3">
        <div class="card stat"><span>Score</span><b>${p.score}</b><div class="scorebar"><i style="width:${Math.min(100, (p.score / th) * 100)}%" class="${p.score >= th ? 'hot' : ''}"></i></div><em>threshold ${th}</em></div>
        <div class="card stat"><span>Grade</span><b class="grade g-${p.grade}">${p.grade}</b><em>${esc(p.segment)} · ${p.area ? fmtNum(p.area) + ' m²' : 'area unknown'} · ${esc(hoaiLabel(p.phase))}</em></div>
        <div class="card stat"><span>Consent</span><b>${consentBadge(p.consent.marketing)}</b><em>Privacy: ${p.consent.privacy ? 'accepted' : '—'} · Sales Cloud reads consent only</em></div>
      </div>
      <div class="cols2">
        <section class="card"><h3>Engagement history</h3>
          <ul class="timeline">${p.activities.map((a) => `<li><b>+${a.points}</b><span>${esc(a.detail)}</span><span class="muted small">${fmtDateTime(a.t)}</span></li>`).join('') || '<li class="muted">No activity yet</li>'}</ul></section>
        <section class="card"><h3>Nurture programme: ${esc(p.programme)}</h3>
          <p class="muted small">Nurture by HOAI phase. Only with confirmed marketing consent.</p>
          <ol class="nurture">${emails.map((e, i) => `<li><span>${esc(e)}</span>${p.consent.marketing === 'confirmed' && !p.leadId ? `<button class="btn tiny ghost" data-click="${esc(e)}">Simulate click (+${SCORE.email_click})</button>` : ''}</li>`).join('')}</ol>
          ${p.consent.marketing !== 'confirmed' ? '<p class="notice small">Not mailed: no confirmed marketing consent.</p>' : ''}
          <h4>Scoring rules</h4><table class="tbl compact">${Object.entries(SCORE).map(([k, v]) => `<tr><td>${k.replace(/_/g, ' ')}</td><td>+${v}</td></tr>`).join('')}</table>
        </section>
      </div>`;
    },
    mount(root) {
      root.querySelector('[data-act="to-sales"]')?.addEventListener('click', () => {
        E.sendToSales(id);
        toast('Queued for the next connector sync');
      });
      root.querySelectorAll('[data-click]').forEach((b) => b.addEventListener('click', () => E.simulateEmailClick(id, b.dataset.click)));
    },
  };
}

// ---------- leads ----------
function leads(query) {
  const f = query.get('f') || 'open';
  const ow = query.get('owner') || '';
  return {
    title: 'Leads',
    reactive: true,
    render() {
      const s = getState();
      const t = now(s);
      let list = s.leads;
      if (f === 'open') list = list.filter((l) => ['New', 'Working', 'Qualified'].includes(l.status));
      else if (f !== 'all') list = list.filter((l) => l.status.toLowerCase() === f);
      if (ow) list = list.filter((l) => l.ownerId === ow);
      return `
      <div class="page-head"><div><p class="eyebrow">Sales Cloud</p><h1>Leads</h1></div>
        <div class="row gap">
          <div class="tabs">${[['open', 'Open'], ['new', 'New'], ['working', 'Working'], ['converted', 'Converted'], ['all', 'All']].map(([k, l]) => `<a class="${f === k ? 'active' : ''}" href="#/office/leads?f=${k}${ow ? '&owner=' + ow : ''}">${l}</a>`).join('')}</div>
          <select id="owner-filter"><option value="">All owners</option>${OWNERS.map((o) => `<option value="${o.id}" ${ow === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select>
        </div></div>
      <table class="tbl"><thead><tr><th>Lead</th><th>Project</th><th>Region · segment</th><th>Owner</th><th>Status</th><th>AI priority</th><th>First contact SLA</th><th>Created</th></tr></thead><tbody>
      ${list.map((l) => `<tr class="${isLive(l) ? 'live' : ''}">
        <td><a href="#/office/leads/${l.id}">${esc(l.name)}</a><div class="muted small">${esc(l.ref)} · ${esc(l.company)}</div></td>
        <td>${esc(l.project.name || '—')}<div class="muted small">${esc(hoaiLabel(l.project.phase))}${l.project.area ? ' · ' + fmtNum(l.project.area) + ' m²' : ''}</div></td>
        <td class="small">${esc(l.region)} · ${esc(l.segment)}</td>
        <td>${owner(l.ownerId)}</td>
        <td>${statusBadge(l.status)}</td>
        <td>${l.ai ? prioBadge(l.priority) : '<span class="muted small">analysing…</span>'}</td>
        <td>${slaCell(firstTask(s, l.id), t)}</td>
        <td class="small">${fmtAgo(l.createdAt, t)}</td></tr>`).join('') || '<tr><td colspan="8" class="muted">No leads</td></tr>'}
      </tbody></table>`;
    },
    mount(root) {
      root.querySelector('#owner-filter').addEventListener('change', (e) => go(`#/office/leads?f=${f}${e.target.value ? '&owner=' + e.target.value : ''}`));
    },
  };
}

function lead(id) {
  return {
    title: 'Lead',
    reactive: true,
    render() {
      const s = getState();
      const l = s.leads.find((x) => x.id === id);
      if (!l) return '<p>Lead not found.</p>';
      const t = now(s);
      const p = s.prospects.find((x) => x.id === l.prospectId);
      const tasks = s.tasks.filter((k) => k.leadId === l.id);
      const order = s.orders.find((o) => o.leadId === l.id);
      const reqs = l.requestIds.map((rid) => s.requests.find((r) => r.id === rid)).filter(Boolean);
      const path = ['New', 'Working', 'Qualified', 'Converted'];
      const pi = path.indexOf(l.status);
      const ai = l.ai;
      return `
      <p class="crumbs"><a href="#/office/leads">Leads</a> / ${esc(l.ref)}</p>
      <div class="page-head"><div><p class="eyebrow">Sales Cloud · lead ${esc(l.ref)} · ${esc(l.source)}</p><h1>${esc(l.name)} <span class="muted">· ${esc(l.company)}</span></h1></div>
        <div class="row gap">
          <label class="inline">Owner <select id="owner-sel">${OWNERS.map((o) => `<option value="${o.id}" ${o.id === l.ownerId ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></label>
          ${l.oppId ? `<a class="btn" href="#/office/opps/${l.oppId}">Open opportunity</a>` : `<button class="btn" data-act="convert">Convert to opportunity</button>`}
        </div></div>
      <ol class="path">${path.map((st, i) => `<li class="${i < pi ? 'done' : i === pi ? 'current' : ''}">${st}</li>`).join('')}${l.status === 'Disqualified' ? '<li class="current bad">Disqualified</li>' : ''}</ol>
      <div class="lead-grid">
        <div>
          <section class="card ai-card ${ai ? 'ai-' + ai.status : ''}">
            <h3>✨ Enquiry assistant <span class="ai-badge">${ai ? esc(ai.model) : 'AI'}</span></h3>
            ${!ai ? '<p class="muted"><span class="spinner"></span> Summarising enquiry…</p>' : `
              <p class="ai-summary">${esc(ai.summary)}</p>
              <div class="ai-cols">
                <div><h4>Priority ${prioBadge(ai.priority)}</h4><ul class="small">${(ai.priorityWhy || []).map((w) => `<li>${esc(w)}</li>`).join('') || '<li class="muted">—</li>'}</ul></div>
                <div><h4>Missing details</h4><ul class="small">${ai.missing.map((m) => `<li class="warn">${esc(m)}</li>`).join('') || '<li class="ok">Complete</li>'}</ul></div>
              </div>
              ${ai.checks.length ? `<h4>Product checks</h4><ul class="checks">${ai.checks.map((c) => `<li class="${c.ok ? 'ok' : 'warn'}">${c.ok ? '✓' : '⚠'} ${esc(c.text)}</li>`).join('')}</ul>` : ''}
              <h4>Suggested owner</h4><p>${owner(ai.suggestedOwnerId)} <span class="muted small">via assignment rule ${l.ruleIndex ?? '—'} (${esc(l.region)} + ${esc(l.segment)})</span></p>
              <h4>Suggested next steps</h4><ol class="small">${ai.nextSteps.map((n) => `<li>${esc(n.text)}${n.task ? ' <span class="muted">(→ task)</span>' : ''}</li>`).join('')}</ol>
              ${ai.status === 'pending' ? `<div class="row gap"><button class="btn" data-act="ai-accept">Accept suggestion</button><button class="btn ghost" data-act="ai-dismiss">Dismiss</button><span class="muted small">Sales confirms; nothing is sent to the customer automatically.</span></div>`
                : `<p class="muted small">Suggestion ${ai.status}. Cost ≈ USD ${(ai.costUSD || 0).toFixed(4)}.</p>`}
            `}
          </section>
          <section class="card">
            <h3>Actions</h3>
            <div class="actions">
              <div class="act">
                <textarea id="call-note" rows="2" placeholder="Call notes (e.g. confirmed lobby + corridors, tender in Q1)"></textarea>
                <button class="btn" data-act="call">📞 Log call</button>
              </div>
              <div class="row gap wrap">
                <button class="btn ghost" data-act="draft">✉️ Draft email for missing details</button>
                <button class="btn ghost" data-act="samples" ${order && order.status !== 'Delivered' ? 'disabled' : ''}>📦 ${order ? 'Samples ordered' : 'Release samples to customer service'}</button>
                ${l.status === 'Working' ? '<button class="btn ghost" data-act="qualify">Mark qualified</button>' : ''}
                ${!['Converted', 'Disqualified'].includes(l.status) ? '<button class="btn ghost danger" data-act="dq">Disqualify</button>' : ''}
              </div>
            </div>
            ${l.drafts.length ? `<div class="draft"><b>Draft (not sent):</b> ${esc(l.drafts[0].subject)}<pre>${esc(l.drafts[0].body)}</pre></div>` : ''}
          </section>
          <section class="card"><h3>Tasks</h3>
            <table class="tbl compact"><tbody>${tasks.map((k) => `<tr><td>${k.status === 'Done' ? '✅' : `<button class="btn tiny ghost" data-done="${k.id}">Done</button>`}</td><td>${esc(k.subject)}</td><td>${owner(k.ownerId)}</td><td>${k.status === 'Done' ? `<span class="muted small">${fmtDateTime(k.doneAt)}</span>` : slaCell(k, t)}</td></tr>`).join('')}</tbody></table>
          </section>
        </div>
        <div>
          <section class="card"><h3>Enquiry</h3>
            <dl class="dl">
              <dt>Project</dt><dd>${esc(l.project.name || '—')} ${l.project.type ? `<span class="muted">(${esc(l.project.type)})</span>` : ''}</dd>
              <dt>Phase</dt><dd>${esc(hoaiLabel(l.project.phase))}</dd>
              <dt>Area</dt><dd>${l.project.area ? fmtNum(l.project.area) + ' m²' : '—'}</dd>
              <dt>Start</dt><dd>${esc(l.project.start || '—')}</dd>
              <dt>Use</dt><dd>${(l.project.applications || []).map((a) => esc(APPLICATIONS[a]?.label)).join(', ') || '—'}</dd>
              <dt>Contact</dt><dd>${esc(l.email)}<br>${esc(l.phone || 'no phone')}<br>${esc(l.postcode)} ${esc(l.city)}, ${esc(l.country)}</dd>
              <dt>Requests</dt><dd>${reqs.map((r) => `${esc(r.ref)} · ${esc(r.types.join(' + '))}`).join('<br>') || '—'}</dd>
              ${l.message ? `<dt>Message</dt><dd>“${esc(l.message)}”</dd>` : ''}
            </dl>
            ${l.products.length ? `<div class="mini-products">${l.products.map((pid) => { const pr = productById(pid); return pr ? `<div><img alt="" src="${thumbURL(pr, 80)}"><span>${esc(pr.name)}${l.samples.find((x) => x.productId === pid) ? ` · sample ${esc(l.samples.find((x) => x.productId === pid).format)}` : ''}</span></div>` : ''; }).join('')}</div>` : ''}
          </section>
          ${p ? `<section class="card"><h3>From Account Engagement <span class="muted small">(read-only)</span></h3>
            <div class="row gap"><span>Score <b>${p.score}</b></span><span>Grade <b class="grade g-${p.grade}">${p.grade}</b></span>${consentBadge(p.consent.marketing)}</div>
            <ul class="timeline compact">${p.activities.slice(0, 6).map((a) => `<li><b>+${a.points}</b><span>${esc(a.detail)}</span><span class="muted small">${fmtDateTime(a.t)}</span></li>`).join('')}</ul>
            <a class="small" href="#/office/prospects/${p.id}">Open prospect →</a></section>` : ''}
          ${reqs[0] ? `<section class="card arch-view"><h3>👁 What the architect sees</h3>${publicPreview(s, reqs[0])}</section>` : ''}
          <section class="card"><h3>History</h3><ul class="timeline compact">${l.history.map((h) => `<li><span>${esc(h.text)}</span><span class="muted small">${fmtDateTime(h.t)}</span></li>`).join('')}</ul></section>
        </div>
      </div>`;
    },
    mount(root) {
      const on = (sel, fn) => root.querySelector(sel)?.addEventListener('click', fn);
      on('[data-act="ai-accept"]', () => { E.acceptAI(id); toast('Suggestion accepted — tasks created'); });
      on('[data-act="ai-dismiss"]', () => E.dismissAI(id));
      on('[data-act="call"]', () => { E.logCall(id, root.querySelector('#call-note').value.trim()); toast('Call logged · architect sees “Advisor in contact”'); });
      on('[data-act="draft"]', () => { E.draftMissingDetails(id); toast('Draft prepared — review and send from your mailbox'); });
      on('[data-act="samples"]', () => E.createSampleOrder(id));
      on('[data-act="qualify"]', () => E.setLeadStatus(id, 'Qualified'));
      on('[data-act="dq"]', () => E.setLeadStatus(id, 'Disqualified'));
      on('[data-act="convert"]', () => {
        const oppId = E.convertLead(id);
        toast('Converted to opportunity (stage 1/9)');
        if (oppId) go(`#/office/opps/${oppId}`);
      });
      root.querySelector('#owner-sel')?.addEventListener('change', (e) => { E.reassign(id, e.target.value); toast('Owner changed'); });
      root.querySelectorAll('[data-done]').forEach((b) => b.addEventListener('click', () => E.completeTask(b.dataset.done)));
    },
  };
}

function publicPreview(s, req) {
  const { steps } = publicSteps(s, req);
  return `<ol class="tracker mini">${steps.map((st) => `<li class="${st.at ? 'done' : ''}"><span class="dot">${st.at ? '✓' : ''}</span><div><b>${esc(st.label)}</b></div></li>`).join('')}</ol><p class="muted small">Status only — stages, scores and notes stay internal.</p>`;
}

// ---------- opportunities ----------
function opps() {
  return {
    title: 'Opportunities',
    reactive: true,
    render() {
      const s = getState();
      return `
      <div class="page-head"><div><p class="eyebrow">Sales Cloud</p><h1>Opportunities</h1><p class="muted">Nine stages — names are placeholders until V&amp;B shares its stage list and exit criteria.</p></div></div>
      <div class="kanban">${OPP_STAGES.map((st, i) => {
        const items = s.opps.filter((o) => o.stage === i + 1);
        const sum = items.filter((o) => !o.lost).reduce((a, o) => a + o.amount, 0);
        return `<div class="kcol"><div class="khead"><b>${i + 1}. ${esc(st)}</b><span class="muted small">${items.length} · ${fmtEur(sum)}</span></div>
          ${items.map((o) => `<div class="kcard ${o.lost ? 'lost' : ''} ${isLive(o) ? 'live' : ''}"><a href="#/office/opps/${o.id}">${esc(o.name)}</a><span class="muted small">${fmtNum(o.area)} m² · ${fmtEur(o.amount)}</span>${owner(o.ownerId)}
            <div class="row gap"><button class="btn tiny ghost" data-mv="${o.id}" data-d="-1" ${o.stage === 1 ? 'disabled' : ''}>◀</button><button class="btn tiny ghost" data-mv="${o.id}" data-d="1" ${o.stage === 9 ? 'disabled' : ''}>▶</button></div></div>`).join('')}
        </div>`;
      }).join('')}</div>`;
    },
    mount(root) {
      root.querySelectorAll('[data-mv]').forEach((b) => b.addEventListener('click', () => E.moveOpp(b.dataset.mv, Number(b.dataset.d))));
    },
  };
}

function opp(id) {
  return {
    title: 'Opportunity',
    reactive: true,
    render() {
      const s = getState();
      const o = s.opps.find((x) => x.id === id);
      if (!o) return '<p>Opportunity not found.</p>';
      const l = s.leads.find((x) => x.id === o.leadId);
      const req = l && s.requests.find((r) => r.id === l.requestIds[0]);
      return `
      <p class="crumbs"><a href="#/office/opps">Opportunities</a> / ${esc(o.ref)}</p>
      <div class="page-head"><div><p class="eyebrow">Sales Cloud · opportunity ${esc(o.ref)}</p><h1>${esc(o.name)}</h1></div>
        <div class="row gap"><button class="btn ghost" data-d="-1">◀ Back</button><button class="btn" data-d="1">Next stage ▶</button><button class="btn ghost danger" data-act="lost">${o.lost ? 'Reopen' : 'Mark lost'}</button></div></div>
      <ol class="path nine">${OPP_STAGES.map((st, i) => `<li class="${i + 1 < o.stage ? 'done' : i + 1 === o.stage ? 'current' : ''}" title="${esc(st)}">${i + 1}. ${esc(st)}</li>`).join('')}</ol>
      <div class="cols2">
        <section class="card"><h3>Details</h3><dl class="dl">
          <dt>Account</dt><dd>${esc(o.account)}</dd><dt>Owner</dt><dd>${owner(o.ownerId)}</dd>
          <dt>Area</dt><dd>${fmtNum(o.area)} m²</dd><dt>Amount</dt><dd>${fmtEur(o.amount)} <span class="muted small">(placeholder EUR/m²)</span></dd>
          <dt>Close date</dt><dd>${fmtDateTime(o.closeDate)}</dd>
          <dt>Products</dt><dd>${o.products.map((pid) => esc(productById(pid)?.name || pid)).join(', ') || '—'}</dd>
          ${l ? `<dt>Lead</dt><dd><a href="#/office/leads/${l.id}">${esc(l.ref)} · ${esc(l.name)}</a></dd>` : ''}
          <dt>Status</dt><dd>${o.lost ? '<span class="badge bad">Lost</span>' : `Stage ${o.stage}/9`}</dd>
        </dl>
        <h4>Stage history</h4><ul class="timeline compact">${[...o.history].reverse().map((h) => `<li><span>Stage ${h.stage}: ${esc(OPP_STAGES[h.stage - 1])}</span><span class="muted small">${fmtDateTime(h.t)}</span></li>`).join('')}</ul>
        <p class="muted small">Offers, orders and delivery status come from V&amp;B’s SAP order chain in a later phase.</p></section>
        ${req ? `<section class="card arch-view"><h3>👁 What the architect sees</h3>${publicPreview(s, req)}</section>` : ''}
      </div>`;
    },
    mount(root) {
      root.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => E.moveOpp(id, Number(b.dataset.d))));
      root.querySelector('[data-act="lost"]')?.addEventListener('click', () => E.setOppLost(id));
    },
  };
}

// ---------- tasks ----------
function tasks(query) {
  const ow = query.get('owner') || '';
  return {
    title: 'Tasks',
    reactive: true,
    render() {
      const s = getState();
      const t = now(s);
      let list = s.tasks;
      if (ow) list = list.filter((k) => k.ownerId === ow);
      const open = list.filter((k) => k.status === 'Open').sort((a, b) => a.due - b.due);
      const overdue = open.filter((k) => k.due < t);
      const upcoming = open.filter((k) => k.due >= t);
      const done = list.filter((k) => k.status === 'Done').sort((a, b) => b.doneAt - a.doneAt).slice(0, 12);
      const row = (k) => {
        const l = s.leads.find((x) => x.id === k.leadId);
        return `<tr class="${isLive(k) ? 'live' : ''}"><td>${k.status === 'Done' ? '✅' : `<button class="btn tiny ghost" data-done="${k.id}">Done</button>`}</td><td>${esc(k.subject)}</td><td>${l ? `<a href="#/office/leads/${l.id}">${esc(l.name)}</a>` : '—'}</td><td>${owner(k.ownerId)}</td><td>${slaCell(k, t)}</td></tr>`;
      };
      const table = (arr) => `<table class="tbl"><tbody>${arr.map(row).join('') || '<tr><td class="muted">None</td></tr>'}</tbody></table>`;
      return `
      <div class="page-head"><div><p class="eyebrow">Sales Cloud</p><h1>Tasks</h1><p class="muted">The due task is the tracked next action. First contact: within 1 working day (service level to agree with V&amp;B).</p></div>
        <select id="owner-filter"><option value="">All owners</option>${OWNERS.map((o) => `<option value="${o.id}" ${ow === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></div>
      <h3 class="${overdue.length ? 'bad-text' : ''}">Overdue (${overdue.length})</h3>${table(overdue)}
      <h3>Upcoming (${upcoming.length})</h3>${table(upcoming)}
      <h3>Recently done</h3>${table(done)}`;
    },
    mount(root) {
      root.querySelector('#owner-filter').addEventListener('change', (e) => go(`#/office/tasks${e.target.value ? '?owner=' + e.target.value : ''}`));
      root.querySelectorAll('[data-done]').forEach((b) => b.addEventListener('click', () => E.completeTask(b.dataset.done)));
    },
  };
}

// ---------- service ----------
function service() {
  return {
    title: 'Sample orders',
    reactive: true,
    render() {
      const s = getState();
      const t = now(s);
      const next = { New: 'Start picking', Picking: 'Ship (DHL)', Shipped: 'Mark delivered' };
      return `
      <div class="page-head"><div><p class="eyebrow">Customer service</p><h1>Sample orders</h1><p class="muted">Samples are dispatched by customer service; each step updates the architect's status page.</p></div></div>
      <table class="tbl"><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Status</th><th>Tracking</th><th>Created</th><th></th></tr></thead><tbody>
      ${s.orders.map((o) => {
        const l = s.leads.find((x) => x.id === o.leadId);
        return `<tr class="${isLive(o) ? 'live' : ''}"><td>${esc(o.ref)}</td><td>${l ? `<a href="#/office/leads/${l.id}">${esc(l.name)}</a><div class="muted small">${esc(l.company)}</div>` : '—'}</td>
          <td class="small">${o.items.map((i) => `${esc(productById(i.productId)?.name || i.productId)} (${esc(i.format)})`).join('<br>')}</td>
          <td>${statusBadge(o.status)}</td><td class="small">${o.tracking ? `${esc(o.carrier)} ${esc(o.tracking)}` : '—'}</td><td class="small">${fmtAgo(o.createdAt, t)}</td>
          <td>${next[o.status] ? `<button class="btn small" data-adv="${o.id}">${next[o.status]}</button>` : ''}</td></tr>`;
      }).join('') || '<tr><td colspan="7" class="muted">No orders</td></tr>'}
      </tbody></table>`;
    },
    mount(root) {
      root.querySelectorAll('[data-adv]').forEach((b) => b.addEventListener('click', () => E.advanceOrder(b.dataset.adv)));
    },
  };
}

// ---------- rules & settings ----------
function rules() {
  let draft = null;
  return {
    title: 'Rules & scoring',
    render() {
      const s = getState();
      if (!draft) draft = s.rules.map((r) => ({ ...r }));
      const opt = (arr, v, any = true) => `${any ? `<option ${v === 'Any' ? 'selected' : ''}>Any</option>` : ''}${arr.map((x) => `<option ${x === v ? 'selected' : ''}>${x}</option>`).join('')}`;
      return `
      <div class="page-head"><div><p class="eyebrow">Sales Cloud setup</p><h1>Lead assignment rule</h1><p class="muted">First matching entry wins. Region from postcode (DE) or country; segment from role. Real rules, queues and territories: to confirm with V&amp;B sales operations.</p></div></div>
      <table class="tbl rules"><thead><tr><th>#</th><th>Region</th><th>Segment</th><th>Owner / queue</th><th></th></tr></thead><tbody>
        ${draft.map((r, i) => `<tr><td>${i + 1}</td>
          <td><select data-i="${i}" data-k="region">${opt(REGIONS, r.region)}</select></td>
          <td><select data-i="${i}" data-k="segment">${opt(SEGMENTS, r.segment)}</select></td>
          <td><select data-i="${i}" data-k="ownerId">${OWNERS.map((o) => `<option value="${o.id}" ${o.id === r.ownerId ? 'selected' : ''}>${esc(o.name)} — ${esc(o.role)}</option>`).join('')}</select></td>
          <td class="row gap"><button class="btn tiny ghost" data-up="${i}" ${i === 0 ? 'disabled' : ''}>↑</button><button class="btn tiny ghost" data-del="${i}">✕</button></td></tr>`).join('')}
      </tbody></table>
      <div class="row gap"><button class="btn ghost" data-act="add">+ Add entry</button><button class="btn" data-act="save">Save rule</button></div>
      <section class="card tester"><h3>Test the rule</h3>
        <div class="row gap"><select id="t-region">${opt(REGIONS, 'North', false)}</select><select id="t-seg">${opt(SEGMENTS, 'Specifier', false)}</select><span id="t-out"></span></div>
      </section>
      <section class="card"><h3>Account Engagement & SLA settings</h3>
        <div class="grid3">
          <label>Score threshold for sales<input type="number" id="set-threshold" value="${s.settings.threshold}" min="10" step="5"></label>
          <label>First-contact SLA (working days)<input type="number" id="set-sla" value="${s.settings.slaDays}" min="1" max="5"></label>
          <label>Connector delay in demo (seconds; real ≈ 2 min)<input type="number" id="set-sync" value="${s.settings.syncDelaySec}" min="1" max="120"></label>
        </div>
        <button class="btn" data-act="save-settings">Save settings</button>
      </section>`;
    },
    mount(root, rerender) {
      const test = () => {
        const hit = applyRules(draft, root.querySelector('#t-region').value, root.querySelector('#t-seg').value);
        root.querySelector('#t-out').innerHTML = `→ entry ${hit.index ?? '—'}: ${owner(hit.ownerId)}`;
      };
      root.querySelectorAll('select[data-k]').forEach((sel) => sel.addEventListener('change', () => { draft[sel.dataset.i][sel.dataset.k] = sel.value; test(); }));
      root.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => { const i = +b.dataset.up; [draft[i - 1], draft[i]] = [draft[i], draft[i - 1]]; rerender(); }));
      root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { draft.splice(+b.dataset.del, 1); rerender(); }));
      root.querySelector('[data-act="add"]').addEventListener('click', () => { draft.push({ id: `r${Date.now()}`, region: 'Any', segment: 'Any', ownerId: 'o8' }); rerender(); });
      root.querySelector('[data-act="save"]').addEventListener('click', () => { E.saveRules(draft.map((r) => ({ ...r }))); toast('Assignment rule saved'); });
      root.querySelector('#t-region').addEventListener('change', test);
      root.querySelector('#t-seg').addEventListener('change', test);
      test();
      root.querySelector('[data-act="save-settings"]').addEventListener('click', () => {
        E.setSetting('threshold', Number(root.querySelector('#set-threshold').value) || 100);
        E.setSetting('slaDays', Number(root.querySelector('#set-sla').value) || 1);
        E.setSetting('syncDelaySec', Number(root.querySelector('#set-sync').value) || 6);
        toast('Settings saved');
      });
    },
  };
}

// ---------- insights ----------
function insights() {
  return {
    title: 'Journey insights',
    reactive: true,
    render() {
      const s = getState();
      const b = s.baseline;
      const f = journeyFunnel(s);
      const max = f[0].value;
      const live = (type) => s.analytics.filter((e) => e.type === type).length;
      const zeroLive = s.analytics.filter((e) => e.type === 'search_zero').map((e) => e.detail);
      const rep = s.insight;
      const contact = s.leads.filter((l) => l.firstContactAt).map((l) => l.firstContactAt - l.createdAt);
      const complete = s.leads.filter((l) => l.ai && l.ai.missing && l.ai.missing.length === 0 && !l.seed).length;
      const liveLeads = s.leads.filter((l) => !l.seed).length;
      const decided = s.leads.filter((l) => l.ai && l.ai.status !== 'pending');
      const conv = s.leads.filter((l) => l.oppId).length / Math.max(1, s.leads.length);
      return `
      <div class="page-head"><div><p class="eyebrow">AI use case 3 · journey & signal insights</p><h1>Where architects drop out</h1><p class="muted">${b.months} months of illustrative baseline data plus live, consent-based demo events. Only visitors who accepted analytics are counted.</p></div>
        <button class="btn" data-act="report">✨ Generate monthly insight report</button></div>
      <div class="cols2">
        <section class="card"><h3>Journey funnel</h3>
          <div class="funnel">${f.map((x, i) => `<div class="frow"><span>${esc(x.label)}</span><div class="fbar"><i style="width:${(x.value / max) * 100}%"></i></div><b>${fmtNum(x.value)}</b><em>${i ? fmtPct(x.value / f[i - 1].value) + ' of prev.' : ''}</em></div>`).join('')}</div>
        </section>
        <section class="card"><h3>Pilot KPIs</h3>
          <table class="tbl compact">
            <tr><th colspan="2">1 · Product discovery</th></tr>
            <tr><td>Searches (live demo)</td><td>${live('search') + live('photo_search')}</td></tr>
            <tr><td>Zero-result rate (baseline)</td><td>${fmtPct(b.zeroResults / b.searches, 1)}</td></tr>
            <tr><td>Search → product view (baseline)</td><td>${fmtPct(b.searchToProduct)}</td></tr>
            <tr><td>Result feedback 👍 / 👎</td><td>${s.feedback.up} / ${s.feedback.down}</td></tr>
            <tr><th colspan="2">2 · Enquiry qualification</th></tr>
            <tr><td>Median time to first contact</td><td>${contact.length ? fmtDuration(median(contact)) : '—'}</td></tr>
            <tr><td>Complete enquiries (live)</td><td>${complete}/${liveLeads}</td></tr>
            <tr><td>Suggestions accepted</td><td>${decided.filter((l) => l.ai.status === 'accepted').length}/${decided.length}</td></tr>
            <tr><td>Lead → opportunity</td><td>${fmtPct(conv)}</td></tr>
          </table>
        </section>
      </div>
      <div class="cols2">
        <section class="card"><h3>Top zero-result searches</h3><table class="tbl compact">${b.topZeroQueries.map(([q, n]) => `<tr><td>“${esc(q)}”</td><td>${n}</td></tr>`).join('')}${zeroLive.map((q) => `<tr class="live"><td>“${esc(q)}” <span class="badge">live</span></td><td>1</td></tr>`).join('')}</table></section>
        <section class="card"><h3>Where the enquiry form loses people</h3><table class="tbl compact">${b.formDropFields.map(([fl, v]) => `<tr><td>${esc(fl)}</td><td><div class="scorebar"><i style="width:${v * 250}%"></i><span>${fmtPct(v)}</span></div></td></tr>`).join('')}</table></section>
      </div>
      ${rep ? `<section class="card report"><h3>✨ Insight report <span class="ai-badge">${esc(rep.model)}</span> <span class="badge">illustrative data</span> <span class="muted small">${esc(rep.period)} · ≈ USD ${rep.costUSD.toFixed(2)} per run</span></h3>
        ${rep.findings.map((x, i) => `<div class="finding"><h4>${i + 1}. ${esc(x.title)}</h4><p>${esc(x.detail)}</p><p><b>Proposed fix:</b> ${esc(x.action)}</p><p class="test">🧪 ${esc(x.test)}</p></div>`).join('')}
      </section>` : ''}`;
    },
    mount(root) {
      root.querySelector('[data-act="report"]').addEventListener('click', () => {
        E.generateInsightReport();
        toast('Insight report generated');
      });
    },
  };
}

// ---------- integration ----------
const SYS_NODE = {
  Website: 'web', 'Form handler': 'form', 'Account Engagement': 'ae', Connector: 'conn', 'Sales Cloud': 'sc',
  'Assignment rule': 'sc', AI: 'ai', CADENAS: 'cad', 'Customer service': 'cs', Demo: null,
};

const nodeFor = (e) => {
  if (e.system !== 'Website') return SYS_NODE[e.system];
  return /status page/i.test(e.message) ? 'ws' : /enquiry/i.test(e.message) ? 'form' : 'web';
};

function integration(query) {
  const sys = query.get('sys') || '';
  return {
    title: 'Integration',
    reactive: true,
    render() {
      const s = getState();
      const recent = new Set(s.events.filter((e) => Date.now() - (e.t - (s.clockOffset || 0)) < 12000).map(nodeFor).filter(Boolean));
      const list = sys ? s.events.filter((e) => e.system === sys) : s.events;
      const systems = [...new Set(s.events.map((e) => e.system))];
      return `
      <div class="page-head"><div><p class="eyebrow">Architecture</p><h1>Integration log & system map</h1><p class="muted">Every step of the journey, as it would run between the website, Account Engagement, Sales Cloud, CADENAS and customer service. Nodes light up as events happen.</p></div></div>
      <section class="card">${systemMap(recent)}</section>
      <section class="card">
        <div class="row gap wrap filters"><a class="${!sys ? 'active' : ''}" href="#/office/integration">All</a>${systems.map((x) => `<a class="${sys === x ? 'active' : ''}" href="#/office/integration?sys=${encodeURIComponent(x)}">${esc(x)}</a>`).join('')}</div>
        <table class="tbl log"><thead><tr><th>Time</th><th>System</th><th>Event</th></tr></thead><tbody>
          ${list.slice(0, 150).map((e) => `<tr><td class="small nowrap">${fmtDateTime(e.t)}</td><td><span class="sys sys-${e.system.toLowerCase().replace(/[^a-z]/g, '')}">${esc(e.system)}</span></td>
            <td>${esc(e.message)}${e.payload ? `<details><summary>payload</summary><pre>${esc(typeof e.payload === 'string' ? e.payload.split('&').join('\n') : JSON.stringify(e.payload, null, 2))}</pre></details>` : ''}</td></tr>`).join('')}
        </tbody></table>
      </section>`;
    },
  };
}

function systemMap(active) {
  const n = (id, x, y, w, h, title, sub, opts = {}) =>
    `<g class="node ${active.has(id) ? 'pulse' : ''} ${opts.dashed ? 'dashed' : ''} ${opts.hl ? 'hl' : ''}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/><text x="${x + 12}" y="${y + 22}" class="t">${title}</text><text x="${x + 12}" y="${y + 40}" class="s">${sub}</text></g>`;
  return `<svg class="sysmap" viewBox="0 0 980 430" role="img" aria-label="System map">
    <defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z"/></marker></defs>
    <text x="20" y="22" class="col">PRODUCT DATA</text><text x="330" y="22" class="col">CUSTOMER-FACING WEBSITE</text><text x="700" y="22" class="col">INTERNAL · SALESFORCE</text>
    ${n('sal', 20, 40, 230, 60, 'Salsify (PIM)', 'product content, images · possible', { dashed: true })}
    ${n('erp', 20, 130, 230, 60, 'ERP article master', 'SAP · to confirm')}
    ${n('cad', 20, 220, 230, 60, 'CADENAS', 'BIM/CAD files, registered downloads')}
    <rect x="320" y="36" width="300" height="370" rx="10" class="frame"/>
    ${n('web', 335, 50, 270, 56, 'Discovery', 'text + photo search (AI)')}
    ${n('pdp', 335, 120, 270, 56, 'Product detail', 'configurator, BIM links')}
    ${n('form', 335, 190, 270, 56, 'Enquiry / sample form', 'project + HOAI phase', { hl: true })}
    ${n('ws', 335, 260, 270, 56, 'Project workspace', 'status only, no stages')}
    ${n('ai', 335, 335, 270, 56, 'AI services', 'discovery · summary · insights')}
    ${n('ae', 700, 40, 260, 70, 'Account Engagement', 'prospects, consent, score, grade, nurture')}
    ${n('sc', 700, 160, 260, 80, 'Sales Cloud', 'leads + owner rules, 9 stages, tasks')}
    ${n('cs', 700, 280, 260, 56, 'Customer service', 'sample dispatch')}
    ${n('sap', 700, 360, 260, 50, 'SAP chain · later', 'offer, order, delivery', { dashed: true })}
    <g class="edges">
      <path d="M250,70 L335,78" marker-end="url(#ar)" class="dash"/>
      <path d="M135,130 L135,100" marker-end="url(#ar)"/>
      <path d="M250,250 L335,148" marker-end="url(#ar)"/>
      <path d="M605,218 L660,218 L660,75 L700,75" marker-end="url(#ar)" class="${active.has('form') ? 'flow' : ''}"/>
      <text x="612" y="140" class="lbl">form handler</text>
      <path d="M830,110 L830,160" marker-end="url(#ar)" class="${active.has('conn') ? 'flow' : ''}"/>
      <text x="838" y="140" class="lbl">sync ≈ 2 min</text>
      <path d="M830,240 L830,280" marker-end="url(#ar)" class="${active.has('cs') ? 'flow' : ''}"/>
      <path d="M700,220 L640,288 L605,288" marker-end="url(#ar)" class="dash"/>
      <text x="612" y="306" class="lbl">status back</text>
      <path d="M830,336 L830,360" class="dash"/>
    </g>
    <g class="legend"><rect x="20" y="330" width="22" height="14" rx="3" class="dashed"/><text x="50" y="342">possible / later phase</text><rect x="20" y="356" width="22" height="14" rx="3" class="hlr"/><text x="50" y="368">hand-over into Salesforce</text><circle cx="31" cy="390" r="6" class="pulsec"/><text x="50" y="394">active in the last seconds</text></g>
  </svg>`;
}

function notFound() {
  return { title: 'Not found', render: () => '<p>Not found.</p>' };
}

export function resolve(r) {
  const [, a, b] = r.parts;
  if (!a) return home();
  if (a === 'prospects') return b ? prospect(b) : prospects(r.query);
  if (a === 'leads') return b ? lead(b) : leads(r.query);
  if (a === 'opps') return b ? opp(b) : opps();
  if (a === 'tasks') return tasks(r.query);
  if (a === 'service') return service();
  if (a === 'rules') return rules();
  if (a === 'insights') return insights();
  if (a === 'integration') return integration(r.query);
  return notFound();
}

