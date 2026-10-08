// End-to-end walk through the full journey in headless Chromium.
// Usage: serve the repo (e.g. `npx serve -l 8765 .`), then `node tests/e2e.mjs [baseUrl] [screenshotDir]`.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(`${execSync('npm root -g').toString().trim()}/playwright`);
}

const BASE = process.argv[2] || 'http://localhost:8765/index.html';
const SHOTS = process.argv[3] || null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const errors = [];
const fail = (msg) => {
  console.error('✗', msg);
  process.exitCode = 1;
};
const ok = (msg) => console.log('✓', msg);

const browser = await playwright.chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? {} : {});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const watch = (page, name) => {
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name} console: ${m.text()}`));
};
const shot = async (page, file) => SHOTS && page.screenshot({ path: `${SHOTS}/${file}.png`, fullPage: false });

const site = await ctx.newPage();
watch(site, 'site');
const office = await ctx.newPage();
watch(office, 'office');

// Launcher
await site.goto(`${BASE}#/`);
await site.waitForSelector('.launch-cards');
await shot(site, '00-launcher');
ok('launcher renders');

// 1. Text search
await site.goto(`${BASE}#/site`);
await site.click('[data-act="consent-yes"]');
await site.fill('#hero-search textarea', 'Hotel lobby floor, warm grey concrete look, large format');
await site.click('#hero-search button[type=submit]');
await site.waitForSelector('.pcard');
const firstName = await site.textContent('.pcard h3');
const checks = await site.locator('.pcard .checks li').count();
firstName.includes('Calce') ? ok(`text search ranks ${firstName.trim()} first`) : fail(`unexpected top result ${firstName}`);
checks > 0 ? ok('slip checks shown') : fail('no slip checks');
await shot(site, '01-search');

// Zero-result handling
await site.goto(`${BASE}#/site/search?q=${encodeURIComponent('xyzzy unicorn')}`);
await site.waitForSelector('.empty');
ok('zero-result state');

// Commercial kitchen → only R12 should pass
await site.goto(`${BASE}#/site/search?q=${encodeURIComponent('Restaurant kitchen floor, easy to clean')}`);
await site.waitForSelector('.pcard');
const kitchenTop = await site.textContent('.pcard h3');
kitchenTop.includes('Pura') ? ok(`kitchen query → ${kitchenTop.trim()}`) : fail(`kitchen query top ${kitchenTop}`);

// 2. Photo search
await site.goto(`${BASE}#/site/photo`);
await site.click('[data-ref="oak"]');
await site.waitForSelector('.search-layout .pcard');
const photoTop = await site.textContent('.search-layout .pcard h3');
photoTop.includes('Eichenhof') ? ok(`photo search (oak) → ${photoTop.trim()}`) : fail(`photo search top ${photoTop}`);
await shot(site, '02-photo');

// 3. Product, configurator, save, BIM with CADENAS registration
await site.goto(`${BASE}#/site/product/calce-grigio`);
await site.waitForSelector('#cf-canvas');
await site.selectOption('#cf-format', '60×120');
await site.selectOption('#cf-pattern', 'half');
await site.click('.pdp [data-act="save"]');
await site.click('[data-bim="revit"]');
await site.click('[data-fill]');
await site.click('#cad-form button[type=submit]');
await site.waitForTimeout(300);
await shot(site, '03-product');
ok('configurator + BIM download');

// 4. Enquiry
await site.goto(`${BASE}#/site/saved`);
await site.click('text=Request samples for these');
await site.waitForSelector('#enq-form');
await site.click('#fill-demo');
await shot(site, '04-enquiry');
await site.click('#enq-form button[type=submit]');
await site.waitForSelector('.tracker');
const ref = (await site.textContent('.ws .eyebrow')).match(/VB-2026-\d+/)[0];
ok(`enquiry submitted ${ref}`);

// 5. Sync → lead with owner (engine runs in one of the pages)
await site.waitForSelector('.advisor:not(.pending)', { timeout: 20000 });
const advisor = await site.textContent('.advisor b');
advisor.includes('Lena Hoffmann') ? ok(`advisor assigned by rule (Hamburg → North): ${advisor}`) : fail(`wrong advisor ${advisor}`);
await shot(site, '05-workspace-assigned');

// 6. Back office lead + AI
await office.goto(`${BASE}#/office/leads`);
await office.waitForSelector('tr.live a');
await office.click('tr.live a');
await office.waitForSelector('[data-act="ai-accept"]', { timeout: 15000 });
const summary = await office.textContent('.ai-summary');
summary.includes('Julia Brandt') ? ok('AI summary present') : fail('AI summary missing');
const flagged = await office.locator('.ai-card .checks li.warn, .ai-card li.warn').count();
ok(`AI flagged ${flagged} item(s)`);
await shot(office, '06-lead-ai');
await office.click('[data-act="ai-accept"]');
await office.fill('#call-note', 'Confirmed lobby + corridors, tender Q1');
await office.click('[data-act="call"]');
await office.click('[data-act="samples"]');
ok('AI accepted, call logged, samples released');

// 7. Customer service ships
await office.goto(`${BASE}#/office/service`);
await office.waitForSelector('tr.live [data-adv]');
await office.click('tr.live [data-adv]');
await office.click('tr.live [data-adv]');
await shot(office, '07-service');
await site.goto(`${BASE}#/site/workspace/${ref}`);
await site.waitForSelector('.tracker li.done');
const doneSteps = await site.locator('.tracker li.done').count();
doneSteps >= 4 ? ok(`architect status shows ${doneSteps} completed steps`) : fail(`only ${doneSteps} steps done`);

// 8. Convert + stages, architect sees status only
await office.goto(`${BASE}#/office/leads`);
await office.click('.tabs >> text=All');
await office.click('tr.live a');
await office.click('[data-act="convert"]');
await office.waitForSelector('.path.nine');
await office.click('[data-d="1"]');
await office.click('[data-d="1"]');
await shot(office, '08-opportunity');
await site.reload();
await site.waitForSelector('.tracker');
const siteText = await site.textContent('.ws');
!/Design & specification|Qualified|stage/i.test(siteText.replace('Internal sales stages are not shown', '')) ? ok('stages hidden from architect') : fail('internal stage leaked to architect');
siteText.includes('Project support active') ? ok('project support visible') : fail('project support step missing');
await shot(site, '09-workspace-final');

// 9. Nurture threshold path
await office.goto(`${BASE}#/office/prospects?f=nurture`);
await office.click('text=Mia Schröder');
for (let i = 0; i < 3; i++) await office.click('[data-click] >> nth=0');
await office.waitForTimeout(9000);
await office.goto(`${BASE}#/office/prospects?f=sales`);
(await office.locator('text=Mia Schröder').count()) ? ok('nurture prospect crossed threshold and was sent to sales') : fail('threshold path failed');

// 10. Insights + integration
await office.goto(`${BASE}#/office/insights`);
await office.click('[data-act="report"]');
await office.waitForSelector('.report .finding');
await shot(office, '10-insights');
ok('insight report');
await office.goto(`${BASE}#/office/integration`);
await office.waitForSelector('.sysmap');
const sysCount = await office.locator('.log tbody tr').count();
sysCount > 15 ? ok(`integration log has ${sysCount} events`) : fail('integration log too short');
await shot(office, '11-integration');
await office.goto(`${BASE}#/office`);
await office.waitForSelector('.kpis');
await shot(office, '12-office-home');

// Split-screen demo
const demo = await ctx.newPage();
watch(demo, 'demo');
await demo.goto(`${BASE}#/demo`);
await demo.waitForSelector('#tour .tour-body');
await demo.waitForTimeout(1500);
await shot(demo, '13-demo');
ok('split-screen demo renders');

// Mobile widths
const mob = await browser.newContext({ viewport: { width: 390, height: 844 } });
const m = await mob.newPage();
watch(m, 'mobile');
for (const h of ['#/site', '#/site/product/eichenhof-honig', '#/office', '#/office/leads']) {
  await m.goto(`${BASE}${h}`);
  await m.waitForTimeout(400);
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  overflow <= 1 ? ok(`mobile ${h} no horizontal scroll`) : fail(`mobile ${h} overflows by ${overflow}px`);
}
await m.goto(`${BASE}#/site`);
await shot(m, '14-mobile-site');

await browser.close();
if (errors.length) {
  errors.forEach((e) => fail(e));
} else ok('no page or console errors');
