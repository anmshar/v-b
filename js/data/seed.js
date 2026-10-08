// Deterministic seed so the back office is never empty. All people and companies are fictional.
import { rng, pick, HOUR, DAY, uid, addWorkingDays } from '../util.js';
import { DEFAULT_RULES, applyRules, regionFor, segmentFor, gradeFor, nurtureFor, OPP_STAGES } from '../domain.js';
import { PRODUCTS } from './catalog.js';

export const SEED_VERSION = 3;

const PEOPLE = [
  ['Katrin Vogel', 'Vogel + Partner Architekten', 'Architect', 'Germany', '20095', 'Hamburg', 'Hotel Hafenkante refurbishment', 'Hotel', 5, 1800],
  ['Daniel Krüger', 'Krüger Innenarchitektur', 'Interior designer', 'Germany', '80331', 'München', 'Boutique hotel Isarblick', 'Hotel', 3, 650],
  ['Mehmet Yilmaz', 'Yilmaz Fliesenbau GmbH', 'Contractor / tiler', 'Germany', '50667', 'Köln', 'Residential block Ehrenfeld', 'Residential (multi-unit)', 8, 2400],
  ['Anna Schulz', 'schulz.raum', 'Interior designer', 'Germany', '10115', 'Berlin', 'Flagship store Mitte', 'Retail', 5, 420],
  ['Peter Lange', 'Lange Projektentwicklung', 'Developer / investor', 'Germany', '60311', 'Frankfurt am Main', 'Office tower Mainkai', 'Office', 2, 9500],
  ['Sabine Roth', 'RothArchitektur', 'Architect', 'Germany', '70173', 'Stuttgart', 'Clinic extension Killesberg', 'Healthcare', 6, 3100],
  ['Felix Hartmann', 'Hartmann Planungsgruppe Nord', 'Planner / engineer', 'Germany', '28195', 'Bremen', 'School campus Überseestadt', 'Education', 4, 5200],
  ['Nina Berger', 'Berger Architects', 'Architect', 'Austria', '1010', 'Wien', 'Spa hotel Wienerwald', 'Hotel', 5, 2200],
  ['Lukas Meier', 'Meier Baumanagement', 'Planner / engineer', 'Switzerland', '8001', 'Zürich', 'Residential Seefeld', 'Residential (multi-unit)', 7, 1300],
  ['Julia Neumann', 'Atelier Neumann', 'Architect', 'Germany', '04109', 'Leipzig', 'Museum café', 'Public / culture', 3, 280],
  ['Thomas Becker', '—', 'Private customer', 'Germany', '40210', 'Düsseldorf', 'Bathroom renovation', 'Residential (single home)', 0, 18],
  ['Elif Kaya', 'Kaya Studio', 'Interior designer', 'Germany', '90402', 'Nürnberg', 'Restaurant Altstadt', 'Retail', 5, 360],
  ['Martin Schwarz', 'Schwarz & Co. Architekten', 'Architect', 'Germany', '30159', 'Hannover', 'Office refurbishment Aegi', 'Office', 6, 1450],
  ['Laura Zimmermann', 'Zimmermann Hotelbau', 'Developer / investor', 'Germany', '01067', 'Dresden', 'Hotel Elbufer', 'Hotel', 4, 6800],
];

const NURTURE_ONLY = [
  ['Jan Peters', 'Peters Architektur', 'Architect', 'Germany', '24103', 'Kiel', 2, 46],
  ['Maria Lehmann', 'studio lehmann', 'Interior designer', 'Germany', '68159', 'Mannheim', 1, 31],
  ['Kevin Braun', 'Braun Planung', 'Planner / engineer', 'Germany', '44135', 'Dortmund', 4, 72],
  ['Hannah Wolf', 'Wolf Architekten', 'Architect', 'Germany', '99084', 'Erfurt', 3, 58],
  ['Stefan Koch', 'Koch Bau', 'Contractor / tiler', 'Germany', '79098', 'Freiburg', 0, 22],
  ['Mia Schröder', 'MS Interiors', 'Interior designer', 'Germany', '18055', 'Rostock', 5, 88],
];

const APPS_BY_TYPE = {
  Hotel: ['floor-com', 'wall', 'wet'],
  Office: ['floor-com', 'wall'],
  Retail: ['floor-com'],
  Healthcare: ['floor-com', 'wet', 'wall'],
  Education: ['floor-com', 'wall'],
  'Residential (multi-unit)': ['floor-res', 'wall', 'outdoor'],
  'Residential (single home)': ['floor-res', 'wet', 'wall'],
  'Public / culture': ['floor-com'],
  Other: ['floor-res'],
};

export function buildSeed() {
  const r = rng(20261008);
  const now = Date.now();
  const s = {
    version: SEED_VERSION,
    rev: 0,
    createdAt: now,
    clockOffset: 0,
    settings: { threshold: 100, slaDays: 1, syncDelaySec: 6, aiDelaySec: 2 },
    rules: DEFAULT_RULES.map((x) => ({ ...x })),
    visitor: freshVisitor(),
    prospects: [],
    leads: [],
    tasks: [],
    opps: [],
    orders: [],
    requests: [],
    events: [],
    jobs: [],
    analytics: [],
    feedback: { up: 0, down: 0 },
    flags: {},
    counters: { request: 141, lead: 1820, order: 560, opp: 930 },
    baseline: {
      months: 3,
      pageViews: 45200,
      searches: 9100,
      zeroResults: 1480,
      searchToProduct: 0.41,
      productViews: 12650,
      bimClicks: 1930,
      bimRegistrations: 760,
      bimDownloads: 702,
      enquiryStarts: 655,
      enquirySubmits: 287,
      samplesRequested: 214,
      topZeroQueries: [
        ['rutschhemmend dusche R11', 96],
        ['terrazzo outdoor', 71],
        ['120x280', 64],
        ['wood look terrace R11', 58],
        ['green wall tile matt', 41],
      ],
      formDropFields: [
        ['Project phase (HOAI)', 0.31],
        ['Phone', 0.22],
        ['Area m²', 0.17],
        ['Products', 0.12],
      ],
    },
  };

  PEOPLE.forEach((p, i) => {
    const [name, company, role, country, postcode, city, project, type, phase, area] = p;
    const createdAt = now - (i * 1.35 + 0.4) * DAY - Math.floor(r() * 6) * HOUR;
    const region = regionFor(country, postcode);
    const segment = segmentFor(role);
    const email = `${name.split(' ')[0].toLowerCase()}.${name.split(' ')[1].toLowerCase().replace('ü', 'ue').replace('ö', 'oe')}@example.com`;
    const products = [pick(r, PRODUCTS).id, pick(r, PRODUCTS).id].filter((v, k, a) => a.indexOf(v) === k);
    const pr = {
      id: uid('pr'), seed: true, name, email, company, role, segment, region, country, postcode, city,
      phase, area, grade: gradeFor(role, area, phase), score: 60 + Math.floor(r() * 90),
      consent: { privacy: true, marketing: r() > 0.35 ? 'confirmed' : 'none' },
      programme: nurtureFor(phase), status: 'Lead', createdAt: createdAt - 6 * DAY, lastActivity: createdAt,
      activities: [
        { t: createdAt, type: 'enquiry', detail: `Sample/advice request: ${project}`, points: 50 },
        { t: createdAt - 2 * HOUR, type: 'bim_download', detail: `BIM download (Revit) · ${products[0]}`, points: 15 },
        { t: createdAt - 3 * HOUR, type: 'view_product', detail: `Viewed ${products[0]}`, points: 3 },
        { t: createdAt - 3 * DAY, type: 'email_click', detail: 'Clicked: BIM objects for Revit & ArchiCAD', points: 5 },
      ],
      pendingRequestIds: [], handRaiser: true,
    };
    s.prospects.push(pr);

    const req = {
      id: uid('rq'), seed: true, ref: `VB-2026-${String(++s.counters.request).padStart(4, '0')}`, t: createdAt,
      prospectId: pr.id, leadId: null,
      types: r() > 0.3 ? ['Samples', 'Advice'] : ['Advice'],
      project: { name: project, type, phase, area, start: '2027-03', applications: APPS_BY_TYPE[type] || ['floor-res'] },
      products, samples: [], message: '',
      contact: { name, email, phone: r() > 0.4 ? '+49 30 23125 ' + (200 + i) : '', company, role, country, postcode, city },
    };
    if (req.types.includes('Samples')) req.samples = products.map((id) => ({ productId: id, format: '30×60' }));
    s.requests.push(req);

    const ruleHit = applyRules(s.rules, region, segment);
    const assignedAt = createdAt + (2 + Math.floor(r() * 3)) * 60e3;
    const statusRoll = i % 7;
    const contacted = statusRoll !== 0;
    const firstContactAt = contacted ? createdAt + (1.5 + r() * (i % 3 === 0 ? 30 : 14)) * HOUR : null;
    const lead = {
      id: uid('ld'), seed: true, ref: `L-${++s.counters.lead}`, prospectId: pr.id, requestIds: [req.id],
      name, email, phone: req.contact.phone, company, role, segment, region, country, postcode, city,
      project: req.project, products, samples: req.samples, message: '',
      source: 'Website enquiry', status: contacted ? (statusRoll > 3 ? 'Qualified' : 'Working') : 'New',
      createdAt: createdAt + 2 * 60e3, assignedAt, ownerId: ruleHit.ownerId, ruleIndex: ruleHit.index,
      firstContactAt, ai: null, priority: phase >= 5 || area >= 1000 ? 'High' : phase >= 3 ? 'Medium' : 'Low', oppId: null,
      history: [], drafts: [],
    };
    lead.ai = {
      status: r() > 0.25 ? 'accepted' : 'dismissed', priority: lead.priority, summary: `${name} (${company}) asks about ${project}.`,
      missing: [], checks: [], nextSteps: [], suggestedOwnerId: lead.ownerId, model: 'Claude Haiku 5.5', costUSD: 0.0007,
    };
    req.leadId = lead.id;
    pr.leadId = lead.id;
    s.leads.push(lead);

    s.tasks.push({
      id: uid('tk'), seed: true, leadId: lead.id, ownerId: lead.ownerId, subject: 'First contact: sample/advice request',
      kind: 'first-contact', due: addWorkingDays(lead.createdAt, s.settings.slaDays), createdAt: lead.createdAt,
      status: contacted ? 'Done' : 'Open', doneAt: firstContactAt,
    });

    if (req.samples.length && contacted) {
      const shipped = createdAt + (1 + r() * 2) * DAY;
      const delivered = shipped + 1.5 * DAY;
      s.orders.push({
        id: uid('so'), seed: true, ref: `S-${++s.counters.order}`, leadId: lead.id, requestId: req.id, items: req.samples,
        status: delivered < now ? 'Delivered' : shipped < now ? 'Shipped' : 'Picking', createdAt: firstContactAt,
        shippedAt: shipped < now ? shipped : null, deliveredAt: delivered < now ? delivered : null,
        carrier: 'DHL', tracking: shipped < now ? `JJD0001${Math.floor(r() * 9e6 + 1e6)}` : null,
      });
    }

    if (statusRoll > 3 || i < 3) {
      if (!contacted) return;
      const stage = 1 + ((i * 3) % OPP_STAGES.length);
      const opp = {
        id: uid('op'), seed: true, ref: `O-${++s.counters.opp}`, name: `${company === '—' ? name : company} – ${project}`,
        account: company === '—' ? name : company, leadId: lead.id, ownerId: lead.ownerId, stage, lost: false,
        area, amount: area * (38 + Math.floor(r() * 30)), createdAt: firstContactAt + 2 * DAY,
        closeDate: createdAt + (60 + Math.floor(r() * 120)) * DAY, products, history: [{ t: firstContactAt + 2 * DAY, stage: 1 }],
      };
      if (opp.createdAt > now) opp.createdAt = now - HOUR;
      s.opps.push(opp);
      lead.oppId = opp.id;
      lead.status = 'Converted';
    }
  });

  NURTURE_ONLY.forEach((p, i) => {
    const [name, company, role, country, postcode, city, phase, score] = p;
    const t = now - (i + 2) * 2.1 * DAY;
    s.prospects.push({
      id: uid('pr'), seed: true, name, email: `${name.split(' ')[0].toLowerCase()}@example.com`, company, role,
      segment: segmentFor(role), region: regionFor(country, postcode), country, postcode, city, phase, area: 0,
      grade: gradeFor(role, 0, phase), score, consent: { privacy: true, marketing: 'confirmed' },
      programme: nurtureFor(phase), status: 'Nurturing', createdAt: t, lastActivity: t + DAY,
      activities: [
        { t: t + DAY, type: 'email_click', detail: 'Clicked: Slip resistance explained', points: 5 },
        { t, type: 'bim_download', detail: 'BIM download (SketchUp) via CADENAS registration', points: 15 },
      ],
      pendingRequestIds: [], handRaiser: false, leadId: null,
    });
  });

  s.prospects.sort((a, b) => b.lastActivity - a.lastActivity);
  s.leads.sort((a, b) => b.createdAt - a.createdAt);
  s.requests.sort((a, b) => b.t - a.t);

  s.events.push({ id: uid('ev'), t: now, system: 'Demo', message: 'Demo data loaded: 14 historical enquiries, 6 nurture prospects, simulated Salesforce org.' });
  return s;
}

export function freshVisitor() {
  return {
    sessionId: uid('sess'),
    consentAnalytics: null,
    prospectId: null,
    registered: null,
    saved: [],
    requestIds: [],
    contact: null,
  };
}
