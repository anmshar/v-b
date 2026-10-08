// Launcher page and the split-screen guided demo (website left, back office right).
import { getState, subscribe, resetAll } from '../store.js';
import { esc, toast } from '../util.js';

const live = (arr) => arr.filter((x) => !x.seed);

export const STEPS = [
  {
    title: 'Architect describes the project',
    who: 'Website',
    text: 'Accept analytics in the cookie banner, then search in plain language, e.g. “Hotel lobby floor, warm grey concrete look, large format”. Results are ranked with reasons and an R9/R10 slip check.',
    left: '#/site',
    done: (s) => (s.flags.search || 0) > 0,
  },
  {
    title: 'Search by photo',
    who: 'Website',
    text: 'Open 📷 Photo and pick “Concrete loft” or upload any image. The demo reads tone and texture; production uses image embeddings + Claude.',
    left: '#/site/photo',
    done: (s) => (s.flags.photo_search || 0) > 0,
  },
  {
    title: 'Configure and download BIM',
    who: 'Website → CADENAS',
    text: 'Open a product, change format, pattern and joint in the configurator, then download Revit. The CADENAS registration identifies the architect; the download becomes a buying signal in Account Engagement.',
    left: '#/site/product/calce-grigio',
    right: '#/office/prospects',
    done: (s) => (s.flags.bim_download || 0) > 0,
  },
  {
    title: 'Send a sample request',
    who: 'Website → form handler',
    text: 'Save products, then “Request samples”. Use “Fill with demo architect” (Hamburg, LP5, 1,200 m²). The form posts to the Account Engagement form handler.',
    left: '#/site/enquiry',
    right: '#/office/integration',
    done: (s) => live(s.requests).length > 0,
  },
  {
    title: 'Watch the hand-over into Salesforce',
    who: 'Account Engagement → Sales Cloud',
    text: 'The prospect is created, graded and — as a hand-raiser — synced at once (≈ 2 min in reality, a few seconds here). The assignment rule picks the owner by region + segment and creates a due task. The architect’s status page shows the named advisor.',
    left: '#/site/workspace',
    right: '#/office/integration',
    done: (s) => live(s.leads).some((l) => l.ownerId),
  },
  {
    title: 'Sales reviews the AI suggestion',
    who: 'Sales Cloud · AI use case 2',
    text: 'Open the new lead: the enquiry is summarised, missing details and product checks flagged, priority and next steps suggested. Accept it — tasks are created; nothing is emailed automatically.',
    right: () => {
      const l = live(getState().leads)[0];
      return l ? `#/office/leads/${l.id}` : '#/office/leads';
    },
    done: (s) => live(s.leads).some((l) => l.ai && l.ai.status !== 'pending'),
  },
  {
    title: 'First contact within one working day',
    who: 'Sales Cloud',
    text: 'Log the call on the lead. The first-contact task closes with its SLA time, and the architect sees “Advisor in contact”. Try “+1 day” in the header to see overdue SLAs.',
    left: '#/site/workspace',
    right: () => {
      const l = live(getState().leads)[0];
      return l ? `#/office/leads/${l.id}` : '#/office/leads';
    },
    done: (s) => live(s.leads).some((l) => l.firstContactAt),
  },
  {
    title: 'Customer service ships the samples',
    who: 'Customer service',
    text: 'Release samples from the lead, then in Sample orders: start picking → ship. The status page shows the parcel number.',
    right: '#/office/service',
    left: '#/site/workspace',
    done: (s) => live(s.orders).some((o) => o.shippedAt),
  },
  {
    title: 'Opportunity through nine stages — architect sees status only',
    who: 'Sales Cloud',
    text: 'Convert the lead and move the opportunity through the stages. The architect’s page only changes to “Project support active” — internal stages stay hidden.',
    right: '#/office/opps',
    left: '#/site/workspace',
    done: (s) => live(s.opps).some((o) => o.stage >= 3),
  },
  {
    title: 'Nurture: weaker signals wait for the threshold',
    who: 'Account Engagement',
    text: 'Open a nurturing prospect (e.g. Mia Schröder, score 88) and simulate email clicks. At 100 the prospect becomes sales-ready and lands in Sales Cloud with an owner.',
    right: '#/office/prospects?f=nurture',
    done: (s) => s.prospects.some((p) => p.seed && !p.handRaiser && p.leadId),
  },
  {
    title: 'Journey insights for marketing',
    who: 'AI use case 3',
    text: 'Generate the monthly insight report: biggest drop-offs (CADENAS registration, zero-result searches, form fields) with proposed fixes and A/B tests.',
    right: '#/office/insights',
    done: (s) => !!s.insight,
  },
];

export function launcher() {
  return {
    title: 'V&B Tiles demo',
    render() {
      return `
      <div class="launch">
        <header><span class="logo">V&amp;B</span><div><h1>V&amp;B Tiles — client journey &amp; back-office demo</h1><p class="lead">From an architect's first search to a qualified Salesforce lead, samples and project support. Everything runs in your browser with simulated data.</p><p class="muted small">Concept prototype for discussion, not an official V&amp;B website.</p></div></header>
        <div class="launch-cards">
          <a class="lcard primary" href="#/demo"><span class="ic">▣▣</span><h2>Guided split-screen demo</h2><p>Website on the left, back office on the right, with an 11-step tour. Best for presenting.</p></a>
          <a class="lcard" href="#/site" target="_blank" rel="noopener"><span class="ic">◧</span><h2>Architect website</h2><p>Discovery (text + photo), configurator, BIM/CAD, samples request, status page.</p></a>
          <a class="lcard" href="#/office" target="_blank" rel="noopener"><span class="ic">◨</span><h2>Back office</h2><p>Account Engagement, Sales Cloud leads, tasks, opportunities, sample dispatch, insights, integration log.</p></a>
        </div>
        <div class="launch-info">
          <section><h3>What this demo shows</h3><ul>
            <li>Every website enquiry becomes a Sales Cloud lead with an owner from assignment rules and a due task.</li>
            <li>Account Engagement for capture, consent, scoring and nurture; hand-raisers go to sales at once.</li>
            <li>The architect sees request status only, never the nine opportunity stages.</li>
            <li>BIM/CAD: existing CADENAS files, linked per product; downloads become buying signals.</li>
            <li>Three AI pilots: discovery by text and photo, enquiry qualification, journey insights.</li>
          </ul></section>
          <section><h3>What is simulated</h3><ul>
            <li>Salesforce, Account Engagement, CADENAS, Salsify and SAP are mocked; no data leaves the browser.</li>
            <li>AI responses are deterministic stand-ins with realistic cost figures (Claude Haiku/Sonnet 5.5).</li>
            <li>Product names, stage names, owners and rules are placeholders to confirm with V&amp;B.</li>
            <li>Connector sync takes seconds instead of ≈ 2 minutes.</li>
          </ul>
          <button class="btn ghost" data-act="reset">Reset demo data</button></section>
        </div>
      </div>`;
    },
    mount(root) {
      root.querySelector('[data-act="reset"]').addEventListener('click', () => {
        resetAll();
        toast('Demo data reset');
      });
    },
  };
}

export function demo() {
  let idx = 0;
  let unsub = null;
  return {
    title: 'Guided demo',
    fullBleed: true,
    render() {
      return `
      <div class="demo">
        <div class="demo-bar">
          <a class="logo sm" href="#/" title="Back to start">V&amp;B</a>
          <div class="tour" id="tour"></div>
          <div class="row gap"><button class="btn tiny ghost" data-act="reset">Reset</button><button class="btn tiny ghost" data-act="layout" title="Stack or side by side">⇆</button></div>
        </div>
        <div class="panes" id="panes">
          <section class="pane"><div class="pane-label">🌐 Architect website <a href="#/site" target="_blank" title="Open in new tab">↗</a></div><iframe id="left" title="Architect website" src="index.html?embed=1#/site"></iframe></section>
          <section class="pane"><div class="pane-label">🏢 Back office · Salesforce (simulated) <a href="#/office" target="_blank" title="Open in new tab">↗</a></div><iframe id="right" title="Back office" src="index.html?embed=1#/office"></iframe></section>
        </div>
      </div>`;
    },
    mount(root) {
      const tour = root.querySelector('#tour');
      const left = root.querySelector('#left');
      const right = root.querySelector('#right');
      const nav = (frame, h) => {
        const hash = typeof h === 'function' ? h() : h;
        if (hash) frame.contentWindow.location.hash = hash;
      };
      const drawTour = () => {
        const s = getState();
        const st = STEPS[idx];
        const doneCount = STEPS.filter((x) => x.done(s)).length;
        tour.innerHTML = `
          <div class="tour-nav"><button class="btn tiny ghost" data-tour="prev" ${idx === 0 ? 'disabled' : ''}>◀</button>
            <select data-tour="sel">${STEPS.map((x, i) => `<option value="${i}" ${i === idx ? 'selected' : ''}>${x.done(s) ? '✓' : '○'} ${i + 1}. ${esc(x.title)}</option>`).join('')}</select>
            <button class="btn tiny ghost" data-tour="next" ${idx === STEPS.length - 1 ? 'disabled' : ''}>▶</button></div>
          <div class="tour-body"><b>${st.done(s) ? '✅' : `Step ${idx + 1}`} · ${esc(st.who)}</b> ${esc(st.text)}</div>
          <div class="tour-act"><button class="btn tiny" data-tour="show">Show me</button><span class="muted small">${doneCount}/${STEPS.length} done</span></div>`;
        tour.querySelector('[data-tour="prev"]').onclick = () => { idx--; drawTour(); };
        tour.querySelector('[data-tour="next"]').onclick = () => { idx++; drawTour(); show(); };
        tour.querySelector('[data-tour="sel"]').onchange = (e) => { idx = Number(e.target.value); drawTour(); show(); };
        tour.querySelector('[data-tour="show"]').onclick = show;
      };
      const show = () => {
        const st = STEPS[idx];
        if (st.left) nav(left, st.left);
        if (st.right) nav(right, st.right);
      };
      let lastDone = STEPS.map((x) => x.done(getState()));
      drawTour();
      unsub = subscribe((s) => {
        const nowDone = STEPS.map((x) => x.done(s));
        // Auto-advance when the current step completes.
        if (!lastDone[idx] && nowDone[idx] && idx < STEPS.length - 1) {
          toast(`✓ Step ${idx + 1} done`, 'ok');
          idx++;
        }
        lastDone = nowDone;
        drawTour();
      });
      root.querySelector('[data-act="reset"]').addEventListener('click', () => {
        if (!confirm('Reset all demo data?')) return;
        resetAll();
        idx = 0;
        left.contentWindow.location.hash = '#/site';
        right.contentWindow.location.hash = '#/office';
        drawTour();
      });
      root.querySelector('[data-act="layout"]').addEventListener('click', () => root.querySelector('#panes').classList.toggle('stacked'));
    },
    unmount() {
      unsub?.();
    },
  };
}

export function resolve(r) {
  return r.parts[0] === 'demo' ? demo() : launcher();
}
