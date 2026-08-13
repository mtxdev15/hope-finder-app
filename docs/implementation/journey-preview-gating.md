# Journey "Preview tomorrow" Gating

**Status:** implemented on `release-c1-monetization`, commit `02748db`. Local
only, not pushed, not deployed.

---

## The original bypass

`#lnPreview` rendered unconditionally in `src/pages/journey.astro:98`, inside the
lock note that appears whenever a user is paced out of the next Journey day.

The handler was a single line:

```js
function previewTomorrow() { const m = loadLock(); if (m[active.id]) { m[active.id].date = '2000-01-01'; saveLock(m); } }
```

Four things made this worse than a stray debug control:

1. **It was not a preview.** `isLocked()` returns true only while
   `lock.date === todayStr()`. Writing `'2000-01-01'` guarantees that comparison
   can never match again, so the day is unlocked permanently, not previewed. It
   survived reload, because `day`, `returned` and `time` were all preserved.

2. **It followed the account.** `saveLock()` calls `mirror('db_journey_lock')`,
   and the key is registered for account sync at `journey.astro:431`. The merge
   policy in `src/app/declare/journey-merge.js` keeps whichever side has walked
   further, so the sentinel propagated rather than being corrected. A user who
   tapped it once carried the bypass to every browser they signed into.

3. **It was productized, not debug-shaped.** It carried an i18n key
   (`journey.previewTomorrow` → `Ver mañana`), a translated success toast, and a
   gold dashed border. It appeared exactly when the user was locked out, so it
   read as the intended next step.

4. **It was never meant to ship.** The design source it was ported from,
   `design-source-v3.2/declare/Journey.html:670`, labelled the button
   `Preview tomorrow → (demo)`. The port dropped "(demo)" and added translation.

No analytics event fired on click, so there is no historical measure of how often
real users took it.

---

## What was changed

### Visibility guard

`src/pages/journey.astro` frontmatter:

```js
const JOURNEY_DEV_TOOLS = import.meta.env.PUBLIC_JOURNEY_DEV_TOOLS === '1';
```

The button is wrapped in an Astro template conditional, so without the flag the
markup is never emitted. There is no hidden element to unhide, no `disabled`
attribute to strip, and no CSS rule to override.

### Execution guard

The standalone `previewTomorrow()` function was deleted. Its body now lives only
inside a build-time branch next to the listener:

```js
if (import.meta.env.PUBLIC_JOURNEY_DEV_TOOLS === '1') {
  const lnPreviewBtn = $('lnPreview');
  if (lnPreviewBtn) lnPreviewBtn.addEventListener('click', function () {
    const m = loadLock();
    if (m[active.id]) { m[active.id].date = '2000-01-01'; saveLock(m); }
    renderHome();
    toast(...);
  });
}
```

The condition reads `import.meta.env` directly rather than through the
frontmatter variable, on purpose. Vite substitutes the literal at build time, so
with the flag unset this folds to `if (false)` and esbuild eliminates the whole
branch. The production bundle therefore contains no unlock function and no
sentinel date, which is stronger than a hidden button.

The `if (lnPreviewBtn)` null check is load-bearing rather than defensive style.
The element is absent in a production build, and the previous unguarded
`$('lnPreview').addEventListener(...)` would have thrown at that point and
aborted the rest of `init()`, taking the whole Journey page down.

### Why the page script could not simply be trusted

The script at `journey.astro:415` is a bare `<script>`, which Astro bundles as a
module. Module scope means `previewTomorrow` was never on `window`, so it was
already unreachable from the browser console. That was necessary but not
sufficient: the button was right there on screen.

---

## Approved environments

| Environment | Flag | Control |
|---|---|---|
| Production (Cloudflare Pages) | absent | **not built** |
| Local development | `PUBLIC_JOURNEY_DEV_TOOLS=1` in `.env.local` | present, labelled `Internal:` |
| Internal review build | same flag, set explicitly for that build | present, labelled `Internal:` |

`.env.local` and `.env.production` are gitignored, so the flag is off in
production purely by absence. No file in the repository turns it on. It must not
be added to Cloudflare Pages build settings.

The `journey.previewTomorrow` i18n string is retained, because the internal build
still renders the button in both languages. The `Internal:` prefix is plain
markup and needs no key.

---

## What this does NOT fix

Journey pacing remains a **client-side honor system in the web app**. The lock is
`db_journey_lock` in `localStorage`, compared against a device-local, unpadded
date string built in `journey.astro:522`. Two bypasses remain open to anyone who
looks for them:

- editing `localStorage` directly, or calling the public `userdata.set` mutation
- moving the device clock or timezone forward

`convex/journeySlots.ts:10-16` already documents that `userdata.set` accepts an
arbitrary key and value from any signed-in browser, which is why entitlement
counts its own table instead of trusting that data. The same reasoning applies to
pacing, and pacing has not yet been moved.

There is no server-authoritative Journey state at all today: `convex/schema.ts`
has no `journeys` table, no `currentDay`, and no day-unlock logic. Day
progression is entirely client-side. Closing these bypasses requires building
that state, which is filed as its own phase (see `TODO.md`) and deliberately not
attempted here, since this task was scoped to removing the visible production
bypass and adds no schema or mutations.

This is a characteristic of the current web app. Declare and Believe has no iOS
app today; the iOS pricing and StoreKit material in the release docs is planning
architecture, not shipped functionality.

---

## Files changed

| File | Change |
|---|---|
| `src/pages/journey.astro` | `JOURNEY_DEV_TOOLS` flag; conditional button markup; `previewTomorrow()` removed and inlined into the build-time branch; null-guarded listener |

Nothing else. No Convex, no Worker, no schema, no i18n removal.
