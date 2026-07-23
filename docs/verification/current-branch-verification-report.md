# Current Branch Verification Report

**Date:** 2026-07-22 · **Branch:** `redesign/desktop-web-shell` (`c62f863`) · **Scope:** verification
only — no runtime, prompt, Convex, Worker, deployment, environment, package, or protected
documentation file was changed while producing this report. Nothing was committed, pushed, merged,
or deployed. One test account was created against the local **dev** Convex deployment
(`good-dotterel-906.convex.cloud`, confirmed via `.env.local`, not production) to safely verify
account-gated flows (Save to Vault); this creates real but harmless dev-environment data.

## 1. Repository state

```
$ git status --short
 M TODO.md
?? docs/

$ git branch --show-current
redesign/desktop-web-shell

$ git diff --stat
 TODO.md | 41 +++++++++++++++++++++++++++++++++++++++++
 1 file changed, 41 insertions(+)
```

- `TODO.md`: pre-existing, unrelated modification (the `app.declareandbelieve.com` subdomain note) —
  **not touched by this pass**.
- `docs/`: the Phase 0 audit documentation created in the prior task, plus this report — the only
  untracked content.
- All protected files (`CLAUDE.md`, `PRODUCT.md`, `DESIGN.md`, both briefs,
  `declare-and-believe-system-prompt.md`, `declare-api.js`, `journey-engine.js`, `worker/**`,
  `convex/**`, `.github/**`, env files, Cloudflare/Wrangler config) — confirmed unchanged
  (`git diff --stat` shows only `TODO.md`, which was already modified before this pass began).

## 2. Local quality checks

| Check | Available? | Result |
|---|---|---|
| Formatting | No script, no config (`.prettierrc*`, `prettier.config.*` absent) | N/A — not run |
| Lint | No script, no config (`.eslintrc*`, `eslint.config.*` absent) | N/A — not run |
| Type checking | `tsconfig.json` exists, but `@astrojs/check`/`typescript` are not installed dependencies; `npx astro check` would need to install them | N/A — not run (would require installing packages, out of scope) |
| `npm run build` | Yes | **Pass** — clean, exit 0, 11 pages built, no errors or warnings beyond a Node deprecation notice unrelated to the app (`module.register()` deprecation) |

No test framework exists (`vitest`/`jest`/`@testing-library` absent from `package.json`, no
`*.test.*`/`*.spec.*` files) — not installed, per scope.

## 3. Route checks

Local dev server (`npm run dev`, port 4321). All routes returned the expected status:

| Route | Status |
|---|---|
| `/` | 200 |
| `/today`, `/today/` | 200 |
| `/word`, `/word/` | 200 |
| `/journey`, `/journey/` | 200 |
| `/vault`, `/vault/` | 200 |
| `/you`, `/you/` | 200 |
| `/signin`, `/signin/` | 200 |
| `/create-account`, `/create-account/` | 200 |
| `/reset-password`, `/reset-password/` | 200 |
| `/crisis`, `/crisis/` | 200 |
| `/404` (unmatched route) | 404 (correct) |

## 4. Pass/fail summary table

| Area | Desktop 1440 | Tablet 768 | Mobile 390 | Notes |
|---|---|---|---|---|
| Nav transition (sidebar/topbar/tabbar) | Pass | Pass | Pass | Correct component shown at each tier, correct active state |
| Declare intake | Pass | Pass | Pass | Chips, textarea, submit all present and functional |
| Results experience | Pass | Pass | Pass | Single-column at <1024px (correct — rails are desktop-only), full 3-zone layout at ≥1024px |
| Scripture readability | Pass | Pass | Pass | Serif verse text, adequate line-height, no truncation observed |
| Right/left context rails | Pass | N/A (correctly hidden) | N/A (correctly hidden) | Verse index, Breakdown, Translation switcher, Recent Words all present and working at desktop |
| No horizontal overflow | Pass | Pass | Pass | `scrollWidth === clientWidth` confirmed at all three widths |
| No clipped controls | Pass | Pass | Pass | Visual review found none |
| Minimum touch targets | **Fail (medium)** | — | Fail (medium) | See §9 — several controls fall short of the documented 44px standard |
| Loading state | Pass | Not independently re-verified | Not independently re-verified | Reduced-motion override confirmed present and correct (§7) |
| Crisis-help visibility | Pass | Pass | Pass | Visible in nav (sidebar/topbar/tabbar) and inline in the intake/results/Journey-start flow at every tier |
| Account access | Pass | Pass | Pass | "You"/avatar reachable at every tier; sign-up flow completed successfully against dev Convex |
| Vault entry point | Pass | Pass (via nav) | Pass (via nav) | Confirmed saved item appears in `/vault` after a real signed-in save |
| Journey entry point | Pass | Not independently re-verified | Not independently re-verified | Handoff from Results → real Day 1 content generation confirmed working |
| Translation switching | Pass | Not independently re-verified | Not independently re-verified | NIV/NLT/KJV all confirmed swapping verse text in place, including a range reference |
| Breakdown panel | Pass | Not independently re-verified | Not independently re-verified | Two-part context/application structure confirmed, no clipping |
| Back to Declare | Pass | Not independently re-verified | Not independently re-verified | Correctly returns to entry view |
| Save to Vault (signed out) | Pass | — | — | Correctly gated; sign-in prompt mounts (confirmed via DOM, see §6) |
| Save to Vault (signed in) | Pass | — | — | Confirmed real save to localStorage + a real Convex mutation (dev deployment) |
| Keyboard tab order | Pass, with one finding | — | — | Logical for real content; see §8 for a real finding (closed modal remains tabbable) |
| Visible focus indicators | Pass | — | — | Default browser outline preserved on most controls; the intake textarea's focus style lives on a wrapper element (`.entry-input:focus-within`), confirmed present in source |
| Reduced motion | Pass | — | — | Route loader and Breakdown accordion both confirmed disabling animation/transition |
| Console errors | Pass (dev-only noise) | Pass | Pass | Only a local Vite dev-server dependency-optimizer 504, not present in production builds |
| Network failures | Pass | Pass | Pass | No failed requests other than the above dev-only noise |

## 5. Viewport-specific findings

### Desktop (1440×1000)
Full three-zone Results layout confirmed: left wayfinding rail (Read the full passage, Return to it
later, Receive another word, crisis link), center spine/timeline, right deepen rail (verse index +
Breakdown + Translation + Recent Words). All interactions tested here (Translation switch including
a range reference, Breakdown expand, Save, Journey handoff) worked correctly. Screenshots:
`screenshots/verify-desktop-01-intake.png`, `verify-desktop-02-loading.png` (this actually captured
the completed Results view — the AI response returned faster than the screenshot round-trip),
`verify-desktop-03-save-state.png`, `verify-desktop-04-signin-gate.png`.

### Tablet (768×1024)
Correctly falls back to the single-column Results layout (no rails — matches the documented
`≥1024px`-only gate). Fixed top bar shown, not the sidebar or bottom tabs. No overflow, no clipped
controls. Screenshots: `verify-tablet-01-intake.png`, `verify-tablet-03-results-clean.png`.

**Note on a discarded false-positive finding:** an earlier `fullPage: true` screenshot at this
viewport (`verify-tablet-02-results.png`, retained for the record) appeared to show two modal
overlays stacked simultaneously, including text ("What's on your heart?", "MIND & EMOTION" chip
categories) that does not exist anywhere in this codebase (confirmed via repository-wide search).
Direct DOM/computed-style inspection immediately after confirmed both the entry-view sheet and the
rate-review sheet were genuinely closed (`opacity: 0`, off-screen transform, no `.open` class). This
was a `fullPage` screenshot-stitching artifact (a known category of issue with `position: fixed`
elements in full-page capture), not a real product bug — recorded here so it isn't mistaken for one
later, and so the retained screenshot isn't misread without this context.

### Mobile (390×844, browser reported effective width 375×844)
Bottom tab bar confirmed, matching the pre-existing shipped design. No overflow. Results view
renders single-column, identical in structure to tablet's fallback. Screenshots:
`verify-mobile-01-intake.png`, `verify-mobile-02-results.png`.

## 6. Results-flow verification detail

- **Struggle representation:** confirmed correct at every step — header reads "FOR FEAR & ANXIETY,"
  matching the selected chip; carried through to Vault (`struggle: "Fear & Anxiety"`) and Journey
  ("Fear → Courage" arc) correctly.
- **Translation switching:** confirmed NIV, NLT, and KJV all swap verse text and reference labels in
  place without restarting, including the specific range-reference case ("Philippians 4:6-7" /
  "1 Peter 5:6-7") that a prior session's testing found to be the one fragile case. No regression.
- **Verse Breakdown panel:** confirmed two-part structure (context paragraph + bold "For your fear &
  anxiety today/tonight:" application line), no clipping (`scrollHeight` well under the CSS
  `max-height` cap).
- **Back to Declare:** confirmed returns cleanly to the entry view.
- **Save to Vault:**
  - Signed out: confirmed the save is correctly blocked — `toggleSave()`'s `ensureSignedIn()` gate
    fired, mounting the sign-in nudge toast (confirmed via DOM inspection: the toast element's
    `mount()`-only code path only runs on the signed-out branch); `aria-pressed` stayed `false` and
    `localStorage`'s vault key stayed `null` throughout.
  - Signed in (real test account, dev Convex): confirmed a real, complete save — `aria-pressed`
    flipped to `true`, the full word (verses, explanation, declarations, prayer) was written to
    `localStorage`, a real `POST .../api/mutation` call succeeded against
    `good-dotterel-906.convex.cloud`, and the item appeared correctly in `/vault` with the right
    struggle label. One minor, low-severity cosmetic note: the Vault's relative-time label read "1h
    ago" immediately after a save that had just happened — not investigated further given scope, but
    worth a quick look at the relative-time rounding logic.
- **Start Journey handoff:** confirmed the "Start a 5-Day Journey" button correctly navigates to
  `/journey` and generates a real, freshly-personalized Day 1 (Scripture, prayer, "cast off the lie,"
  breath prompt, declaration, reflection, "take it into your day" — matching the documented 7-step
  sequence exactly), tied to the correct struggle ("Fear → Courage").
- **Not safely testable in this pass:** the actual Stripe-backed Give/billing-portal flow (would
  touch real payment infrastructure even in a "test mode," out of scope for a verification-only
  pass) and Google OAuth sign-in (requires a real Google account interaction outside headless
  automation). Both are pre-existing, unrelated to this branch's changes, and not attempted.

## 7. Reduced-motion findings

`prefers-reduced-motion: reduce` emulated and confirmed active
(`window.matchMedia(...).matches === true`). Verified two specific animated elements:
- **Route-transition loader** (`#rl-overlay`): its CSS explicitly disables every keyframe animation
  under reduced motion and forces static, fully-opaque states instead — confirmed
  `animationName: 'none'` on the brand mark.
- **Breakdown accordion** (`.idx-breakdown`): confirmed `transitionDuration: '0s'` under reduced
  motion (the dedicated `@media (min-width:1024px) and (prefers-reduced-motion: reduce)` rule).

No distracting motion was observed remaining under this setting in either case.

## 8. Keyboard and accessibility findings

- **Tab order for real, visible content is logical**: textarea → send button → struggle chips in
  displayed order → "More +" → submit → crisis link, matching visual/reading order.
- **Struggle chips and primary actions are all real, keyboard-operable `<button>`/`<a>` elements** —
  no `div`-as-control patterns found anywhere touched in this pass.
- **Finding (medium severity): closed modal content remains in the tab order.** After the crisis
  link, Tab continues into the Rate & Review sheet's close button and all 5 star-rating buttons —
  even though that sheet is fully closed (`opacity: 0`, off-screen, `aria-hidden="true"`). This isn't
  a hard focus trap (Tab continues past it into the sidebar and nav afterward), but a keyboard-only
  user will land on invisible, non-functional controls with a focus ring appearing to go nowhere
  before reaching real content again. The likely fix (not made in this pass, per scope) is adding
  `inert` to the sheet's container while closed, or `tabindex="-1"` on its interactive children
  until opened.
- **Visible focus indicators:** present via the browser default outline on nearly every control
  tested. The intake textarea's own focus styling is implemented on a wrapper element
  (`.entry-input:focus-within { border-color: var(--gold); }` — confirmed present in source at
  `today.astro:968-969`) rather than the textarea itself; empirical before/after computed-style
  verification of this specific rule was inconclusive in this pass (a testing artifact, not a
  confirmed absence) and is worth a direct visual re-check.
- **No hard focus traps found** in the areas tested.
- **Headings and landmarks**: `<main>` and a `navigation "Primary"` landmark present on every page
  checked; heading levels observed were sensible where checked (e.g., Vault's `h1`, the
  create-account modal's `h2`) — not exhaustively swept across every page in this pass.
- **Color is not the only state indicator**: confirmed for struggle chips (selected = filled gold
  background, not just a color shift — unselected chips are outlined/bordered) and Translation pills
  (same filled-vs-outlined pattern).
- **Long Scripture/pastoral copy remains readable**: confirmed generous line-height and serif
  rendering at all three viewports; no truncation or overflow observed.

## 9. Console and network findings

- **Console:** the only recurring message across the entire pass, at every viewport and every route,
  was `Failed to load resource: the server responded with a status of 504 (Outdated Optimize Dep) @
  .../astro/runtime/client/dev-toolbar/entrypoint.js`. This is Astro's local dev-server dependency
  pre-bundler restarting after a fresh `npm run dev` — it does not occur in a production build and is
  not part of the shipped app in any way. No other JavaScript errors, hydration errors, or client
  warnings were observed at any point.
- **Network:** no failed requests of any kind beyond the dev-toolbar noise above. Confirmed real,
  successful calls to the Cloudflare Worker (`hope-finder-worker.thinktoro.workers.dev`, the Declare
  AI responses), and to the dev Convex deployment (`good-dotterel-906.convex.site`/`.convex.cloud`,
  auth + vault mutation/query calls) throughout.
- **Missing assets / broken links:** none found. Every internal link followed in this pass
  (Word/Journey/Vault/You/crisis navigation, verse "tap to receive" links into `/word`, the Journey
  handoff, the crisis link inside the Journey's pre-start modal) resolved correctly.

## 10. Additional finding: touch target sizing vs. the documented standard

`PRODUCT.md`'s Accessibility & Inclusion section states "Touch targets minimum 44px." `DESIGN.md`
separately states a chip-specific "Minimum touch target: 36px height" (a lower, conflicting number
worth reconciling in a future documentation pass, not attempted here). Measured at mobile width
(390/375px):

- Struggle chips: 38-41px height — meets `DESIGN.md`'s 36px chip-specific rule, falls short of
  `PRODUCT.md`'s general 44px rule.
- The "More +" chip specifically: 29px height, 42px width — falls short of both documented standards.
- Bottom tab bar items (Word/Journey/Vault/You): 43px height — falls short of the 44px general rule
  by 1px; the center "Declare" tab is 61px (comfortably passes).

None of these are so small as to make the app unusable — all remain reasonably tappable in practice
— but they are a measurable, real gap against `PRODUCT.md`'s own documented accessibility standard.

## 11. Items not safely testable in this pass

- Google OAuth sign-in (requires real Google account interaction, not automatable headlessly).
- The Stripe Give/billing-portal flow (touches real payment infrastructure even in test mode).
- Password reset email delivery end-to-end (would require a real inbox to confirm receipt; the
  request-side flow was not separately exercised in this pass since it's unrelated to this branch's
  changes).
- An exhaustive heading/landmark sweep across every page and every state (spot-checked only).

## 12. Severity-ranked findings

| # | Finding | Severity | Where |
|---|---|---|---|
| 1 | Touch targets below the documented 44px standard (chips, "More +", tab bar items) | Medium | `PRODUCT.md` vs. actual CSS across `today.astro`/`TabBar.astro` |
| 2 | Closed Rate & Review modal content remains keyboard-tabbable while invisible | Medium | `src/components/RateReview.astro` |
| 3 | Vault's relative-time label showed "1h ago" for an item saved seconds earlier | Low | `src/pages/today.astro`/`vault.astro`'s relative-time formatting |
| 4 | Intake textarea's focus-visible behavior not conclusively re-verified in this pass (present in source, empirical check inconclusive) | Low | `src/pages/today.astro:968-969` |
| 5 | `PRODUCT.md` (44px) and `DESIGN.md` (36px) state two different touch-target minimums | Low (documentation) | Cross-document conflict, not a code defect |

No blocker- or high-severity issues were found. Everything reviewed in this pass — the sidebar
shell, the Results-page redesign, the Translation switcher, Save to Vault, and the Journey
handoff — functions correctly across desktop, tablet, and mobile.

## 13. Recommended next action

Given no blockers were found, the branch remains in the same good state Jeff already reviewed and
approved on the Cloudflare preview. The five findings above are all Medium/Low severity and none
touch the areas Jeff has already explicitly signed off on (Translation switcher, Breakdown, Recent
Words, verse pacing). Suggested handling, for Jeff's call:

- **Fix now, low-risk, small and isolated:** #2 (add `inert`/`tabindex="-1"` to the closed Rate &
  Review sheet) and #1 (bump chip/tab-bar heights to 44px) are both small, contained CSS/markup
  changes that wouldn't touch any protected file or any already-approved visual design.
- **Worth a quick look, not urgent:** #3 (relative-time rounding) and #4 (a direct visual re-check of
  the textarea focus state).
- **Documentation-only, whenever convenient:** #5 (reconcile the 44px/36px conflict between
  `PRODUCT.md` and `DESIGN.md` — could be folded into `docs/audits/document-conflicts.md` as a
  follow-up entry).

No fixes were made in this pass, per scope.

## 14. Recommended future automated test stack (not installed)

Per `convex/_generated/ai/guidelines.md`'s own testing section: `vitest` + `@edge-runtime/vm` +
`convex-test` for Convex function coverage (schema/auth/mutations), configured with
`environment: "edge-runtime"`. For browser-level regression coverage of the two
breakpoint-sensitive areas exercised in this pass (the sidebar shell, the Declare/Results flow),
Playwright test specs following the same interaction patterns used manually in this report would be
the natural next layer. Neither has been installed; this is a recommendation only.

## 15. Exact rollback instructions

Nothing in this pass changed runtime behavior, so there is nothing to roll back in the application
itself. If the one real test artifact created (a signed-up account named "Verify Test",
`verify-test-20260722@example.com`, on the **dev** Convex deployment `good-dotterel-906`, with one
saved Vault item) needs to be removed, that would be a manual deletion in the Convex dev dashboard —
it does not exist in and cannot affect production (`keen-hamster-650`). The two new documentation
artifacts from this pass (`docs/verification/current-branch-verification-report.md` and its
`screenshots/` folder) are plain untracked files; deleting them or leaving them untracked has no
effect on the app.

---

## 16. Remediation pass (2026-07-22, appended — original findings above are unchanged)

All five findings above (§12) were remediated in a small, scoped follow-up pass. Full detail,
implementation decisions, and rollback instructions:
`docs/implementation/accessibility-polish-remediation-summary.md`. Summary:

| # | Finding | Fix | Verified |
|---|---|---|---|
| 1 | Touch targets below 44px | `min-height: 44px` + flex-centering on the shared base `.chip` and mobile `.tab` rules (`declare.css`) | Re-measured: every chip, "More +", and mobile tab-bar item now exactly 44px; no visual size change, no wrapping/overlap regression at any viewport |
| 2 | Closed modal remained keyboard-tabbable | `inert` on the sheet by default; real focus trap while open; focus moves to the first star on open; focus restores to the opener on close (`RateReview.astro`, `rate-review.js`) | Re-verified the full cycle: closed-state Tab-skip, open-state focus target, Tab/Shift+Tab wrapping in both directions, Escape-close, focus restoration |
| 3 | Vault showed "1h ago" for a brand-new item | Fixed `relTime()`'s rounding/floor bug in `vault.astro`, added a proper Just now / Xm / Xh tier, clamped against future timestamps | Saved a fresh word, confirmed `/vault` immediately read "Just now" |
| 4 | Textarea focus indicator was color-only | Added a `:has(textarea:focus-visible)` box-shadow ring alongside the existing `:focus-within` border-color change | Confirmed visible in dark mode; honest note recorded that `:focus-visible` shows for both keyboard and mouse on text inputs by browser design, not a bug — see the summary doc |
| 5 | `PRODUCT.md`/`DESIGN.md` disagreed on 44px vs. 36px | One clarifying sentence added to each (44px is the hit-area floor; 36px is chip-specific visual guidance) | Re-read both sections; voice/structure preserved, no rewrite |

No blockers or regressions found during remediation verification. One pre-existing, unrelated,
intermittent AI JSON-formatting flake was encountered and retried successfully during testing
(`declare-api.js` was not touched in this pass — see the remediation summary for detail). Nothing
was committed, pushed, merged, or deployed.
