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

**B1.5B verification complete. Stopping here per instruction — not beginning B1.5C or B2. Not
committed.**
