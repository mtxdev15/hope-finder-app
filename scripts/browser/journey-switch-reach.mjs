/* Declare & Believe — can you find the way to choose another Journey?
 *
 * The owner's report, from the live site: "there is no button or anywhere how
 * to choose a new struggle within journey or choose a journey."
 *
 * He was right, and on a desktop it was worse than buried: the only switch
 * control was the mast's three-dot button, and public/declare/sidebar.css hides
 * the entire mast at 768px for the rail layout. The listener attached, the
 * sheets existed, and nothing ever painted. On a phone the same control sat
 * five taps deep behind an unlabeled glyph.
 *
 * The control lives on the Journey card now, where no breakpoint it does not
 * know about can turn it off. THIS FILE ASSERTS THAT AT BOTH WIDTHS, because
 * "it works on my screen" is exactly how the defect survived to production.
 *
 * It deliberately still checks that the mast control is hidden on desktop: that
 * rule is correct and stays, and the bug was never the rule. It was making
 * something the rule turns off the only way in.
 *
 * Run it:
 *     npm run dev
 *     node scripts/browser/journey-switch-reach.mjs
 */
import { chromium } from 'playwright-core';

const BASE = process.env.JOURNEY_WALK_URL || 'http://localhost:4321';
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const results = [];
const expect = (name, ok, detail) => results.push([ok, name, detail]);

const b = await chromium.launch({ executablePath: CHROME });

for (const [label, width, height] of [['phone 390px', 390, 844], ['desktop 1280px', 1280, 900]]) {
  const ctx = await b.newContext({ viewport: { width, height } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));

  /* A reader mid-Journey with another one set aside: the state in which "how do
     I choose a different one" is a real question. */
  await p.goto(BASE + '/journey', { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => {
    localStorage.setItem('db_journey_lock', JSON.stringify({
      anxiety: { date: null, time: null, day: 3, returned: 2 },
      fear: { date: null, time: null, day: 4, returned: 3 },
    }));
    localStorage.setItem('db_active_journey', JSON.stringify({ id: 'anxiety', day: 3, returned: 2, ts: Date.now() }));
  });
  await p.goto(BASE + '/journey', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1800);
  await p.evaluate(() => {
    document.querySelector('.cookie-note')?.remove();
    document.querySelector('astro-dev-toolbar')?.remove();
  });

  const shown = (id) => p.evaluate((q) => {
    const el = document.getElementById(q);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return getComputedStyle(el).visibility !== 'hidden' && r.width > 0 && r.height > 0;
  }, id);
  const sheetOpen = (id) => p.evaluate((q) => document.getElementById(q).classList.contains('open'), id);
  const click = (id) => p.evaluate((q) => document.getElementById(q).click(), id);

  expect(`${label}: the switch control is on screen`, await shown('jcSwitch'));
  expect(`${label}: and it is labelled, not a glyph`,
    ((await p.evaluate(() => document.getElementById('jcSwitchTxt')?.textContent)) || '').trim().length > 8);

  /* One tap to the confirm, two to the chooser. It used to be five. */
  await click('jcSwitch');
  await p.waitForTimeout(400);
  expect(`${label}: one tap reaches the switch confirm`, await sheetOpen('resetSheet'));
  const promise = await p.evaluate(() => document.querySelector('#resetSheet p').textContent.replace(/\s+/g, ' '));
  expect(`${label}: the confirm says where the set-aside Journey waits`,
    /My Journeys/.test(promise) || /Mis caminos/.test(promise), promise.slice(-90));
  expect(`${label}: and carries no em dash`, !promise.includes('—'), promise.slice(-90));

  await click('resetGo');
  await p.waitForTimeout(500);
  expect(`${label}: two taps reach the chooser`, await sheetOpen('chooseSheet'));
  expect(`${label}: with journeys in it`, (await p.locator('#chooseList button').count()) > 20);

  await p.evaluate(() => document.getElementById('scrim')?.click());
  await p.waitForTimeout(300);

  /* And the same door at the foot of My Journeys. */
  await click('seeAll');
  await p.waitForTimeout(700);
  expect(`${label}: My Journeys offers the same door`, await shown('mjNew'));
  await click('mjNew');
  await p.waitForTimeout(400);
  expect(`${label}: and it lands in the same place`, await sheetOpen('resetSheet'));

  expect(`${label}: no uncaught page errors`, errs.length === 0, errs);
  await ctx.close();
}

/* The regression itself, stated as a check rather than as a memory: on desktop
   the mast control is still hidden, which is why it may never be the only one. */
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(BASE + '/journey', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  const mastShown = await p.evaluate(() => {
    const el = document.getElementById('overflowBtn');
    return !!el && el.getBoundingClientRect().width > 0;
  });
  expect('desktop still hides the mast control, so it may never be the only one', mastShown === false, mastShown);
  await ctx.close();
}

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
