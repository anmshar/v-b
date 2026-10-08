# V&B Tiles: client journey and back-office demo

A clickable prototype of the full journey from the architecture and AI use-case
draft (8 Oct 2026). The architect-facing website and the internal back office
run side by side and share live state. An enquiry on the website shows up in
the back office within seconds as an owned Sales Cloud lead with a due task, and
every back-office action shows up on the architect's status page.

Everything runs in the browser. There is no backend, no build step and no
external calls. All data is simulated.

## Run it

```bash
npx serve -l 8765 .        # or: python3 -m http.server 8765
open http://localhost:8765  # start page: guided demo, website or back office
```

The page has to be served over http(s), because ES modules don't load from `file://`.

## Hosted version (GitHub Pages)

Live at **https://anmshar.github.io/v-b/** once Pages is enabled (see below).

`.github/workflows/pages.yml` runs on every push to `main` (and can be started by hand):

1. builds `_site/` with `scripts/build-site.sh` (only `index.html`, `robots.txt`, `css/` and `js/`
   are published; tests and docs are not),
2. serves it under `/v-b/`, the way Pages does, and runs the full end-to-end test against it,
3. deploys to Pages, but only when the test passes.

Pull requests run steps 1–2 only. If Pages isn't enabled yet, the deploy is skipped with a
warning instead of failing.

**One-time repository settings** (needs repo admin):

1. *Settings → General → Default branch*: switch to `main`.
2. *Settings → Pages → Build and deployment → Source*: choose **GitHub Actions**.
3. Re-run the latest "Test and deploy to GitHub Pages" workflow (Actions tab), or push to `main`.

If the deploy is rejected by environment protection rules, add `main` under
*Settings → Environments → github-pages → Deployment branches*.

The hosted page is public, so it carries a `noindex` tag and a `robots.txt` that ask search
engines not to list it. It also says on the page that it is a concept prototype, not an
official V&B website.

| Route | What it is |
|---|---|
| `#/` | Start page |
| `#/demo` | **Split-screen guided demo**: website left, back office right, 11-step tour that auto-advances |
| `#/site` | Architect website |
| `#/office` | Back office (simulated Salesforce org) |

You can also open `#/site` and `#/office` in two browser tabs; they stay in sync
through `localStorage`. Use **Reset demo data** on the start page or in the
back-office menu to start over.

## What the demo covers

**Architect website**
- **AI product discovery (text):** plain-language project descriptions in English or German
  are ranked with reasons, plus a slip-resistance check against the use (R9–R12, barefoot A–C).
  The page also handles zero results.
- **AI product discovery (photo):** pick a reference photo or upload one. The demo reads tone and
  texture locally and returns similar products.
- **Product detail:** specs, a configurator (format, laying pattern, joint colour and width,
  PNG export) and BIM/CAD per software (available / not in catalogue / coverage unconfirmed).
- **CADENAS registration and download:** the download is logged as a buying signal.
- **Project board** (saved products) and an **enquiry/sample form** with project, HOAI phase,
  area, use, consent and marketing double opt-in.
- **Status-only workspace:** request received → advisor assigned (name and contact) → in
  contact → samples dispatched/delivered → project support. The nine internal stages are never shown.
- **Consent banner:** analytics tracking only runs after consent.

**Back office**
- **Account Engagement:** prospects with score, grade, consent and a nurture programme by HOAI phase.
  Hand-raisers go to sales immediately; other signals wait for the score threshold (you can
  simulate nurture email clicks to cross it).
- **Connector sync** (≈ 2 min in reality, configurable seconds in the demo) creates the
  **Sales Cloud lead**. The **assignment rule** (region from postcode + segment from role) picks
  the owner, and a **first-contact task** is created, due in 1 working day.
- **AI enquiry assistant (use case 2):** summary, missing details, product/application checks,
  priority with reasons, suggested owner and next steps. Sales accepts or dismisses it, and nothing
  is emailed automatically (drafts only).
- **Leads, tasks with SLA timers** (use **+1 day** in the header to see overdue tasks),
  **opportunities** on a 9-stage board, and a "what the architect sees" preview.
- **Customer service** sample orders (picking → shipped → delivered), each feeding the status page.
- **Journey insights (use case 3):** a funnel, zero-result searches, form drop-off fields, and an
  AI insight report with proposed fixes and A/B tests.
- **Integration log and live system map:** every step with its payload (URL-encoded form handler
  post, connector field mapping), and map nodes light up as events happen.
- **Rules and scoring:** edit and test the assignment rule; change the threshold, SLA and sync delay.

## What is a placeholder

These need V&B input or access before they can be made real (see "Questions for V&B IT" in the draft):

- Collection names, colours, formats, slip values and BIM coverage are invented; they would come from Salsify/CADENAS.
- The nine opportunity stage names and their exit criteria.
- Owners, regions, queues and assignment rules.
- The first-contact service level (1 working day is assumed).
- The analytics baseline (about 15,000 page views/month, extrapolated) and the funnel numbers.
- AI is deterministic and offline. The model names and per-call costs shown follow the draft's
  sizing (Claude Haiku 5.5 / Sonnet 5.5 list prices).
- Slip-resistance guidance is simplified and has to be confirmed with V&B technical service.

## Code layout

```
index.html            entry; loads js/app.js
css/styles.css        website, back office and demo styles
js/app.js             hash router and render loop
js/store.js           shared state in localStorage, cross-tab/iframe sync, demo clock
js/engine.js          integration behaviour: form handler → prospect → sync → lead → rule → task → AI → status
js/domain.js          rules: regions, segments, HOAI, stages, owners, assignment, public status mapping
js/ai.js              simulated AI: text/photo discovery, enquiry summary, insight report
js/textures.js        procedural tile textures and configurator rendering (no image assets)
js/data/catalog.js    placeholder catalogue
js/data/seed.js       deterministic seed (historical leads, opportunities, nurture prospects)
js/views/site.js      architect website
js/views/office.js    back office
js/views/demo.js      start page and split-screen guided tour
tests/e2e.mjs         end-to-end journey test (Playwright, headless Chromium)
```

## Test

```bash
npx serve -l 8765 . &
node tests/e2e.mjs http://localhost:8765/index.html ./screenshots
```

The test walks the whole journey: search ranking and slip checks, photo search, configurator,
CADENAS registration and download, enquiry, sync and owner assignment, AI summary, call, samples,
conversion, stages hidden from the architect, the nurture threshold, insights and the integration log.
It also checks phone-width layouts for horizontal scroll and fails on any page or console error.
