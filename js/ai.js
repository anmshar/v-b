// Simulated AI for the three pilot use cases. Deterministic and offline so the demo
// always works; in production these calls go to Claude + multimodal embeddings.
import { PRODUCTS, APPLICATIONS, bestSurface, reqLabel, SLIP_RANK, productById } from './data/catalog.js';
import { colorFamilies, colorDist, rgbToHex, rgbToHsl, fmtPct, parseFormat } from './util.js';
import { hoaiLabel, ownerById } from './domain.js';

// ---------------- 1. Product discovery (text) ----------------
const CONTEXT_WORDS = [
  ['kitchen-com', /\b(commercial|restaurant|canteen|gastro|professional|industrial)\s+kitchens?\b|\bgastronomie|großküche|kantine/],
  ['pool', /\bpool|swimming|schwimmbad/],
  ['wet', /\bshowers?\b|dusche|\bspa\b|wellness|changing room|umkleide|wet area|nassbereich|barefoot|barfu/],
  ['outdoor', /outdoor|terrace|terrasse|balcon|balkon|patio|garden|garten|außen|aussen|exterior/],
  ['floor-com', /lobby|hotel|retail|shop|store|restaurant|office|büro|buero|school|schule|hospital|klinik|clinic|commercial|public|airport|foyer|entrance|eingang|corridor|flur|museum|café|cafe/],
  ['wall', /\bwalls?\b|wand|backsplash|splashback|fliesenspiegel/],
  ['floor-res', /\bfloor|boden|living|wohn|home|residential|apartment|wohnung|house|haus|bathroom|bad\b/],
];
const LOOK_WORDS = [
  ['concrete', /concrete|cement|beton|industrial|loft|plaster|zement/],
  ['wood', /\bwood|oak|eiche|timber|parquet|parkett|plank|holz/],
  ['marble', /marble|marmor|calacatta|statuario|veined/],
  ['terrazzo', /terrazzo|speckle/],
  ['stone', /\bstone|slate|basalt|limestone|natural stone|naturstein|schiefer|stein/],
  ['plain', /\bplain|solid colou?r|uni\b|single colou?r|einfarbig/],
];
const COLOUR_WORDS = [
  ['light', /\bwhite|weiß|weiss|light|hell|bright|cream|creme/],
  ['dark', /anthracite|anthrazit|dark|dunkel|black|schwarz|charcoal|graphit/],
  ['grey', /\bgr[ae]y|grau|silver/],
  ['warm', /warm|beige|sand|honey|honig|natural tone|greige|taupe|tortora/],
  ['green', /green|grün|gruen|sage|salbei|olive/],
  ['blue', /blue|blau|petrol|teal/],
  ['red', /terracotta|red|rot|orange|rust/],
];

export const EXAMPLE_QUERIES = [
  'Hotel lobby floor, warm grey concrete look, large format',
  'Spa showers, barefoot, dark natural stone',
  'Restaurant kitchen floor, easy to clean',
  'Terrace and pool deck in sand colour',
  'Bathroom wall tiles in sage green, handmade feel',
  'Holzoptik für Hotelzimmer, warm',
];

export function interpret(query) {
  const q = ` ${query.toLowerCase()} `;
  const contexts = [];
  for (const [k, re] of CONTEXT_WORDS) if (re.test(q)) contexts.push(k);
  // A commercial context makes generic "floor" commercial, not residential.
  if (contexts.includes('floor-com') && contexts.includes('floor-res') && !/bathroom|home|residential|apartment|wohnung/.test(q)) {
    contexts.splice(contexts.indexOf('floor-res'), 1);
  }
  if (contexts.includes('kitchen-com') && contexts.includes('floor-com')) contexts.splice(contexts.indexOf('floor-com'), 1);
  const looks = LOOK_WORDS.filter(([, re]) => re.test(q)).map(([k]) => k);
  const colours = COLOUR_WORDS.filter(([, re]) => re.test(q)).map(([k]) => k);
  let size = null;
  if (/large|big|xxl|großformat|grossformat|slab|120|260/.test(q)) size = 'large';
  else if (/small|mosaic|kleinformat|subway|metro|10x30|10×30/.test(q)) size = 'small';
  const fm = q.match(/(\d{2,3})\s*[x×]\s*(\d{2,3})/);
  const explicitFormat = fm ? `${fm[1]}×${fm[2]}` : null;
  let surface = null;
  if (/matt|matte/.test(q)) surface = 'matt';
  if (/polished|poliert|glossy|glänzend|shiny/.test(q)) surface = 'polished';
  if (/anti.?slip|non.?slip|rutschhemmend|grip|structured/.test(q)) surface = 'grip';
  if (/easy to clean|hygien|pflegeleicht/.test(q)) surface = surface || 'easy-clean';
  const slipM = q.match(/\br(9|10|11|12|13)\b/);
  const explicitSlip = slipM ? `R${slipM[1]}` : null;
  return { contexts, looks, colours, size, explicitFormat, surface, explicitSlip };
}

function requirementFor(contexts, explicitSlip) {
  const req = {};
  for (const c of contexts) {
    const r = APPLICATIONS[c]?.req;
    if (!r) continue;
    if (r.slip && (!req.slip || SLIP_RANK[r.slip] > SLIP_RANK[req.slip])) req.slip = r.slip;
    if (r.barefoot && (!req.barefoot || r.barefoot > req.barefoot)) req.barefoot = r.barefoot;
    if (r.frost) req.frost = true;
  }
  if (explicitSlip && (!req.slip || SLIP_RANK[explicitSlip] > SLIP_RANK[req.slip])) req.slip = explicitSlip;
  return Object.keys(req).length ? req : null;
}

export function searchText(query) {
  const it = interpret(query);
  const req = requirementFor(it.contexts, it.explicitSlip);
  const results = [];
  for (const p of PRODUCTS) {
    const c = p.collection;
    let score = 4;
    const reasons = [];
    const checks = [];
    // Application fit
    const appMiss = it.contexts.filter((k) => !c.applications.includes(k));
    if (it.contexts.length && appMiss.length === it.contexts.length) continue;
    if (appMiss.length) {
      score -= 12;
      checks.push({ ok: false, text: `Not intended for ${appMiss.map((k) => APPLICATIONS[k].label.toLowerCase()).join(', ')}` });
    }
    // Look
    if (it.looks.length) {
      if (it.looks.includes(c.look)) {
        score += 34;
        reasons.push(`${cap(c.look)} look, as described`);
      } else score -= 10;
    }
    // Colour
    if (it.colours.length) {
      const fam = colorFamilies(p.hex);
      const hit = it.colours.filter((k) => (k === 'grey' ? fam.has('mid-grey') : fam.has(k)));
      if (hit.length) {
        score += 14 * hit.length;
        reasons.push(`Colour ${p.colourName} reads as ${hit.join(' / ')}`);
      } else score -= 6;
    }
    // Format
    const sizes = c.formats.map((f) => Math.max(...parseFormat(f)));
    if (it.size === 'large') {
      if (Math.max(...sizes) >= 120) {
        score += 10;
        reasons.push(`Large formats up to ${c.formats.find((f) => Math.max(...parseFormat(f)) === Math.max(...sizes))}`);
      } else score -= 4;
    }
    if (it.size === 'small') {
      if (Math.min(...sizes) <= 40) {
        score += 10;
        reasons.push(`Small formats from ${c.formats[0]}`);
      } else score -= 4;
    }
    if (it.explicitFormat) {
      if (c.formats.some((f) => f.startsWith(it.explicitFormat))) {
        score += 14;
        reasons.push(`Available in ${it.explicitFormat}`);
      } else checks.push({ ok: false, text: `${it.explicitFormat} not in range (${c.formats.join(', ')})` });
    }
    // Surface
    if (it.surface === 'polished' && c.surfaces.some((s) => /polished|glossy|lappato/i.test(s.id))) {
      score += 6;
      reasons.push('Polished / glossy surface available');
    }
    if (it.surface === 'matt' && c.surfaces.some((s) => s.id === 'matt')) score += 4;
    if (it.surface === 'easy-clean' && /through-body|technical/i.test(c.material + c.tagline)) {
      score += 12;
      reasons.push('Through-body technical porcelain, easy to clean');
    }
    // Slip / safety check: the "R9 vs R10" check from the brief
    let surface = c.surfaces[0];
    if (req) {
      const best = bestSurface(c, req);
      if (best) {
        surface = best;
        score += 16;
        checks.push({ ok: true, text: `${best.name} surface: ${best.slip}${best.barefoot ? ` / ${best.barefoot}` : ''} meets ${reqLabel(req)}` });
      } else {
        score -= 22;
        const top = [...c.surfaces].sort((a, b) => (SLIP_RANK[b.slip] || 0) - (SLIP_RANK[a.slip] || 0))[0];
        checks.push({ ok: false, text: `Best surface ${top.slip}${top.barefoot ? ` / ${top.barefoot}` : ''} is below ${reqLabel(req)}` });
      }
    }
    if (!it.looks.length && !it.colours.length && !it.contexts.length && !it.size && !it.explicitFormat) {
      // Free text we could not interpret: fall back to tag/name match.
      const words = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
      const hay = `${p.name} ${c.tags.join(' ')} ${c.tagline}`.toLowerCase();
      const hits = words.filter((w) => hay.includes(w));
      if (!hits.length) continue;
      score += 20 * hits.length;
      reasons.push(`Matches “${hits.join('”, “')}”`);
    }
    if (score >= 18) results.push({ product: p, score, reasons, checks, surface });
  }
  results.sort((a, b) => b.score - a.score);
  const top = results.slice(0, 9);
  const max = top[0]?.score || 1;
  top.forEach((x) => (x.match = Math.max(0.42, Math.min(0.98, 0.55 + (x.score / max) * 0.43 - (x.checks.some((c) => !c.ok) ? 0.12 : 0)))));
  return { query, interpretation: it, requirement: req, results: top, zero: top.length === 0 };
}

export function describeInterpretation(it, req) {
  const out = [];
  if (it.contexts.length) out.push(['Use', it.contexts.map((k) => APPLICATIONS[k].label).join(', ')]);
  if (req) out.push(['Required', reqLabel(req) + ' (simplified guidance)']);
  if (it.looks.length) out.push(['Look', it.looks.join(', ')]);
  if (it.colours.length) out.push(['Colour', it.colours.join(', ')]);
  if (it.size || it.explicitFormat) out.push(['Format', it.explicitFormat || `${it.size} format`]);
  if (it.surface) out.push(['Surface', it.surface]);
  return out;
}

// ---------------- 1b. Product discovery (photo) ----------------
export function analyseImage(source) {
  const W = 96, H = 96;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;
  let r = 0, g = 0, b = 0;
  const lum = new Float32Array(W * H);
  for (let i = 0, k = 0; i < d.length; i += 4, k++) {
    r += d[i]; g += d[i + 1]; b += d[i + 2];
    lum[k] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  }
  const n = W * H;
  r /= n; g /= n; b /= n;
  let mean = 0;
  for (const v of lum) mean += v;
  mean /= n;
  let varSum = 0, gx = 0, gy = 0, speck = 0, hueSpread = 0;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const k = y * W + x;
      varSum += (lum[k] - mean) ** 2;
      const dx = Math.abs(lum[k + 1] - lum[k - 1]);
      const dy = Math.abs(lum[k + W] - lum[k - W]);
      gx += dx; gy += dy;
      if (dx + dy > 60) speck++;
      const i = k * 4;
      hueSpread += Math.abs(d[i] - r) + Math.abs(d[i + 2] - b);
    }
  }
  const std = Math.sqrt(varSum / n);
  const aniso = (Math.max(gx, gy) + 1) / (Math.min(gx, gy) + 1);
  const speckRate = speck / n;
  const hueVar = hueSpread / n;
  const hex = rgbToHex(r, g, b);
  const [, sat, light] = rgbToHsl(r, g, b);
  let look;
  if (aniso > 1.45 && std > 9) look = 'wood';
  else if (speckRate > 0.06 && hueVar > 34) look = 'terrazzo';
  else if (light > 0.72 && std > 9) look = 'marble';
  else if (std < 6.5) look = 'plain';
  else if (light < 0.42 || speckRate > 0.035) look = 'stone';
  else look = 'concrete';
  return { hex, std, aniso, speckRate, light, sat, look, preview: cv.toDataURL('image/jpeg', 0.8) };
}

export function searchByFeatures(f) {
  const results = PRODUCTS.map((p) => {
    const dist = colorDist(f.hex, p.hex);
    const colourSim = Math.max(0, 1 - dist / 260);
    const lookHit = p.look === f.look;
    const score = colourSim * 60 + (lookHit ? 35 : 0);
    const reasons = [`Colour similarity ${fmtPct(colourSim)} to the photo's dominant tone`];
    if (lookHit) reasons.push(`Texture reads as ${f.look}, like ${p.collection.name}`);
    return { product: p, score, reasons, checks: [], surface: p.collection.surfaces[0], match: Math.min(0.97, 0.3 + score / 100) };
  });
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 8);
}

// ---------------- 2. Enquiry qualification & next best action ----------------
export function summariseEnquiry(lead, prospect, s) {
  const pr = lead.project || {};
  const prods = (lead.products || []).map(productById).filter(Boolean);
  const apps = pr.applications || [];
  const missing = [];
  if (!lead.phone) missing.push('Phone number (needed for the first call)');
  if (!pr.phase) missing.push('Project phase (HOAI)');
  if (!pr.area) missing.push('Area in m²');
  if (!pr.start) missing.push('Planned start / tender date');
  if (!apps.length) missing.push('Where the tiles go (floor, wall, wet area, outdoor)');
  if (!prods.length) missing.push('Products of interest');

  const checks = [];
  for (const p of prods) {
    for (const a of apps) {
      const ap = APPLICATIONS[a];
      if (!ap) continue;
      if (!p.collection.applications.includes(a)) {
        checks.push({ ok: false, text: `${p.name} is not intended for ${ap.label.toLowerCase()}; suggest an alternative.` });
        continue;
      }
      if (!ap.req) continue;
      const best = bestSurface(p.collection, ap.req);
      if (best) checks.push({ ok: true, text: `${p.name}: use ${best.name} (${best.slip}${best.barefoot ? '/' + best.barefoot : ''}) for ${ap.label.toLowerCase()}.` });
      else checks.push({ ok: false, text: `${p.name} does not reach ${reqLabel(ap.req)} for ${ap.label.toLowerCase()}.` });
    }
  }

  const phase = Number(pr.phase) || 0;
  let pts = 0;
  const why = [];
  if (phase >= 5 && phase <= 7) { pts += 2; why.push(`${hoaiLabel(phase)}: products are being specified now`); }
  else if (phase >= 3) { pts += 1; why.push(`${hoaiLabel(phase)}: design decisions ahead`); }
  if (pr.area >= 1000) { pts += 2; why.push(`${pr.area.toLocaleString('en-GB')} m² is a large project`); }
  else if (pr.area >= 250) { pts += 1; why.push(`${pr.area} m² mid-size project`); }
  if ((lead.samples || []).length) { pts += 1; why.push('samples requested (hand-raiser)'); }
  if (prospect?.grade === 'A') { pts += 1; why.push('grade A in Account Engagement'); }
  const priority = pts >= 4 ? 'High' : pts >= 2 ? 'Medium' : 'Low';

  const owner = ownerById(lead.ownerId);
  const nextSteps = [];
  nextSteps.push({ text: `Call ${lead.name.split(' ')[0]} within 1 working day to confirm scope${missing.length ? ' and collect missing details' : ''}.`, task: false });
  if ((lead.samples || []).length) nextSteps.push({ text: `Release ${lead.samples.length} sample(s) to customer service (${lead.samples.map((x) => productById(x.productId)?.name).filter(Boolean).join(', ')}).`, task: true, kind: 'samples' });
  if (checks.some((c) => !c.ok)) nextSteps.push({ text: 'Propose a compliant alternative for the flagged product/application.', task: true, kind: 'alt' });
  if (phase >= 5 && phase <= 7) nextSteps.push({ text: 'Send tender texts (GAEB) and technical data sheets.', task: true, kind: 'tender' });
  if (phase && phase <= 3) nextSteps.push({ text: 'Offer BIM objects and a design consultation.', task: true, kind: 'bim' });

  const prodTxt = prods.length ? prods.map((p) => p.name).join(' and ') : 'products not yet chosen';
  const summary =
    `${lead.name} (${lead.role}, ${lead.company !== '—' ? lead.company + ', ' : ''}${lead.city}) ` +
    `${(lead.samples || []).length ? 'requests samples of' : 'asks for advice on'} ${prodTxt} for “${pr.name || 'unnamed project'}”` +
    `${pr.type ? ` (${pr.type.toLowerCase()}` : ''}${pr.area ? `, ${pr.area.toLocaleString('en-GB')} m²` : ''}${phase ? `, ${hoaiLabel(phase)}` : ''}${pr.type ? ')' : ''}.` +
    (apps.length ? ` Use: ${apps.map((a) => APPLICATIONS[a]?.label.toLowerCase()).join(', ')}.` : '') +
    (lead.message ? ` Note from customer: “${lead.message.slice(0, 160)}”` : '');

  const tokensIn = 2600 + Math.round(Math.random() * 600);
  const tokensOut = 650 + Math.round(Math.random() * 200);
  return {
    status: 'pending', summary, missing, checks, priority, priorityWhy: why, suggestedOwnerId: owner.id,
    nextSteps, model: 'Claude Haiku 5.5 (simulated)', tokensIn, tokensOut,
    costUSD: (tokensIn * 0.1 + tokensOut * 0.5) / 1e6, createdAt: Date.now(),
  };
}

// ---------------- 3. Journey & signal insights ----------------
export function journeyFunnel(s) {
  const b = s.baseline;
  const live = (type) => s.analytics.filter((e) => e.type === type).length;
  return [
    { key: 'search', label: 'Searches', value: b.searches + live('search') + live('photo_search') },
    { key: 'product', label: 'Product views', value: Math.round(b.searches * b.searchToProduct) + live('view_product') },
    { key: 'bimclick', label: 'BIM download clicks', value: b.bimClicks + live('bim_click') },
    { key: 'bimreg', label: 'CADENAS registration done', value: b.bimRegistrations + live('bim_register') },
    { key: 'enqstart', label: 'Enquiry started', value: b.enquiryStarts + live('enquiry_start') },
    { key: 'enqsubmit', label: 'Enquiry submitted', value: b.enquirySubmits + live('enquiry_submit') },
  ];
}

export function insightReport(s) {
  const b = s.baseline;
  const f = journeyFunnel(s);
  const v = Object.fromEntries(f.map((x) => [x.key, x.value]));
  const zeroLive = s.analytics.filter((e) => e.type === 'search_zero').length;
  const zeroRate = (b.zeroResults + zeroLive) / v.search;
  const regDrop = 1 - v.bimreg / v.bimclick;
  const formDrop = 1 - v.enqsubmit / v.enqstart;
  const findings = [
    {
      title: `${fmtPct(regDrop)} of BIM download clicks stop at the CADENAS registration`,
      detail: `${v.bimclick.toLocaleString('en-GB')} clicks, ${v.bimreg.toLocaleString('en-GB')} registrations. This is the largest single drop in the journey and hides interested architects from sales.`,
      action: 'Test pre-filling registration for known visitors and a “download without account” option for 2D files.',
      test: 'A/B: registration wall vs. pre-filled one-step registration · KPI downloads per click',
    },
    {
      title: `${fmtPct(zeroRate, 1)} of searches return nothing in today's selector`,
      detail: `Top zero-result queries: ${b.topZeroQueries.slice(0, 3).map((q) => `“${q[0]}”`).join(', ')}. AI discovery maps these to safety classes and looks instead of exact keywords.`,
      action: 'Route zero-result queries into AI discovery and review the top 20 monthly with product management.',
      test: 'A/B: keyword selector vs. AI discovery · KPI share of searches that open a product',
    },
    {
      title: `${fmtPct(formDrop)} of started enquiries are abandoned`,
      detail: `Most abandonment happens at “${b.formDropFields[0][0]}” (${fmtPct(b.formDropFields[0][1])} of drop-offs) and “${b.formDropFields[1][0]}”.`,
      action: 'Make HOAI phase a visual picker with “not sure”, and make phone optional with a call-back option.',
      test: 'A/B: current form vs. picker + optional phone · KPI completed enquiries',
    },
  ];
  const tokensIn = 200000, tokensOut = 5000;
  return {
    period: `Last ${b.months} months + live demo events`,
    funnel: f,
    findings,
    model: 'Claude Sonnet 5.5 (simulated)',
    costUSD: (tokensIn * 2 + tokensOut * 10) / 1e6,
    createdAt: Date.now(),
  };
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
