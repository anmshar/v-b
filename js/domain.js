// Pure domain rules shared by the seed data and the live engine (no store access).
import { addWorkingDays } from './util.js';

export const ROLES = ['Architect', 'Interior designer', 'Planner / engineer', 'Contractor / tiler', 'Developer / investor', 'Private customer'];
export const COUNTRIES = ['Germany', 'Austria', 'Switzerland', 'Other'];
export const PROJECT_TYPES = ['Hotel', 'Office', 'Retail', 'Healthcare', 'Education', 'Residential (multi-unit)', 'Residential (single home)', 'Public / culture', 'Other'];

export const HOAI = [
  { n: 1, de: 'Grundlagenermittlung', en: 'Basic evaluation' },
  { n: 2, de: 'Vorplanung', en: 'Preliminary design' },
  { n: 3, de: 'Entwurfsplanung', en: 'Design planning' },
  { n: 4, de: 'Genehmigungsplanung', en: 'Approval planning' },
  { n: 5, de: 'Ausführungsplanung', en: 'Execution planning' },
  { n: 6, de: 'Vorbereitung der Vergabe', en: 'Tender preparation' },
  { n: 7, de: 'Mitwirkung bei der Vergabe', en: 'Contract award' },
  { n: 8, de: 'Objektüberwachung', en: 'Site supervision' },
  { n: 9, de: 'Objektbetreuung', en: 'Aftercare' },
];
export const hoaiLabel = (n) => {
  const p = HOAI.find((x) => x.n === Number(n));
  return p ? `LP${p.n} ${p.en}` : '—';
};

// Placeholder: V&B's nine stages and exit criteria still need to be confirmed (needs V&B access).
export const OPP_STAGES = [
  'Project identified',
  'Qualified',
  'Design & specification',
  'Samples & consulting',
  'Specified in tender',
  'Offer submitted',
  'Negotiation',
  'Won – order placed',
  'Delivered & closed',
];

export const REGIONS = ['North', 'East', 'West', 'South', 'Austria', 'Switzerland', 'International'];
export const SEGMENTS = ['Specifier', 'Trade', 'Key account', 'Private'];

export function segmentFor(role) {
  if (['Architect', 'Interior designer', 'Planner / engineer'].includes(role)) return 'Specifier';
  if (role === 'Contractor / tiler') return 'Trade';
  if (role === 'Developer / investor') return 'Key account';
  return 'Private';
}

export function regionFor(country, postcode) {
  if (country === 'Austria') return 'Austria';
  if (country === 'Switzerland') return 'Switzerland';
  if (country !== 'Germany') return 'International';
  const d = String(postcode || '').trim()[0];
  if (d === '0' || d === '1') return 'East';
  if (d === '2' || d === '3') return 'North';
  if (d === '4' || d === '5') return 'West';
  if (['6', '7', '8', '9'].includes(d)) return 'South';
  return 'International';
}

export const OWNERS = [
  { id: 'o1', name: 'Lena Hoffmann', role: 'Specification advisor North', publicRole: 'Your architect advisor', initials: 'LH', phone: '+49 40 555 0101', email: 'lena.hoffmann@vb-demo.example', color: '#3a6ea5' },
  { id: 'o2', name: 'Marco Weber', role: 'Specification advisor South', publicRole: 'Your architect advisor', initials: 'MW', phone: '+49 89 555 0102', email: 'marco.weber@vb-demo.example', color: '#7a5c99' },
  { id: 'o3', name: 'Aylin Demir', role: 'Specification advisor West', publicRole: 'Your architect advisor', initials: 'AD', phone: '+49 211 555 0103', email: 'aylin.demir@vb-demo.example', color: '#2f8f6f' },
  { id: 'o4', name: 'Jonas Richter', role: 'Specification advisor East', publicRole: 'Your architect advisor', initials: 'JR', phone: '+49 30 555 0104', email: 'jonas.richter@vb-demo.example', color: '#b06a2c' },
  { id: 'o5', name: 'Sophie Keller', role: 'Key account manager', publicRole: 'Your key account manager', initials: 'SK', phone: '+49 69 555 0105', email: 'sophie.keller@vb-demo.example', color: '#a0405a' },
  { id: 'o6', name: 'Tobias Wagner', role: 'Trade sales Germany', publicRole: 'Your trade sales contact', initials: 'TW', phone: '+49 221 555 0106', email: 'tobias.wagner@vb-demo.example', color: '#4f7f2f' },
  { id: 'o7', name: 'Clara Fischer', role: 'Export sales DACH & international', publicRole: 'Your sales advisor', initials: 'CF', phone: '+49 6864 555 0107', email: 'clara.fischer@vb-demo.example', color: '#2b7c8c' },
  { id: 'o8', name: 'Inside sales queue', role: 'Queue · customer service', publicRole: 'Customer service team', initials: 'IS', phone: '+49 6864 555 0100', email: 'service@vb-demo.example', color: '#6b7280' },
];
export const ownerById = (id) => OWNERS.find((o) => o.id === id) || OWNERS[7];

export const DEFAULT_RULES = [
  { id: 'r1', region: 'Any', segment: 'Key account', ownerId: 'o5' },
  { id: 'r2', region: 'Any', segment: 'Trade', ownerId: 'o6' },
  { id: 'r3', region: 'Any', segment: 'Private', ownerId: 'o8' },
  { id: 'r4', region: 'North', segment: 'Specifier', ownerId: 'o1' },
  { id: 'r5', region: 'South', segment: 'Specifier', ownerId: 'o2' },
  { id: 'r6', region: 'West', segment: 'Specifier', ownerId: 'o3' },
  { id: 'r7', region: 'East', segment: 'Specifier', ownerId: 'o4' },
  { id: 'r8', region: 'Austria', segment: 'Any', ownerId: 'o7' },
  { id: 'r9', region: 'Switzerland', segment: 'Any', ownerId: 'o7' },
  { id: 'r10', region: 'International', segment: 'Any', ownerId: 'o7' },
];

export function applyRules(rules, region, segment) {
  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    if ((r.region === 'Any' || r.region === region) && (r.segment === 'Any' || r.segment === segment)) {
      return { rule: r, index: i + 1, ownerId: r.ownerId };
    }
  }
  return { rule: null, index: null, ownerId: 'o8' };
}

export function gradeFor(role, area, phase) {
  const seg = segmentFor(role);
  let g = seg === 'Specifier' ? 3 : seg === 'Key account' ? 3 : seg === 'Trade' ? 2 : 1;
  if (area >= 1000) g += 1;
  else if (area && area < 100) g -= 1;
  if (phase >= 3 && phase <= 7) g += 0.5;
  if (g >= 4) return 'A';
  if (g >= 3) return 'B';
  if (g >= 2) return 'C';
  return 'D';
}

export function nurtureFor(phase) {
  const p = Number(phase) || 0;
  if (p >= 6) return 'Tender & samples (LP6–9)';
  if (p >= 4) return 'Technical specification (LP4–5)';
  if (p >= 1) return 'Inspiration & BIM (LP1–3)';
  return 'General newsletter';
}

export const NURTURE_EMAILS = {
  'Inspiration & BIM (LP1–3)': ['Project references: hotels & hospitality', 'BIM objects for Revit & ArchiCAD', 'Large formats: design guide'],
  'Technical specification (LP4–5)': ['Slip resistance explained (R9–R12, A–C)', 'Tender texts & technical data sheets', 'Book a specification call'],
  'Tender & samples (LP6–9)': ['Order a sample box', 'Tender texts (GAEB) for your project', 'Meet your advisor on site'],
  'General newsletter': ['New collections this season', 'Inspiration: bathrooms', 'Event invitation'],
};

export const SCORE = {
  page_view: 1,
  search: 2,
  photo_search: 3,
  view_product: 3,
  configure: 3,
  save: 5,
  bim_download: 15,
  email_open: 2,
  email_click: 5,
  enquiry: 50,
};

export function slaDue(createdAt, days) {
  return addWorkingDays(createdAt, days);
}

// What the architect is allowed to see. Built from internal records, never exposing the nine stages.
export function publicSteps(s, req) {
  const lead = s.leads.find((l) => l.id === req.leadId);
  const order = s.orders.find((o) => o.requestId === req.id);
  const opp = lead && lead.oppId ? s.opps.find((o) => o.id === lead.oppId) : null;
  const owner = lead && lead.ownerId ? ownerById(lead.ownerId) : null;
  const steps = [
    { key: 'received', label: 'Request received', at: req.t, desc: `Reference ${req.ref}. We have your project details.` },
    { key: 'assigned', label: 'Advisor assigned', at: lead?.assignedAt || null, desc: owner ? `${owner.name} · ${owner.publicRole}` : 'Usually within minutes.' },
    { key: 'contact', label: 'Advisor in contact', at: lead?.firstContactAt || null, desc: 'Your advisor gets in touch within one working day.' },
  ];
  if (req.samples.length) {
    steps.push({ key: 'shipped', label: 'Samples dispatched', at: order?.shippedAt || null, desc: order?.tracking ? `Parcel ${order.carrier} ${order.tracking}` : `${req.samples.length} sample(s) requested` });
    steps.push({ key: 'delivered', label: 'Samples delivered', at: order?.deliveredAt || null, desc: '' });
  }
  steps.push({
    key: 'project',
    label: 'Project support active',
    at: opp ? opp.createdAt : null,
    desc: opp ? 'Your advisor supports specification, tender and delivery.' : 'Specification, tender texts and site support.',
  });
  return { steps, owner, lead, order };
}
