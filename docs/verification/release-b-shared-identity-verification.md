# Release B — Shared Identity Card (B1.5B) Verification Report

*Companion to `docs/implementation/release-b-shared-identity-summary.md`. Local dev only (Convex
deployment `good-dotterel-906`, per `.env.local` — never production). Nothing committed, pushed,
merged, or deployed.*

---

## B1.5B — Shared Identity Card (2026-07-23)

### Commands run

```
$ npm run build
✓ Completed, 11 pages built, no errors

$ git status --short
 M public/declare/i18n-strings.js
 M public/declare/sidebar.css
 M src/app/declare/auth-store.js
 M src/app/declare/profile-store.js
 M src/components/TabBar.astro
 (TODO.md also modified — pre-existing, unrelated)

$ git diff --stat -- src/components/TabBar.astro public/declare/sidebar.css src/app/declare/auth-store.js src/app/declare/profile-store.js public/declare/i18n-strings.js
 public/declare/i18n-strings.js   |   5 ++
 public/declare/sidebar.css       |  60 ++++++++++++-
 src/app/declare/auth-store.js    |   5 +-
 src/app/declare/profile-store.js |   5 ++
 src/components/TabBar.astro      | 179 +++++++++++++++++++++++++++++++++++++++
 5 files changed, 251 insertions(+), 3 deletions(-)

$ git diff --check
(clean, no output)
```

### Route checks

`/today`, `/word`, `/journey`, `/vault`, `/you`, `/signin`, `/crisis` — all 200.

### Responsive verification — all 8 required widths

| Width × height | Result |
|---|---|
| 768×1024 | Compact: 47×52px anchor, meta/arrow `display:none`, 44×44px `::before` hit area, aria-label intact, no overflow |
| 899×1194 | Compact, same as above, confirmed at the upper compact boundary |
| 900×1200 | Expanded: 195×56px card, meta visible, no overflow |
| 1023×768 | Expanded, short-height window — rail's existing `overflow-y:auto` already handles this, no internal scroll needed at this content length, no page overflow |
| 1024×768 | Desktop boundary — confirmed correct, screenshot `desktop-boundary-1024x768.png` |
| 1280×800 | No overflow |
| 1440×1000 | Full verification width — see below |
| 390×844 | Card `display:none`, no overflow, bottom nav pixel-stable |

### Loading state

Static markup ships `aria-hidden="true" tabindex="-1"` + `.sbi-loading` (`pointer-events:none`),
empty avatar/name, same final box size. Never showed "Guest" or a prior user before resolution in
any test.

### Signed-out state

`href="/signin/"`, `aria-label`: `"Guest. Walk with Him. Sign in."`, neutral person-icon only.
Screenshot `signed-out-1440.png`.

### Signed-in states (real accounts created via `/create-account` — email/password, no OAuth needed)

| Scenario | Result |
|---|---|
| Real name, no P.avatar/provider image | synthetic test name + matching initial — screenshot `signed-in-initials-1440.png` |
| Same-tab profile name update (edited on `/you`, same page, no reload) | Sidebar name updated instantly via `declare-profile-change` — screenshot `same-tab-name-update-1440.png` (cropped to the shared rail only, since `/you`'s own main content shows the account email) |
| Same-tab profile avatar update (P.avatar set directly + event dispatched) | `<img>` rendered with `alt=""`, `decoding="async"` — screenshot `p-avatar-valid.png` (rail-only crop, same reason) |
| Failed P.avatar, valid provider image (temporary reverted test patch — see summary) | Fell through correctly to `currentUser().image`, `referrerpolicy="no-referrer"` present — screenshot `provider-image-fallback.png` (rail-only crop, same reason) |
| Failed P.avatar **and** failed provider image | Fell through correctly to initials, no broken-image element left in the DOM |
| No usable name (P.name cleared, `currentUser()` name/firstName also equal) | Fell through the full chain correctly, never blank |
| Long name (38 chars, directly seeded P.name) | Genuine `scrollWidth > clientWidth` truncation, ellipsis rendered, no page overflow — screenshot `long-name-ellipsis-1440.png` |

### Account-switch protection

Real two-account test: test account A signed in and verified correct → signed out → immediately
showed Guest (no lingering A data) → test account B signed in → immediately showed B's own real
name/initials, never A's. Screenshot `account-switch-userB.png` (test display name shown in the
screenshot is synthetic test data, not a real user).

### Themes and language

Dark (default, all screenshots above) and light + Spanish both confirmed — screenshot
`light-spanish-1440.png` shows warm ivory surface, subtle gold border, dark readable name, "Camina
con Él" tagline, correctly-composed Spanish `aria-label`.

### Accessibility

- Real `<a>` element confirmed (not a div).
- Real keyboard `Tab` press from the adjacent crisis link landed directly on `#sbIdentity` with
  `outline-style: auto` — confirmed with an actual keypress, not just `.focus()`.
- 44×44px confirmed via `getComputedStyle(el, '::before')` at compact width.
- `aria-label` confirmed to update correctly on language change.
- Decorative avatar always `alt=""`.

### Duplicate-listener / initialization guard

`window.__sbIdentityInit` confirmed `true` after load; no duplicate paints or console warnings
observed across repeated navigation between routes.

### Console errors

Only the pre-existing, dev-server-only "Outdated Optimize Dep" 504 noise, plus the deliberately
broken test-image URLs' expected network failures during the avatar failure-chain tests — no
unexpected JavaScript exceptions at any point.

### Confirmed

- Signed-in card → `/you/` ✓
- Signed-out card → `/signin/` ✓
- Crisis link unchanged (`href="/crisis"`, static English `aria-label`, untouched markup/CSS) ✓
- Mobile bottom navigation unchanged (pixel-stable at 390×844, screenshot
  `mobile-nonregression-390.png`) ✓
- Production logo/wordmark markup untouched (`.sb-dot` + "Declare & Believe" text, confirmed via
  diff — no changes inside `.sb-brand`) ✓

### Known limitations

See the implementation summary's "Known limitations" — the remote/account-sync path verified by
code inspection rather than a genuine second device, the provider-image test's temporary (fully
reverted) patch, and the directly-seeded long-name test since the real signup flow only ever sends
a first-word name.

### Checkpoint reconciliation note (screenshot redaction)

Before staging, three screenshots (`same-tab-name-update-1440.png`, `p-avatar-valid.png`,
`provider-image-fallback.png`) were found to expose a real test-account email address (visible on
`/you`'s own main content, in "My name" and "Sign-in & security") plus a test display name that
incorporated the product owner's real first name. All three were retaken: with a fresh,
fully-generic test account ("Sample Person"/"SampleUser", no connection to any real name), and
cropped to the shared rail element only (`.tabbar`) so `/you`'s main content — where the account
email is shown — never enters the frame. `signed-in-initials-1440.png` was also retaken with the
same clean account for consistency, though its original version (on `/today`) never exposed an
email. No screenshot in the final set contains an email address, password, token, or a name tied to
a real person.

### Rollback

```
git checkout -- src/components/TabBar.astro public/declare/sidebar.css src/app/declare/auth-store.js src/app/declare/profile-store.js public/declare/i18n-strings.js
```

---

## B1.5B.1 — Closeout: One Authoritative Profile Entry (2026-07-23)

### Commands run

```
$ npm run build
✓ Completed, 11 pages built, no errors

$ git status --short
 M public/declare/sidebar.css
 M src/components/TabBar.astro
 (TODO.md, .playwright-mcp/, docs/prompts/RELEASE_B_JOURNEY_REDESIGN_CLAUDE_PROMPT.md
  also present — pre-existing/unrelated)

$ git diff --stat -- public/declare/sidebar.css src/components/TabBar.astro
 public/declare/sidebar.css  | 23 ++++++++++++++++++-----
 src/components/TabBar.astro | 14 +++++++++++++-
 2 files changed, 31 insertions(+), 6 deletions(-)

$ git diff --check -- public/declare/sidebar.css src/components/TabBar.astro
(clean, no output)
```

### Responsive verification — all 9 required widths

| Width × height | Result |
|---|---|
| 390×844 | Mobile: 5 visible bottom tabs incl. `.tab-you` (live "Closeout" label), identity card `display:none` |
| 767×1024 | Just under the rail breakpoint — mobile treatment confirmed unchanged (`.tab-you` visible, identity hidden) |
| 768×1024 | Rail breakpoint — flips correctly: `.tab-you` `display:none`, identity card visible, `data-sidebar="collapsed"` |
| 899×1194 | Compact rail upper boundary — identity card 47px wide, `.tab-you` hidden |
| 900×1200 | Expanded rail — identity card 195px wide (tablet `--sbw:220px`), `.tab-you` hidden |
| 1023×768 | Expanded, short-height window — existing `overflow-y:auto` handles it, no page overflow |
| 1024×768 | Desktop boundary — identity card 223px wide (desktop `--sbw:248px`), screenshot `rail-desktop-boundary-1024-signed-in-not-current.png` |
| 1280×800 | No page overflow (`scrollWidth > innerWidth` false) |
| 1440×1000 | Full verification width — see states below |

### Account/profile control count — explicit

| Range | Visible controls | Keyboard-reachable controls |
|---|---|---|
| Below 768px (mobile) | 1 (`.tab-you`) | 1 (`.tab-you`) |
| At/above 768px (rail, any sub-width, expanded or collapsed) | 1 (`.sb-identity`) | 1 (`.sb-identity`) |

Matches the expected result exactly: one mobile You tab with no identity card below 768px; one
identity card with no standalone You row at/above 768px. Confirmed via live DOM query
(`nav.tabbar` focusable `a`/`button` elements filtered to `display !== 'none'` and
`tabIndex !== -1`) at 800px (6 total: Word, Journey, Declare, Vault, crisis, identity — no
`.tab-you`, no separate collapse toggle in this sub-range) and 1440px (7 total: collapse, Word,
Journey, Declare, Vault, crisis, identity).

### `/you` active-state behavior

- Signed in, on `/you/`, 1440px: `#sbIdentity` classes = `sb-identity on`,
  `aria-current="page"` present, `aria-label` = `"Closeout. Walk with Him. Open your profile."`
- Same signed-in session, on `/today/`: classes = `sb-identity` (no `.on`), `aria-current` absent.
- Same signed-in session, on `/vault/`, 1024px boundary: same — no `.on`, no `aria-current`.
  Screenshot `rail-desktop-boundary-1024-signed-in-not-current.png`.
- Signed out (Guest), any page: `data-route-you` can never be `'1'` on `/signin/` since that page
  passes no `activeTab` prop — confirmed `active === 'you'` is unreachable there. No active state
  ever appears on the Guest card.
- Manually-collapsed desktop rail (1440px, toggled), on `/you/`: active state persists icon-only
  (`.sb-identity.on`, `aria-current="page"` still present at 47x52px). Screenshot
  `rail-collapsed-active-you-1440.png`.
- Light theme, on `/you/`, 1440px: active-state border/background remain legible and correctly
  gold-tinted via the same `color-mix()` tokens. Screenshot `rail-light-theme-active-you-1440.png`.

### Accessibility

- Real keyboard `Tab` press (not `.focus()`) from the crisis link (`.sb-crisis`, itself
  `.focus()`-set first) landed directly on `#sbIdentity` with `outline-style: auto` — confirms
  `.tab-you`'s removal from `display` also removed it from the actual tab order, not just visually.
- `aria-current="page"` only ever appears alongside `signedIn === true`; verified it is absent in
  every signed-out and every non-`/you` signed-in state tested above.
- No new accessible-name mechanism introduced — `aria-label` composition is exactly the same
  B1.5B logic, unaffected by the active-state class.

### Mobile non-regression

390×844: exactly 5 bottom tabs (Word, Journey, Declare, Vault, You), `.tab-you` renders with its
existing live first-name label ("Closeout" in this test session), identity card absent from layout
entirely (`display:none`, confirmed via `getComputedStyle`). Screenshot `mobile-nonregression-390.png`.
Pixel treatment of the bottom bar itself is untouched — no CSS in this closeout touches any
selector active below the `min-width:768px` media query.

### Screenshots (new directory: `docs/verification/screenshots/release-b-b1-5b-identity-closeout/`)

| File | State |
|---|---|
| `rail-signed-out-1440.png` | Guest identity card, 1440px, no `.tab-you` |
| `rail-signed-in-active-you-1440.png` | Signed in, on `/you`, `.on` + `aria-current`, 1440px |
| `rail-compact-800.png` | Compact rail, 800px, icon-only identity, signed in |
| `mobile-nonregression-390.png` | Mobile bottom bar, unchanged, 390px |
| `rail-collapsed-active-you-1440.png` | Manually-collapsed desktop rail, active state persists icon-only |
| `rail-light-theme-active-you-1440.png` | Light theme, active state, 1440px |
| `rail-desktop-boundary-1024-signed-in-not-current.png` | Exact 1024px boundary, signed in, NOT on `/you` (no active state) |

All seven are element-scoped crops of `.tabbar` only (`page.locator('.tabbar').screenshot(...)`),
same redaction pattern as B1.5B — no email address or other account page content ever enters frame.
The test account's first name ("Closeout Tester" → sidebar shows "Closeout") is fully generic dev
data with no connection to a real person, and the account was signed out again after verification.

### Console

Only the pre-existing, dev-server-only "Outdated Optimize Dep" 504 noise — no new JavaScript errors
introduced by either changed file, across all widths and states tested.

### Confirmed

- `.tab-you` hidden via `display:none` at every rail width (>=768px), fully present in
  `TabBar.astro`'s shared markup, fully restored and unchanged below 768px ✓
- Exactly one profile/account control, visible and keyboard-reachable, on both sides of the 768px
  boundary ✓
- Restrained `/you` active-state treatment, signed-in-only, never on the Guest card, reusing
  existing `.tab.on` design tokens ✓
- Approved rail order (logo → Word → Journey → Declare → Vault → spacer → crisis → identity →
  collapse) unchanged, collapse control left in its existing safer location ✓
- Build clean, `git diff --check` clean, no console errors introduced ✓

### Rollback

```
git checkout -- src/components/TabBar.astro public/declare/sidebar.css
```

---

**B1.5B.1 verification complete. Stopping here per instruction — not beginning B1.5C or B2.**
