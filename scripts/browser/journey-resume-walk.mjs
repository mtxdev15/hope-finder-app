/* Declare & Believe — walking a Journey, setting it aside, and coming back.
 *
 * This is the check the Journey rework plan lists under "what only a person can
 * confirm": start a Journey, reach day 2, switch to another, come back, and see
 * whether you are on day 2 or back at day 1. It turns out a browser can confirm
 * it, so it does, every time, instead of once by hand and never again.
 *
 * IT IS NOT A verify-*.ts SUITE, DELIBERATELY. Those are dependency-free, run
 * with no server and no network, and the whole set is run in one loop before a
 * push. This one drives a real Chromium against a real dev server, because the
 * two things it caught cannot be seen any other way: a stale `disabled`
 * attribute on the Preview's commit button, and a day count that only reveals
 * itself after a full seven-step ritual has actually been walked.
 *
 * The rules underneath are unit-checked in scripts/verify-journey-resume.ts.
 * This proves they are wired to something a person can reach.
 *
 * Run it:
 *     npm run dev          # in one terminal, leave it running
 *     node scripts/browser/journey-resume-walk.mjs
 *
 * Exits non-zero on the first failed expectation, and prints every check.
 */
import { chromium } from 'playwright-core';

const BASE = process.env.JOURNEY_WALK_URL || 'http://localhost:4321';
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const b = await chromium.launch({ executablePath: CHROME });
/* A phone, because the 3am user is on their phone and the switch control is
   laid out differently there. */
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();

const pageErrors = [];
p.on('pageerror', (e) => pageErrors.push(e.message));
const toasts = [];
await p.exposeFunction('__toast', (t) => toasts.push(t));

const results = [];
const expect = (name, ok, detail) => results.push([ok, name, detail]);

/* Clicks are dispatched on the element rather than at its coordinates. The dev
   toolbar and the cookie notice both sit over the bottom of a 390px viewport,
   and hit-testing through them tests the harness, not the app. */
const tap = (sel) => p.evaluate((q) => {
  const el = document.querySelector(q);
  if (!el) throw new Error('no element for ' + q);
  el.click();
}, sel);

const dismissChrome = () => p.evaluate(() => {
  document.querySelector('.cookie-note')?.remove();
  document.querySelector('astro-dev-toolbar')?.remove();
});

const readState = () => p.evaluate(() => ({
  pill: document.getElementById('dayPill')?.textContent,
  active: JSON.parse(localStorage.getItem('db_active_journey') || 'null'),
  lock: JSON.parse(localStorage.getItem('db_journey_lock') || '{}'),
  instances: Object.keys(localStorage).filter((k) => k.startsWith('db_journey_inst:')),
  dayState: (id) => null,
}));

const dayStateOf = (id) => p.evaluate((j) => {
  try { return JSON.parse(localStorage.getItem('db_journey_inst:' + j) || '{}').dayState || null; }
  catch (e) { return null; }
}, id);

/* Six struggles are sensitive and put a care gate in front of the Preview.
   That is the app working, so the walk goes through it rather than around it. */
async function commitPreview() {
  if (await p.locator('#careSheet.open').count()) {
    await tap('#careBegin');
    await p.waitForTimeout(900);
  }
  await p.waitForSelector('#journeyPreview.open', { timeout: 8000 });
  const dead = await p.evaluate(() => document.getElementById('jpBegin').disabled);
  expect('the Preview opens with a live Begin Day 1 button', dead === false);
  await tap('#jpBegin');
  await p.waitForTimeout(1600);
}

/* The real switch path on a phone: the overflow control, the menu, the
   progress-kept sheet, then the chooser. */
async function pickFromChooser(id) {
  await dismissChrome();
  await tap('#overflowBtn'); await p.waitForTimeout(400);
  await tap('#mSwitch');     await p.waitForTimeout(400);
  await tap('#resetGo');     await p.waitForTimeout(500);
  await tap(`#chooseList button[data-id="${id}"]`);
  await p.waitForTimeout(1000);
}

/* One full day of the ritual: seven steps, three of them gated behind an
   action the reader has to take. Advance when the primary is live, otherwise
   do what the step is asking and try again. */
async function walkOneDay() {
  for (let guard = 0; guard < 40; guard++) {
    await dismissChrome();
    const s = await p.evaluate(() => {
      const blk = document.querySelector('.step-active[data-step]');
      const btn = document.getElementById('dfComplete');
      return {
        step: blk?.dataset?.step || null,
        disabled: btn ? btn.disabled : true,
        done: document.getElementById('dayComplete')?.classList.contains('show') || false,
      };
    });
    if (s.done) return true;
    if (!s.step) return false;
    if (!s.disabled) {
      await p.evaluate(() => document.getElementById('dfComplete').click());
      await p.waitForTimeout(700);
      continue;
    }
    const ta = p.locator('.step-active[data-step] textarea');
    if (await ta.count()) { await ta.first().fill('Walking this today, and it is landing.'); await p.waitForTimeout(300); }
    const inner = p.locator('.step-active[data-step] button');
    const n = await inner.count();
    for (let i = 0; i < n; i++) {
      const el = inner.nth(i);
      if (!(await el.isVisible())) continue;
      try { await el.evaluate((e) => e.click()); } catch (e) { continue; }
      await p.waitForTimeout(1200);
      if (await p.evaluate(() => !document.getElementById('dfComplete').disabled)) break;
    }
    await p.waitForTimeout(500);
  }
  return false;
}

await p.goto(BASE + '/journey', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
await dismissChrome();
await p.evaluate(() => {
  const el = document.getElementById('toast');
  new MutationObserver(() => { const t = el.textContent.trim(); if (t) window.__toast(t); })
    .observe(el, { childList: true, characterData: true, subtree: true });
});

/* ── 1. Walk a real day 1 ─────────────────────────────────────────────────── */
const A = await p.locator('#zsList .zs-card').first().getAttribute('data-id');
await p.evaluate(() => document.querySelector('#zsList .zs-card').click());
await p.waitForTimeout(700);
await commitPreview();
await dismissChrome();
await tap('#doBegin');
await p.waitForTimeout(900);
expect(`day 1 of ${A} can be walked to the end`, await walkOneDay());
await dismissChrome();
await tap('#dcDone');
await p.waitForTimeout(900);

let s = await readState();
expect(`${A} stands on day 2 afterwards`, s.pill === 'Day 2 of 5', s.pill);
expect(`${A}'s lock row records day 2`, s.lock[A]?.day === 2, s.lock);
const reflection = JSON.stringify((await dayStateOf(A)) || {});
expect(`${A} kept the day-1 reflection`, reflection.includes('landing'), reflection);

/* ── 2. Set it aside for a different struggle ─────────────────────────────── */
await dismissChrome();
await tap('#overflowBtn'); await p.waitForTimeout(400);
await tap('#mSwitch');     await p.waitForTimeout(400);
await tap('#resetGo');     await p.waitForTimeout(500);
const offered = await p.locator('#chooseList button').evaluateAll((bs) => bs.map((x) => x.dataset.id));
const B = offered.find((x) => x !== A);
await tap(`#chooseList button[data-id="${B}"]`);
await p.waitForTimeout(900);
await commitPreview();
await dismissChrome();
/* Leave B's day unopened. This is somebody who switched and walked away. */
await p.evaluate(() => document.getElementById('doClose')?.click());
await p.waitForTimeout(600);

s = await readState();
expect(`${B} is the active Journey now`, s.active?.id === B, s.active);
expect(`${A}'s day 2 survived the switch`, s.lock[A]?.day === 2, s.lock);
expect(`${A}'s instance cache survived the switch`, s.instances.includes('db_journey_inst:' + A), s.instances);

/* ── 3. Come back ─────────────────────────────────────────────────────────── */
toasts.length = 0;
await pickFromChooser(A);
await p.waitForTimeout(1200);
await dismissChrome();
s = await readState();
/* THE ONE THIS WHOLE THING IS ABOUT. */
expect(`returning to ${A} lands on day 2, not day 1`, s.pill === 'Day 2 of 5', s.pill);
expect(`${A} is the active Journey again`, s.active?.id === A, s.active);
expect('the persisted day is the one that was restored', s.active?.day === 2, s.active);
const kept = JSON.stringify((await dayStateOf(A)) || {});
expect('the day-1 reflection is still there', kept.includes('landing'), kept);
expect('the reader is told they came back', toasts.some((t) => /Welcome back/.test(t)), toasts);
expect('and the toast names the day', toasts.some((t) => /Day 2 of 5/.test(t)), toasts);
expect('no em dash in the resume toast', !toasts.some((t) => t.includes('—')), toasts);

/* ── 4. A Journey left on day 1 is still a fresh start ────────────────────── */
/* Wrapped, so that a later step blowing up still prints the earlier results.
   The first time this file was pointed at a build without the fix, it threw
   here and said nothing about the check that had already failed above. */
try {
  await pickFromChooser(B);
  await p.waitForTimeout(1000);
  const cls = await p.locator('#journeyPreview').getAttribute('class');
  expect(`${B}, left on day 1, still gets the Preview`, /open/.test(cls || ''), cls);
} catch (e) {
  expect(`${B}, left on day 1, still gets the Preview`, false, String(e.message || e).split('\n')[0]);
}

expect('no uncaught page errors anywhere in the walk', pageErrors.length === 0, pageErrors);

console.log('');
let failed = 0;
for (const [ok, name, detail] of results) {
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (ok ? '' : '  <= ' + JSON.stringify(detail)));
  if (!ok) failed++;
}
console.log(failed
  ? `\n${results.length - failed}/${results.length} passed, ${failed} FAILED`
  : `\nall ${results.length} browser checks passed`);
await b.close();
process.exit(failed ? 1 : 0);
