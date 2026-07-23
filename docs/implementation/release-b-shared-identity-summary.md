# Release B — Shared Identity Card (B1.5B) Implementation Summary

*Companion to `docs/verification/release-b-shared-identity-verification.md`. Adds the shared
identity card only — no richer crisis card (B1.5C) content was added; the existing crisis link is
untouched.*

---

## B1.5B — Shared Identity Card (2026-07-23)

### Goal

Add a real, session-driven identity card to the shared left rail (768px and up), coexisting with
the existing `.tab-you` nav item, per the approved mockup — without touching the production logo,
without fabricating any name/photo, and without adding a new upload feature.

### Files changed

```
public/declare/i18n-strings.js   |   5 ++
public/declare/sidebar.css       |  60 ++++++++++++-
src/app/declare/auth-store.js    |   5 +-
src/app/declare/profile-store.js |   5 ++
src/components/TabBar.astro      | 179 +++++++++++++++++++++++++++++++++++++++
5 files changed, 251 insertions(+), 3 deletions(-)
```
`public/declare/sidebar.js`, `public/declare/declare.css`, `src/layouts/DeclareLayout.astro`,
`src/pages/you.astro`, and `src/app/declare/account-sync.js` were **not touched** — confirmed by
`git diff --stat` showing no changes to any of them.

### Module-script decision

`public/declare/sidebar.js` is a plain classic script (`<script is:inline src=... defer>`) — it
cannot `import` from `auth-store.js`/`profile-store.js`/`account-sync.js`. Per your approval, all
identity-card logic lives in a real ES module `<script>` block inside `TabBar.astro` itself (the
same pattern `DeclareLayout.astro`'s own `paintYouTab` script already uses). `sidebar.js` is
completely unchanged — it still only owns the collapse toggle.

### Profile-store event

`src/app/declare/profile-store.js`'s `setProfile()` now dispatches a plain `CustomEvent`
(`declare-profile-change`, no payload) immediately after `persist()`/`mirror()` succeed. Data
shape, storage key, upload/crop flow, and Convex sync are all unchanged — confirmed by diff (only
one new line + a comment added). This is what makes a same-tab name/avatar edit on `/you` update
the sidebar card without navigation or reload.

### `currentUser()` additive shape

```js
return { email: u.email || '', firstName: first, name: u.name || '', image: u.image || '' };
```
`email`/`firstName` unchanged in meaning and position. No change to session-fetch, network
behavior, or the underlying Better Auth session.

### Markup insertion point

`src/components/TabBar.astro`, immediately after `.sb-crisis` and before `.tab-you`:
```html
<a class="sb-identity sbi-loading" id="sbIdentity" href="/signin/" aria-hidden="true" tabindex="-1">
  <span class="sbi-av" id="sbiAv" aria-hidden="true"></span>
  <span class="sbi-meta">
    <span class="sbi-name" id="sbiName"></span>
    <span class="sbi-tag" data-i18n="sidebar.tagline">Walk with Him</span>
  </span>
  <svg class="sbi-go" aria-hidden="true" ...></svg>
</a>
```
CSS order `95` (crisis `90`, identity `95`, You `100`) — crisis stays the most prominent bottom
item, per the existing shell order; `.tab-you` is untouched and coexists as ordinary navigation.

### Loading state

Ships inert: `aria-hidden="true" tabindex="-1"` plus a `.sbi-loading` class (`pointer-events:none`
in CSS). Reserves its final box size (same markup, empty content) so nothing shifts once real
content lands. Gated on `whenSynced()` for the *first* paint only — verified this promise resolves
exactly once per page load (confirmed by reading `account-sync.js` before writing any code), so all
*subsequent* transitions (sign-out, sign-in, a remote pull) are handled by live event listeners,
not a second `whenSynced()` call.

### Name priority (read-only — never seeds/writes)

`getProfile().name` → `currentUser().name` → `currentUser().firstName` → `you.friend` i18n fallback
→ `sidebar.guest` only when signed out. `textContent` only, never `innerHTML`.

### Avatar priority and failure chain

`getProfile().avatar` → `currentUser().image` → initials → neutral icon. **Failure chain does not
skip tiers**: a failed `P.avatar` still tries the provider image before falling to initials, exactly
as specified. Verified live (see verification report) with a temporary, fully-reverted test patch to
exercise the provider-image tier (no real Google session available in this sandbox) — the shipped
diff contains no trace of that patch, confirmed by `git diff` after reverting.

Images are built with `document.createElement('img')`, `alt=""`, `decoding="async"`,
`referrerPolicy="no-referrer"` for `http(s):` sources only, and `addEventListener('error', ...)` —
never inline `onerror`, never `innerHTML`. On failure the `<img>` is removed immediately before the
next tier paints — no broken-image indicator is ever left visible.

### Image-source validation

Provider image: accepted only if `new URL(v).protocol` is `http:` or `https:`. `P.avatar`: no new
validation added beyond truthiness — matches `you.astro`'s own existing avatar handling exactly (it
never validates format either, just uses `img.src = P.avatar` directly), per your instruction to
preserve existing supported formats rather than add new restrictions.

### Signed-in / signed-out design

Signed in: resolved avatar, resolved name (`textContent`), fixed "Walk with Him" tagline, decorative
arrow, `href="/you/"`, `aria-label` = `"{name}. Walk with Him. Open your profile."`. Signed out:
neutral person icon only (never a stale photo/initials), `sidebar.guest` text, same tagline,
`href="/signin/"`, `aria-label` = `"Guest. Walk with Him. Sign in."`.

### Compact rail (768–899px, and any manually-collapsed rail state)

Per your explicit permission, `.sbi-meta`/`.sbi-go` use plain `display:none` (not the visually-hidden
clip-rect pattern used elsewhere) — the anchor's own `aria-label` already fully covers the
accessible name regardless of visible content, so no duplicate announcement risk. A centered
`::before` pseudo-element gives a 44×44px hit area (same technique as the day-dots/collapse-toggle
fixes); the natural box already exceeds 44×44 at this width too, so this is belt-and-suspenders, not
strictly load-bearing.

### Themes

Both themes use only existing semantic tokens (`--surface`, `--text`, `--muted`, `--gold`,
`--goldd`, `--line`, `--chip-shadow`) — no hardcoded colors. Border is
`color-mix(in srgb, var(--gold) 20%, var(--line))`, giving a restrained gold tint in dark and a
subtle gold tint in light without a single new literal color value.

### i18n

New keys: `sidebar.tagline` ("Walk with Him"/"Camina con Él"), `sidebar.guest`
("Guest"/"Invitado"), `sidebar.openProfile` ("Open your profile"/"Abre tu perfil"). Reused:
`nav.signin`, `you.friend`. Checked before adding: `you.roleGuest` is a combined "Guest · not
signed in" phrase, not reusable as a standalone "Guest" — confirmed a new key was actually
necessary there, not just convenient.

### Accessibility

Real `<a>`, not a div+click-handler. Decorative avatar always `alt=""`; the accessible name comes
entirely from the anchor's own composed `aria-label`, recomputed on every repaint and on
`declare-lang`. 44px minimum in every state. Visible focus relies on the existing unstyled browser
default, confirmed via a real keyboard `Tab` press (not just `.focus()`) landing directly on the
card with `outline-style: auto`.

### Account-switch test (User A → sign out → User B)

Verified live with two real accounts created via `/create-account` (email/password, no real Google
session needed for this specific test): User A's real name/initials showed correctly; sign-out
immediately showed "Guest" with the neutral icon (no lingering A data — `clearPersonalData()` in
`signOut()` wipes `declare-profile-v1` synchronously, before the sign-out's `fire()` call, so by the
time the Guest repaint runs there is nothing of A's left to read); signing in as User B immediately
showed B's own real name/initials, never A's.

### Initialization guard

`if (window.__sbIdentityInit) return; window.__sbIdentityInit = true;` wraps the whole script.
Listeners registered exactly once each: `onAuthChange`, account-sync `onChange`, one
`declare-profile-change` listener, one `declare-lang` listener. A state fingerprint (signed-in
status, resolved name, avatar-source reference, language) skips repainting when nothing has actually
changed — verified no console errors or duplicate paints across repeated navigation.

### Known limitations

- The remote/account-sync repaint path (a profile edit pulled down from a *different* device) is
  wired identically to the same-tab path (`onAccountSync` fires `repaint()`), but wasn't verified
  against a genuine second device in this pass — verified instead by code inspection of
  `account-sync.js`'s `onChange()` contract (unmodified) and by confirming the same `repaint()` code
  path both listeners share already handles same-tab edits correctly live.
- Provider-image (`currentUser().image`) testing required a temporary, fully-reverted patch to
  `auth-store.js` (no real Google OAuth session available in this sandboxed environment) — the
  shipped code was never left in a modified state; `git diff` after reverting confirms this.
- Long-name ellipsis was verified with a directly-seeded `P.name` rather than through the real
  signup flow, since the existing (pre-existing, unmodified) sign-up code in `auth-modal.js` only
  ever sends the first word of whatever's typed as both the Better Auth name and the immediately
  seeded `P.name` — not something this milestone changed or needed to change.

### Rollback

```
git checkout -- src/components/TabBar.astro public/declare/sidebar.css src/app/declare/auth-store.js src/app/declare/profile-store.js public/declare/i18n-strings.js
```
No data migration needed — `currentUser()`'s change is additive, `declare-profile-change` is a new
event with no listeners elsewhere to break, and no storage key or data shape changed.

---

**B1.5B complete. Stopping here per instruction — not beginning B1.5C or B2. Not committed.**
