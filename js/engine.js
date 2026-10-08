// The integration behaviour from the architecture doc, simulated end to end:
// website form -> Account Engagement form handler -> prospect (score/grade/consent)
// -> connector sync (~2 min) -> Sales Cloud lead -> assignment rule -> owner + due task
// -> AI enquiry summary -> status back to the architect (status only, no stages).
import { update, getState, now } from './store.js';
import { uid, addWorkingDays, DAY, HOUR } from './util.js';
import { productById } from './data/catalog.js';
import { freshVisitor } from './data/seed.js';
import { summariseEnquiry, insightReport } from './ai.js';
import {
  SCORE, segmentFor, regionFor, applyRules, ownerById, gradeFor, nurtureFor, OPP_STAGES, hoaiLabel,
} from './domain.js';

// ---------- logging ----------
export function logEvent(s, system, message, extra = {}) {
  s.events.unshift({ id: uid('ev'), t: now(s), system, message, ...extra });
  if (s.events.length > 400) s.events.length = 400;
}

// ---------- tracking (consent-aware) ----------
export function track(type, detail = '', meta = {}) {
  update((s) => {
    s.flags[type] = (s.flags[type] || 0) + 1;
    const t = now(s);
    if (s.visitor.consentAnalytics) {
      s.analytics.push({ t, type, detail, session: s.visitor.sessionId, ...meta });
      if (s.analytics.length > 2000) s.analytics.splice(0, s.analytics.length - 2000);
    }
    const p = s.visitor.prospectId && s.prospects.find((x) => x.id === s.visitor.prospectId);
    if (p && SCORE[type] && s.visitor.consentAnalytics) {
      addActivity(s, p, type, detail, SCORE[type]);
    }
  });
}

function addActivity(s, p, type, detail, points) {
  const t = now(s);
  p.activities.unshift({ t, type, detail, points });
  if (p.activities.length > 60) p.activities.length = 60;
  p.score += points;
  p.lastActivity = t;
  if (!p.leadId && !p.syncQueued && p.score >= s.settings.threshold) {
    p.status = 'Sales-ready';
    logEvent(s, 'Account Engagement', `${p.name} reached score ${p.score} (threshold ${s.settings.threshold}) → sales-ready`, { prospectId: p.id });
    queueSync(s, p, `Score threshold reached (${p.score} ≥ ${s.settings.threshold})`);
  }
}

function queueSync(s, p, reason) {
  p.syncQueued = true;
  s.jobs.push({ id: uid('job'), type: 'sync', prospectId: p.id, reason, dueReal: Date.now() + s.settings.syncDelaySec * 1000 });
  logEvent(s, 'Connector', `Queued for Sales Cloud sync: ${p.name} (connector runs about every 2 min)`, { prospectId: p.id, reason });
}

// ---------- visitor ----------
export function setAnalyticsConsent(ok) {
  update((s) => {
    s.visitor.consentAnalytics = ok;
    logEvent(s, 'Website', `Consent tool: analytics ${ok ? 'accepted' : 'declined'}`);
  });
}

export function newVisitor() {
  update((s) => {
    s.visitor = freshVisitor();
    logEvent(s, 'Website', 'New anonymous visitor session started');
  });
}

export function toggleSave(productId) {
  let saved;
  update((s) => {
    const i = s.visitor.saved.indexOf(productId);
    if (i >= 0) s.visitor.saved.splice(i, 1);
    else s.visitor.saved.push(productId);
    saved = i < 0;
  });
  if (saved) track('save', `Saved ${productById(productId)?.name}`);
  return saved;
}

export function registerCadenas(data) {
  update((s) => {
    const t = now(s);
    s.visitor.registered = { ...data, t };
    s.visitor.contact = { ...(s.visitor.contact || {}), ...data };
    logEvent(s, 'CADENAS', `Registration on CADENAS catalogue: ${data.name} (${data.company})`, { payload: { ...data } });
    let p = s.prospects.find((x) => x.email.toLowerCase() === data.email.toLowerCase());
    if (!p) {
      p = newProspect(s, { ...data, country: 'Germany', postcode: data.postcode || '' }, 'CADENAS download report');
      s.prospects.unshift(p);
      logEvent(s, 'Account Engagement', `Prospect created from CADENAS download report: ${p.name} (only if V&B's CADENAS contract allows report access)`, { prospectId: p.id });
    }
    s.visitor.prospectId = p.id;
  });
}

function newProspect(s, d, source) {
  const t = now(s);
  return {
    id: uid('pr'), name: d.name, email: d.email, company: d.company || '—', role: d.role || 'Architect',
    segment: segmentFor(d.role || 'Architect'), region: regionFor(d.country || 'Germany', d.postcode),
    country: d.country || 'Germany', postcode: d.postcode || '', city: d.city || '', phase: Number(d.phase) || 0,
    area: Number(d.area) || 0, grade: gradeFor(d.role || 'Architect', Number(d.area) || 0, Number(d.phase) || 0),
    score: 0, consent: { privacy: true, marketing: 'none' }, programme: nurtureFor(d.phase), status: 'Nurturing',
    createdAt: t, lastActivity: t, activities: [], pendingRequestIds: [], handRaiser: false, leadId: null, source,
  };
}

// ---------- enquiry submission ----------
export function submitEnquiry(f) {
  return update((s) => {
    const t = now(s);
    const ref = `VB-2026-${String(++s.counters.request).padStart(4, '0')}`;
    const contact = {
      name: f.name.trim(), email: f.email.trim(), phone: (f.phone || '').trim(), company: f.company.trim() || '—',
      role: f.role, country: f.country, postcode: f.postcode.trim(), city: f.city.trim(),
    };
    const project = {
      name: f.projectName.trim(), type: f.projectType, phase: Number(f.phase) || 0, area: Number(f.area) || 0,
      start: f.start || '', applications: f.applications || [],
    };
    const req = {
      id: uid('rq'), ref, t, prospectId: null, leadId: null, types: f.types, project,
      products: f.products, samples: f.types.includes('Samples') ? f.products.map((id) => ({ productId: id, format: f.sampleFormat?.[id] || productById(id)?.collection.formats[0] })) : [],
      message: (f.message || '').trim(), contact, marketing: !!f.marketing,
    };

    // 1. Website posts to the Account Engagement form handler (URL-encoded, not multipart)
    const body = new URLSearchParams({
      email: contact.email, first_name: contact.name.split(' ')[0], last_name: contact.name.split(' ').slice(1).join(' '),
      company: contact.company, phone: contact.phone, job_title: contact.role, country: contact.country, zip: contact.postcode,
      city: contact.city, project_name: project.name, project_type: project.type, hoai_phase: String(project.phase),
      area_m2: String(project.area), request_type: f.types.join(';'), products: f.products.join(';'),
      opt_in: f.marketing ? 'pending_double_opt_in' : 'none', request_ref: ref,
    }).toString();
    logEvent(s, 'Website', `Enquiry ${ref} submitted (${f.types.join(' + ')}) for “${project.name}”`, { ref });
    logEvent(s, 'Form handler', 'POST https://go.example-pardot.com/l/…/vb-enquiry · application/x-www-form-urlencoded', { payload: body, ref });

    // 2. Prospect created or updated (matched by email)
    let p = s.prospects.find((x) => x.email.toLowerCase() === contact.email.toLowerCase());
    if (!p) {
      p = newProspect(s, { ...contact, ...project }, 'Website enquiry form');
      s.prospects.unshift(p);
      logEvent(s, 'Account Engagement', `Prospect created: ${p.name} <${p.email}>`, { prospectId: p.id });
    } else {
      logEvent(s, 'Account Engagement', `Prospect updated (matched by email): ${p.name}`, { prospectId: p.id });
    }
    Object.assign(p, {
      name: contact.name, company: contact.company, role: contact.role, segment: segmentFor(contact.role),
      region: regionFor(contact.country, contact.postcode), country: contact.country, postcode: contact.postcode,
      city: contact.city, phase: project.phase, area: project.area, phone: contact.phone,
    });
    p.grade = gradeFor(contact.role, project.area, project.phase);
    p.programme = nurtureFor(project.phase);
    if (f.marketing && p.consent.marketing !== 'confirmed') p.consent.marketing = 'pending-doi';
    p.handRaiser = true;
    p.pendingRequestIds.push(req.id);
    req.prospectId = p.id;
    logEvent(s, 'Account Engagement', `Grade ${p.grade} (${p.role}, ${project.area || '?'} m², ${hoaiLabel(project.phase)}) · consent: marketing ${p.consent.marketing}`, { prospectId: p.id });

    // 3. Hand-raiser: completion action sends it to sales at once (no waiting for score)
    if (!p.syncQueued) {
      p.status = 'Sales-ready';
      logEvent(s, 'Account Engagement', 'Completion action: hand-raiser (sample/advice request) → assign to Salesforce now', { prospectId: p.id });
      queueSync(s, p, 'Hand-raiser: sample/advice request');
    }
    addActivity(s, p, 'enquiry', `${f.types.join(' + ')} request ${ref}: ${project.name}`, SCORE.enquiry);

    s.requests.unshift(req);
    s.visitor.prospectId = p.id;
    s.visitor.contact = contact;
    s.visitor.requestIds.unshift(req.id);
    s.flags.enquiry_submit = (s.flags.enquiry_submit || 0) + 1;
    if (s.visitor.consentAnalytics) s.analytics.push({ t, type: 'enquiry_submit', detail: ref, session: s.visitor.sessionId });
    return ref;
  });
}

export function confirmDoubleOptIn(prospectId) {
  update((s) => {
    const p = s.prospects.find((x) => x.id === prospectId);
    if (!p) return;
    p.consent.marketing = 'confirmed';
    p.consent.confirmedAt = now(s);
    logEvent(s, 'Account Engagement', `Double opt-in confirmed by ${p.name}; nurture programme “${p.programme}” active`, { prospectId: p.id });
  });
}

// ---------- background jobs (only one pane runs them, see startEngine) ----------
function runJobs() {
  const s0 = getState();
  if (!s0.jobs.some((j) => j.dueReal <= Date.now())) return;
  update((s) => {
    const due = s.jobs.filter((j) => j.dueReal <= Date.now());
    s.jobs = s.jobs.filter((j) => j.dueReal > Date.now());
    for (const j of due) {
      try {
        if (j.type === 'sync') syncProspect(s, j);
        if (j.type === 'ai') aiSummary(s, j);
      } catch (e) {
        console.error('job failed', j, e);
      }
    }
  });
}

function syncProspect(s, job) {
  const p = s.prospects.find((x) => x.id === job.prospectId);
  if (!p) return;
  const t = now(s);
  const reqs = s.requests.filter((r) => p.pendingRequestIds.includes(r.id));
  const mapping = {
    'Prospect.email → Lead.Email': p.email,
    'Prospect.company → Lead.Company': p.company,
    'Prospect.score → Lead.pi__score__c': p.score,
    'Prospect.grade → Lead.pi__grade__c': p.grade,
    'Prospect.zip → Lead.PostalCode': p.postcode,
    'Prospect.hoai_phase → Lead.HOAI_Phase__c': p.phase,
    'Prospect.project_name → Lead.Project_Name__c': reqs[0]?.project.name || '',
  };
  logEvent(s, 'Connector', `Synced ${p.name} to Sales Cloud (Account Engagement connector v2)`, { payload: mapping, prospectId: p.id });

  let lead = p.leadId && s.leads.find((l) => l.id === p.leadId && !['Converted', 'Disqualified'].includes(l.status));
  const req = reqs[0];
  if (!lead) {
    const region = regionFor(p.country, p.postcode);
    const segment = segmentFor(p.role);
    lead = {
      id: uid('ld'), ref: `L-${++s.counters.lead}`, prospectId: p.id, requestIds: [],
      name: p.name, email: p.email, phone: p.phone || req?.contact.phone || '', company: p.company, role: p.role,
      segment, region, country: p.country, postcode: p.postcode, city: p.city,
      project: req ? { ...req.project } : { name: '', type: '', phase: p.phase, area: p.area, start: '', applications: [] },
      products: req ? [...req.products] : [], samples: req ? [...req.samples] : [], message: req?.message || '',
      source: req ? 'Website enquiry' : 'Account Engagement (score threshold)', status: 'New',
      createdAt: t, assignedAt: null, ownerId: null, firstContactAt: null, ai: null, priority: null, oppId: null,
      history: [{ t, text: `Lead created by connector · ${job.reason}` }], drafts: [],
    };
    s.leads.unshift(lead);
    p.leadId = lead.id;
    logEvent(s, 'Sales Cloud', `Lead ${lead.ref} created: ${lead.name} · ${lead.company}`, { leadId: lead.id });

    // Active assignment rule: region + segment
    const hit = applyRules(s.rules, region, segment);
    const owner = ownerById(hit.ownerId);
    lead.ownerId = owner.id;
    lead.ruleIndex = hit.index;
    lead.assignedAt = now(s);
    logEvent(s, 'Assignment rule', `Rule ${hit.index ?? 'default'} (${hit.rule ? `${hit.rule.region} + ${hit.rule.segment}` : 'no match → queue'}) → ${owner.name}`, { leadId: lead.id, toast: 'office', toastText: `New lead <b>${lead.name}</b> → ${owner.name}` });

    // Due task = the tracked next action
    const due = addWorkingDays(t, s.settings.slaDays);
    s.tasks.unshift({
      id: uid('tk'), leadId: lead.id, ownerId: owner.id, subject: req ? 'First contact: sample/advice request' : 'Follow up sales-ready prospect',
      kind: 'first-contact', due, createdAt: t, status: 'Open',
    });
    logEvent(s, 'Sales Cloud', `Task for ${owner.name}: first contact due ${new Date(due).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })} (1 working day)`, { leadId: lead.id });
    s.jobs.push({ id: uid('job'), type: 'ai', leadId: lead.id, dueReal: Date.now() + s.settings.aiDelaySec * 1000 });
  } else {
    lead.history.unshift({ t, text: `New request attached: ${req?.ref || 'activity'}` });
    s.tasks.unshift({ id: uid('tk'), leadId: lead.id, ownerId: lead.ownerId, subject: `Follow up new request ${req?.ref || ''}`, kind: 'follow-up', due: addWorkingDays(t, s.settings.slaDays), createdAt: t, status: 'Open' });
    logEvent(s, 'Sales Cloud', `Existing open lead ${lead.ref} updated with new request; follow-up task created`, { leadId: lead.id });
  }
  for (const r of reqs) {
    r.leadId = lead.id;
    if (!lead.requestIds.includes(r.id)) lead.requestIds.push(r.id);
  }
  if (reqs.length) {
    const owner = ownerById(lead.ownerId);
    logEvent(s, 'Website', `Status page updated for ${reqs.map((r) => r.ref).join(', ')}: advisor assigned (${owner.name})`, { toast: 'site', toastText: `Your advisor <b>${owner.name}</b> has been assigned` });
  }
  p.pendingRequestIds = [];
  p.syncQueued = false;
  p.status = 'Lead';
}

function aiSummary(s, job) {
  const lead = s.leads.find((l) => l.id === job.leadId);
  if (!lead) return;
  const p = s.prospects.find((x) => x.id === lead.prospectId);
  lead.ai = summariseEnquiry(lead, p, s);
  lead.priority = lead.ai.priority;
  logEvent(s, 'AI', `Enquiry summarised for ${lead.ref}: priority ${lead.ai.priority}, ${lead.ai.missing.length} missing detail(s), ${lead.ai.checks.filter((c) => !c.ok).length} product check(s) flagged · ${lead.ai.model}, ≈ USD ${lead.ai.costUSD.toFixed(4)}`, { leadId: lead.id });
}

let started = false;
export function startEngine() {
  if (started) return;
  started = true;
  const run = () => setInterval(runJobs, 700);
  // Exactly one pane/tab processes background jobs.
  if (navigator.locks && navigator.locks.request) {
    navigator.locks.request('vb-demo-engine', () => {
      run();
      return new Promise(() => {});
    }).catch(() => run());
  } else run();
}

export function syncNow() {
  update((s) => {
    s.jobs.forEach((j) => (j.dueReal = Date.now()));
    logEvent(s, 'Demo', 'Presenter: run connector sync now');
  });
}

// ---------- back office actions ----------
const findLead = (s, id) => s.leads.find((l) => l.id === id);

export function acceptAI(leadId) {
  update((s) => {
    const l = findLead(s, leadId);
    if (!l?.ai) return;
    l.ai.status = 'accepted';
    l.ai.decidedAt = now(s);
    l.priority = l.ai.priority;
    const t = now(s);
    for (const st of l.ai.nextSteps.filter((x) => x.task)) {
      s.tasks.unshift({ id: uid('tk'), leadId: l.id, ownerId: l.ownerId, subject: st.text, kind: st.kind || 'ai', due: addWorkingDays(t, 2), createdAt: t, status: 'Open' });
    }
    l.history.unshift({ t, text: 'AI suggestion accepted by sales; tasks created' });
    logEvent(s, 'Sales Cloud', `${ownerById(l.ownerId).name} accepted the AI suggestion for ${l.ref} (${l.ai.nextSteps.filter((x) => x.task).length} task(s) created)`, { leadId: l.id });
  });
}

export function dismissAI(leadId) {
  update((s) => {
    const l = findLead(s, leadId);
    if (!l?.ai) return;
    l.ai.status = 'dismissed';
    l.ai.decidedAt = now(s);
    l.history.unshift({ t: now(s), text: 'AI suggestion dismissed' });
    logEvent(s, 'Sales Cloud', `AI suggestion dismissed for ${l.ref}`, { leadId: l.id });
  });
}

export function logCall(leadId, note) {
  update((s) => {
    const l = findLead(s, leadId);
    if (!l) return;
    const t = now(s);
    const first = !l.firstContactAt;
    if (first) l.firstContactAt = t;
    if (l.status === 'New') l.status = 'Working';
    s.tasks.filter((k) => k.leadId === l.id && k.kind === 'first-contact' && k.status === 'Open').forEach((k) => {
      k.status = 'Done';
      k.doneAt = t;
    });
    l.history.unshift({ t, text: `Call logged: ${note || 'first contact'}` });
    logEvent(s, 'Sales Cloud', `Call logged on ${l.ref} by ${ownerById(l.ownerId).name}${first ? ` · time to first contact ${Math.round((t - l.createdAt) / 60000)} min` : ''}`, { leadId: l.id });
    if (first && l.requestIds.length) logEvent(s, 'Website', `Status page: advisor in contact (${l.requestIds.length} request(s))`, { toast: 'site', toastText: 'Your advisor has been in touch' });
  });
}

export function draftMissingDetails(leadId) {
  update((s) => {
    const l = findLead(s, leadId);
    if (!l) return;
    const miss = l.ai?.missing || [];
    l.drafts.unshift({
      t: now(s),
      subject: `Your request ${l.requestIds.length ? '' : ''}– a few details for “${l.project.name || 'your project'}”`,
      body: `Dear ${l.name},\n\nthank you for your request. To prepare the right samples and documents, could you share:\n${miss.map((m) => `• ${m}`).join('\n') || '• your planned start date'}\n\nKind regards\n${ownerById(l.ownerId).name}`,
    });
    l.history.unshift({ t: now(s), text: 'Email draft prepared (not sent automatically)' });
    logEvent(s, 'Sales Cloud', `Email draft prepared for ${l.ref}: sales reviews and sends it; no automatic emails in the pilot`, { leadId: l.id });
  });
}

export function createSampleOrder(leadId) {
  update((s) => {
    const l = findLead(s, leadId);
    if (!l) return;
    if (s.orders.some((o) => o.leadId === l.id && o.status !== 'Delivered')) return;
    const items = l.samples.length ? l.samples : l.products.slice(0, 3).map((id) => ({ productId: id, format: productById(id)?.collection.formats[0] }));
    if (!items.length) return;
    const t = now(s);
    const reqId = l.requestIds.find((id) => s.requests.find((r) => r.id === id)?.samples.length) || l.requestIds[0] || null;
    s.orders.unshift({ id: uid('so'), ref: `S-${++s.counters.order}`, leadId: l.id, requestId: reqId, items, status: 'New', createdAt: t, shippedAt: null, deliveredAt: null, carrier: null, tracking: null });
    s.tasks.filter((k) => k.leadId === l.id && k.kind === 'samples' && k.status === 'Open').forEach((k) => { k.status = 'Done'; k.doneAt = t; });
    l.history.unshift({ t, text: `Sample order released to customer service (${items.length} item(s))` });
    logEvent(s, 'Customer service', `Sample order for ${l.name}: ${items.map((i) => productById(i.productId)?.name).join(', ')}`, { leadId: l.id, toast: 'office', toastText: 'Sample order sent to customer service' });
  });
}

export function advanceOrder(orderId) {
  update((s) => {
    const o = s.orders.find((x) => x.id === orderId);
    if (!o) return;
    const t = now(s);
    if (o.status === 'New') o.status = 'Picking';
    else if (o.status === 'Picking') {
      o.status = 'Shipped';
      o.shippedAt = t;
      o.carrier = 'DHL';
      o.tracking = `JJD0001${Math.floor(Math.random() * 9e6 + 1e6)}`;
      logEvent(s, 'Website', `Status page: samples dispatched (${o.carrier} ${o.tracking})`, { toast: 'site', toastText: 'Your samples are on their way' });
    } else if (o.status === 'Shipped') {
      o.status = 'Delivered';
      o.deliveredAt = t;
      logEvent(s, 'Website', 'Status page: samples delivered', { toast: 'site', toastText: 'Samples delivered' });
    }
    logEvent(s, 'Customer service', `Sample order ${o.ref} → ${o.status}`, { leadId: o.leadId });
  });
}

export function setLeadStatus(leadId, status) {
  update((s) => {
    const l = findLead(s, leadId);
    if (!l) return;
    l.status = status;
    l.history.unshift({ t: now(s), text: `Status → ${status}` });
    logEvent(s, 'Sales Cloud', `Lead ${l.ref} status → ${status}`, { leadId: l.id });
  });
}

export function reassign(leadId, ownerId) {
  update((s) => {
    const l = findLead(s, leadId);
    if (!l || l.ownerId === ownerId) return;
    const from = ownerById(l.ownerId).name;
    l.ownerId = ownerId;
    s.tasks.filter((k) => k.leadId === l.id && k.status === 'Open').forEach((k) => (k.ownerId = ownerId));
    l.history.unshift({ t: now(s), text: `Owner changed ${from} → ${ownerById(ownerId).name}` });
    logEvent(s, 'Sales Cloud', `Lead ${l.ref} reassigned ${from} → ${ownerById(ownerId).name}`, { leadId: l.id });
  });
}

export function convertLead(leadId) {
  return update((s) => {
    const l = findLead(s, leadId);
    if (!l || l.oppId) return l?.oppId;
    const t = now(s);
    if (!l.firstContactAt) l.firstContactAt = t;
    const area = l.project.area || 300;
    const opp = {
      id: uid('op'), ref: `O-${++s.counters.opp}`, name: `${l.company !== '—' ? l.company : l.name} – ${l.project.name || 'Project'}`,
      account: l.company !== '—' ? l.company : l.name, leadId: l.id, ownerId: l.ownerId, stage: 1, lost: false,
      area, amount: area * 52, createdAt: t, closeDate: t + 120 * DAY, products: l.products, history: [{ t, stage: 1 }],
    };
    s.opps.unshift(opp);
    l.oppId = opp.id;
    l.status = 'Converted';
    l.history.unshift({ t, text: `Converted: account, contact and opportunity ${opp.ref}` });
    logEvent(s, 'Sales Cloud', `Lead ${l.ref} converted → account “${opp.account}”, opportunity ${opp.ref} (stage 1/9)`, { leadId: l.id });
    logEvent(s, 'Website', 'Status page: project support active (internal stages stay hidden)', { toast: 'site', toastText: 'Project support is now active' });
    return opp.id;
  });
}

export function moveOpp(oppId, delta) {
  update((s) => {
    const o = s.opps.find((x) => x.id === oppId);
    if (!o) return;
    const next = Math.max(1, Math.min(OPP_STAGES.length, o.stage + delta));
    if (next === o.stage) return;
    o.stage = next;
    o.lost = false;
    o.history.push({ t: now(s), stage: next });
    logEvent(s, 'Sales Cloud', `Opportunity ${o.ref} → stage ${next}/9 “${OPP_STAGES[next - 1]}” (not visible to the architect)`);
  });
}

export function setOppLost(oppId) {
  update((s) => {
    const o = s.opps.find((x) => x.id === oppId);
    if (!o) return;
    o.lost = !o.lost;
    logEvent(s, 'Sales Cloud', `Opportunity ${o.ref} marked ${o.lost ? 'lost' : 'open'}`);
  });
}

export function completeTask(taskId) {
  update((s) => {
    const k = s.tasks.find((x) => x.id === taskId);
    if (!k || k.status === 'Done') return;
    k.status = 'Done';
    k.doneAt = now(s);
    const l = findLead(s, k.leadId);
    if (l && k.kind === 'first-contact' && !l.firstContactAt) {
      l.firstContactAt = k.doneAt;
      if (l.status === 'New') l.status = 'Working';
    }
    logEvent(s, 'Sales Cloud', `Task done: ${k.subject}`, { leadId: k.leadId });
  });
}

export function sendToSales(prospectId) {
  update((s) => {
    const p = s.prospects.find((x) => x.id === prospectId);
    if (!p || p.syncQueued || p.leadId) return;
    p.status = 'Sales-ready';
    queueSync(s, p, 'Manually sent to sales by marketing');
  });
}

export function simulateEmailClick(prospectId, subject) {
  update((s) => {
    const p = s.prospects.find((x) => x.id === prospectId);
    if (!p) return;
    addActivity(s, p, 'email_click', `Clicked nurture email: ${subject}`, SCORE.email_click);
    logEvent(s, 'Account Engagement', `${p.name} clicked “${subject}” (+${SCORE.email_click}) → score ${p.score}`, { prospectId: p.id });
  });
}

export function setSetting(key, value) {
  update((s) => {
    s.settings[key] = value;
    logEvent(s, 'Demo', `Setting ${key} = ${value}`);
  });
}

export function saveRules(rules) {
  update((s) => {
    s.rules = rules;
    logEvent(s, 'Sales Cloud', `Lead assignment rule saved (${rules.length} entries)`);
  });
}

export function fastForward(hours) {
  update((s) => {
    s.clockOffset = (s.clockOffset || 0) + hours * HOUR;
    logEvent(s, 'Demo', `Clock moved forward ${hours} h`);
  });
}

export function recordAIFeedback(up) {
  update((s) => {
    s.feedback[up ? 'up' : 'down']++;
  });
}

export function generateInsightReport() {
  update((s) => {
    s.insight = insightReport(s);
    logEvent(s, 'AI', `Monthly journey insight report generated · ${s.insight.model}, ≈ USD ${s.insight.costUSD.toFixed(2)}`);
  });
}
