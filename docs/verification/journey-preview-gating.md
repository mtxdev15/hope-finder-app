# Journey "Preview tomorrow" Gating: Verification

**Scope:** the pacing bypass control only. **No deployment, no schema change, no
Convex mutation, no Journey rendering change.**

**Scripts that exist in `package.json`:** `dev`, `build`, `preview`, `astro`.
**There is no lint, test, typecheck or E2E script**, so none was run and none is
claimed. `npm run build` is the only automated gate. Everything else below was
verified by driving a real browser against a built `dist/` served by
`astro preview`.

---

## 1. Build

`npm run build` → **17 pages**, no errors. `git diff --check` clean.

---

## 2. Production default (built with no flag)

| Check | Method | Result |
|---|---|---|
| Button markup absent from HTML | `grep -c 'lnPreview' dist/journey/index.html` | **0** |
| Unlock function absent from bundle | `grep -o 'previewTomorrow' dist/_astro/journey*.js` | **0** |
| Sentinel date absent from bundle | `grep -o '2000-01-01' dist/_astro/journey*.js` | **0** |
| Element id absent from bundle | `grep -o 'lnPreview' dist/_astro/journey*.js` | **0** |
| `window.previewTomorrow` | browser, `typeof` | **`undefined`** |
| `document.getElementById('lnPreview')` | browser | **null** |
| Any preview text on the page | regex over `body.innerText`, EN and ES | **no match** |
| Journey still initializes | `.jhead` present, console clean | **PASS** |

The bundle greps are the meaningful ones. An earlier iteration gated only the
markup, and `2000-01-01` plus `lnPreview` still appeared in the shipped
JavaScript. Moving the condition to `import.meta.env` inside the module let Vite
fold it to `false` and esbuild drop the branch entirely. **The stronger result
was only found by grepping the built bundle rather than trusting the source
diff.**

### Locked-state behavior, production build

Forced a lock by setting `db_journey_lock` to today's date and reloading:

| Element | State |
|---|---|
| Lock note | visible |
| Title | "Day 2 opens tomorrow" |
| Countdown | "Opens in 4h 43m" |
| Reminder row | "No reminder set" / "Set a reminder" |
| `#lnEdit`, `#lnTimeInput`, `#lnTimeSave`, `#lnRem` | all present and intact |
| `#lnPreview` | **absent** |
| Continue button | **disabled**, labelled "Day 2 opens tomorrow" |

Screenshot: `.playwright-mcp/journey-locked-no-bypass.png`. The reminder path is
now the only affordance offered to a paced-out user, which is the intended
behavior.

---

## 3. Internal build (`PUBLIC_JOURNEY_DEV_TOOLS=1`)

| Check | Result |
|---|---|
| Button present | **yes** |
| Label | **"Internal: Preview tomorrow →"** |
| Click sets lock date to `2000-01-01` | **yes** |
| Continue re-enables to "Continue Day 2" | **yes** |
| Toast fires | "Tomorrow has come — Day 2 is open" |
| h1 count unchanged (1) | **yes** |
| Touches any Journey slot state | **no** (no Convex call in this path) |
| Creates duplicate Journey records | **no** |

Spanish label (`Ver mañana`, `journey.previewTomorrow`) is retained and still
swapped by `i18n.js` in the internal build.

---

## 4. Journey pacing rules, audited and unchanged

| Rule | Behavior | Evidence |
|---|---|---|
| Day 1 availability | Immediate; `beginJourney()` calls `clearLock()` | `journey.astro:1705` |
| Lock engaged | Only on **completing** a day, never on starting one | `journey.astro:1547-1548` |
| Locked condition | `lock.date === todayStr() && state.day <= TOTAL` | `journey.astro:568` |
| Next unlock | Device-local midnight, implicit: the date string simply stops matching | `journey.astro:522`, `:570` |
| Timezone | **Device-local wall clock, unpadded.** Not the account timezone, not `convex/accountDay.ts` | `journey.astro:522` |
| Daylight saving | No handling. A DST shift lengthens or shortens the wait by an hour | `untilTomorrow()`, `journey.astro:570` |
| Resume an unfinished day | **Always allowed.** The lock is only written at completion | `journey.astro:604` |
| Review a completed day | **Always allowed.** `openReview()` never consults `isLocked()` | `journey.astro:1480-1482` |
| Revisit Day-Opening | Allowed for the current day | `journey.astro:1414` |
| Completing early | Does not change the next unlock; always local midnight | `journey.astro:525` |
| Crisis, reflection save, Vault, Scripture | Untouched by the lock | no `isLocked()` in those paths |

`convex/accountDay.ts:3-7` explicitly disowns `journey.astro`'s `todayStr()` as
unusable for anything that counts, because it is browser-local and unpadded. The
pacing lock still uses it. That gap is recorded, not closed.

---

## 5. Journey continuity

Verified against the production build in a real browser: page initializes, the
active journey ("Fear → Courage", Day 2 of 5) restores with its fruit log, day
dots, Vine art, past-journeys section, and crisis card. Reminder controls
operate. Nothing in the lock note lost function.

Reflection save, Vault persistence, and slot release on completion were not
re-exercised end to end, because this change touches none of those code paths.
Stated rather than implied.

---

## 6. What remains open, stated plainly

**Journey pacing is still a client-side honor system in the web app.** Removing
the button removed the one-tap, discoverable, translated bypass. It did not make
pacing enforceable. A user who wants to advance early can still:

- edit `db_journey_lock` in `localStorage`
- write it through the public `userdata.set` Convex mutation
- move the device clock or timezone forward

This is not an iOS or mobile-app issue. Declare and Believe has no iOS app today.

Real enforcement requires server-authoritative pacing built on Convex and
`convex/accountDay.ts`, defining unlock timestamps, account timezone behavior,
disconnected-browser behavior, resume rules, migration and trusted enforcement.
That is filed as its own phase in `TODO.md` and was explicitly out of scope here,
since this task adds no schema and no mutations.
