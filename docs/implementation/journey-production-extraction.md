# Journey production extraction — dependency closure for Release A

**Status: AUDIT COMPLETE, EXTRACTION NOT STARTED.** Phase 2 says to stop and
report if a required Journey commit also contains inseparable unrelated changes.
It does. Section 4 is the finding; nothing was branched, cherry-picked or built.

Comparison source: `release-c1-monetization` @ `800a48f`, unchanged and pushed.
Target base: `origin/main` @ `ed4c812`.

---

## 1. Ordered Journey commit list

Chronological, from `git log --reverse origin/main..release-c1-monetization`
over `src/pages/journey.astro`, `src/app/declare`, `public/declare`,
`src/components`, `src/layouts`. Forty-two commits, classified:

| # | Commit | Class | Subject |
|---|---|---|---|
| 1 | `1a7524c` | **1 foundation** | B1.5A responsive tablet and desktop navigation shell |
| 2 | `f81b2ab` | **1 foundation** | B1 redesign Journey overview |
| 3 | `95ee924` | **2 dependency** | B1.5B shared identity card |
| 4 | `aaefb97` | **2 dependency** | B1.5B closeout, unify profile navigation |
| 5 | `930f7e7` | **1 foundation** | B1.5C shared crisis card |
| 6 | `02b8855` | **1 foundation** | B2.1 Journey Preview screen |
| 7 | `32aabcf` | **1 foundation** | responsive day-opening experience |
| 8 | `6d9a658` | **1 foundation** | B3.2 paginated seven-step ritual, **nav redesign**, per-day art |
| 9 | `aeee109` | **1 foundation** | persist reflections to Vault |
| 10 | `fc408c4` | **2 dependency** | vault edit and copy saved reflections |
| 11 | `0767f3d` | **2 dependency** | preserve post-signup intent, unify redirect param |
| 12 | `ebe13e6` | **2 dependency** | close open redirect in post-sign-in return paths |
| 13 | `826b7ce` | **1 foundation** | enforce trusted active journey limits |
| 14 | `7dac109` | **2 dependency** | add missing Spanish Today strings |
| 15 | `02748db` | **1 foundation** | gate tomorrow preview behind internal flag |
| 16 | `95db185` | **2 dependency** | a11y status semantics for route loading |
| 17 | `5d32768` | **1 foundation** | prevent preview tools from production builds |
| 18 | `919681f` | **1 foundation** | correct the light-theme button shadow |
| 19-29 | `a20ac34` `7245f44` `7dc76db` `0946960` `2b88ade` `cdb8d11` `4d9b126` `f1bff86` `5f1ff7f` `e2bdf08` `e30143d` `bd90937` | **4 monetization** | pricing, billing, donations, subscriptions |
| 30-42 | `f5dec73` `52abaa7` `18313f8` `db3d49e` `941abbe` `7d0c767` `154a662` `59f87b2` `9cc54ad` `b6f3532` `800a48f` | **3 Spanish review only** | Release B, excluded from Release A |

`git cherry origin/main HEAD` reports no equivalent commits, because main's
hotfixes arrived as squash merges, so patch ids do not match. Equivalence must
be judged by content, not by `git cherry`.

---

## 2. Files required by the Journey redesign

Union of classes 1 and 2, excluding docs and verification screenshots:

```
convex/schema.ts                    convex/vault.ts
public/declare/declare.css          public/declare/motion.css
public/declare/sidebar.css          public/declare/i18n-strings.js
public/declare/dayopen-bg.jpg       public/declare/journey-bg-day1..5.jpg
src/app/declare/auth-store.js       src/app/declare/profile-store.js
src/app/declare/vault-store.js
src/components/TabBar.astro         src/layouts/DeclareLayout.astro
src/pages/journey.astro             src/pages/vault.astro
src/pages/word.astro
```

Plus ~250 documentation and screenshot files under `docs/`, which are class 6
and carry no runtime weight.

## 3. Files explicitly excluded

Pricing and Plus pages, `src/data/pricing.ts`, checkout and subscription UI,
entitlement activation, Stripe and StoreKit code, donation retirement,
`convex/billing.ts`, `convex/subscriptions.ts`, `convex/entitlements.ts`,
`convex/usage.ts`, and every class 3 Spanish completed-review file
(`src/app/declare/journey-locale/*`, `journey-review-state.ts`, and the
`journey.review.*` catalog entries).

---

## 4. FINDING — the extraction cannot honour the exclusion list

Release A was scoped to exclude "navigation migration" and "tab-bar migration".
That is not achievable from these commits.

**`6d9a658` bundles them.** One commit contains the paginated seven-step ritual,
the nav redesign, and the per-day Day-Opening art:

```
src/pages/journey.astro          <- the seven-step ritual
src/components/TabBar.astro      <- nav redesign
src/layouts/DeclareLayout.astro  <- nav redesign
public/declare/declare.css       public/declare/motion.css
public/declare/dayopen-bg.jpg    public/declare/journey-bg-day1..5.jpg
```

**The coupling is real, not incidental.** `journey.astro` references the shell
(`sidebar`, `rail`, `shell`, `tabbar`) twenty times, and the shell itself
diverges from main by **+452/-61** across `TabBar.astro`, `DeclareLayout.astro`
and `sidebar.css`. `1a7524c` ("responsive tablet and desktop navigation shell")
is the foundation the redesigned Journey lays out against at tablet and desktop
widths. Porting the ritual without the shell would ship a Journey whose layout
assumptions are not present.

There are three ways forward and none of them is "port the ritual only":

1. **Widen Release A to include the shell and nav redesign.** Honest and
   buildable. It contradicts the stated exclusion, so it needs explicit
   approval, and the nav redesign needs its own visual verification because it
   changes every page, not just Journey.
2. **Split `6d9a658` by hand** into a shell commit and a ritual commit on the
   release branch, then extract only the ritual. Possible, but the ritual will
   not lay out correctly without the shell, so this only helps if the shell
   ships in the same release anyway.
3. **Re-scope Release A as "Journey redesign + app shell"**, which is what the
   commits actually are. This is the same as option 1 with honest naming.

Recommendation: **option 3**. The work is one design programme; the commits were
authored as one. Naming the release after what it contains avoids a PR whose
description does not match its diff.

---

## 5. Frontend/backend compatibility

**No backend deployment is required for Release A.** Verified against the live
production deployment with `npx convex function-spec --prod`.

The redesigned Journey calls exactly three backend functions beyond what main
already uses, via `convex-data.js`:

| Call | Convex function | Production status |
|---|---|---|
| `journeyStart` | `journeySlots.js:registerJourneyStart` | deployed, public |
| `journeyEnsure` | `journeySlots.js:ensureJourneySlot` | deployed, public |
| `journeyRelease` | `journeySlots.js:releaseJourneySlot` | deployed, public |

Production Convex also already carries `entitlements` (4), `usage` (8),
`billing` (2), `subscriptions` (5) and `journeyTranslate` (9), because it was
deployed from `release-c1-monetization`, not from main. All of it is inert:
main's frontend never calls it.

`convex/accountDay.ts` exports no Convex functions (helpers only), which is why
it appears absent from the function spec. That is expected, not a gap.

**Risk worth naming separately:** `convex/schema.ts` on main is **+223/-31**
behind what production actually runs. Main is not a truthful record of the
deployed backend. This predates the extraction and is not caused by it, but it
means nobody can read main and know what production Convex looks like.

---

## 6. Extraction risks

- **Shell coupling** (section 4) is the blocking one.
- `public/declare/i18n-strings.js` is touched by the foundation, the Spanish
  review, and monetization. Any extraction must take hunks, not the file.
- `convex/schema.ts` and `convex/vault.ts` appear in the foundation but need no
  deployment; they must still be ported so the checked-in schema does not
  regress relative to what is deployed.
- `auth-store.js`, `profile-store.js` and `vault-store.js` are shared with
  Release B; porting them early is fine, they are additive.
- `src/pages/word.astro` and `src/pages/vault.astro` change in the foundation,
  so Release A is not Journey-only in file terms even after the shell question
  is settled.

## 7. Rollback plan

Release A is frontend-only, so rollback is a Pages rollback or a revert PR on
main. No Convex or Worker action is involved, and the already-deployed inert
transport must not be rolled back with it — it is unrelated and is depended on
by nothing in Release A.

Because no backend changes ship, there is no data migration and no forward-only
step. Reverting the merge commit restores the previous production frontend
exactly.
