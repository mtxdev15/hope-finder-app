# B3.3 — Reflection Draft and Vault Persistence (Verification Report)

Organized by **how** each item was checked, so it is clear what is a hard guarantee, what is an
inference, and what could not be tested here.

---

## 1. Automated checks (tooling that actually exists in this repo)

`package.json` has exactly four scripts: `dev`, `build`, `preview`, `astro`. **There is no lint,
typecheck, unit-test, or E2E script in this project.** Nothing below claims a test suite ran.

| Command | Outcome |
|---|---|
| `npm run build` | Clean Astro static build, no errors, `/journey/index.html` + `/vault/index.html` generated. Re-run after every code change in this milestone (7 times), including after each of the three bug fixes in §5. |

---

## 2. Live browser checks (real functional verification)

Driven against the running `npm run dev` server at `localhost:4321` with a local, isolated
Playwright/Chromium instance (the shared MCP browser remains contended by other sessions on this
machine). Real DOM, real click/keyboard events, real timers, real `localStorage`.

### 2.1 Draft — verified

| Check | Result |
|---|---|
| Typing enables the Save button immediately | Pass (live per-keystroke toggle, no debounce needed for button state) |
| Debounced draft write (650ms), not per keystroke | Pass — status appears only after the pause |
| "Draft saved" copy | Pass — exact approved copy incl. supporting line |
| Draft is NOT written to Vault before an explicit save | Pass — `declare-vault-v1` had **0** `journeyReflection` items while a draft existed |
| Draft stored in the existing journey instance, not a new key | Pass — found under `db_journey_inst:anxiety` → `dayState[N].reflectDraft` |
| Refresh restores the draft | Pass — text and "Draft restored" status both returned |
| Close and reopen restores the draft | Pass (also exercised in the conflict test) |
| Resume restores exact step + saved state | Pass — reopened on step 6 with the saved reflection and "Continue" |
| A different Journey never sees another Journey's draft | Pass — new journey opened step 6 with empty text and no status, while the first journey's instance blob kept its own draft intact |
| Theme switch preserves draft text and step | Pass |

### 2.2 Vault — verified

| Check | Result |
|---|---|
| Save Reflection creates exactly one item | Pass |
| Correct metadata | Pass — `day: 1`, `struggle: "anxiety"`, `journeyTitle: "Anxiety → Peace"`, `type: "journeyReflection"` |
| Deterministic clientId | Pass — `journeyReflection:anxiety:<seed>:day1` |
| Repeat save updates the same item (no duplicate) | Pass — count stayed **1**, id identical |
| Original created timestamp preserved | Pass — `ts` unchanged across saves |
| Edited timestamp advances | Pass — `updatedTs` moved forward |
| `Saving...` state (three literal periods) | Pass, button disabled during it |
| `Saved to Vault` final state + `Continue` | Pass |
| Reflection appears in the Vault list | Pass — its own "Journey Reflections" shelf card |
| Reflection appears in Vault detail | Pass — body plus "DAY 1 OF 5 · ANXIETY → PEACE" metadata line |
| Deletion works and is unchanged | Pass — removed via the existing generic delete, count → 0 |
| Guest can save with no sign-in gate | Pass — saved while signed out, no auth prompt, no interruption |

### 2.3 Conflict — verified

| Check | Result |
|---|---|
| Newer draft vs. older saved item raises the prompt | Pass |
| No prompt when content/timestamps agree | Pass — resolved silently, Vault version shown |
| "Restore Draft" loads the newer draft | Pass — button returned to "Save Reflection" |
| "Use Saved Reflection" keeps the saved version | Pass |
| Choosing then saving updates the same item | Pass — still 1 item, same id |
| Unselected version preserved until the user chooses | Pass — neither version mutated while the prompt was open (textarea is `readonly` during the conflict, so nothing is overwritten by accident) |

### 2.4 Navigation and gate — verified

| Check | Result |
|---|---|
| Step 6 blocks Continue until a successful save | Pass — button reads "Save Reflection", disabled while empty |
| Empty / whitespace-only cannot be saved | Pass |
| After save, primary becomes "Continue" | Pass |
| Continue advances to step 7 | Pass |
| Back from step 7 returns to step 6 showing the saved reflection | Pass — text and "Continue" both restored |
| Steps 3/4/5/7 gating unchanged | Pass — full walk still required cast / breathe / declare exactly as before |
| Review mode never mutates state | Pass — no textarea, no autosave, no save button, no duplicate written |

### 2.5 Review mode — verified

| Check | Result |
|---|---|
| Saved reflection shown read-only | Pass — read-back text, "Saved to Vault" badge, edit wrapper `display:none` |
| No editable textarea in review | Pass |
| Empty state when no reflection exists | Pass — "No reflection was saved for this day." (tested with a fixture simulating a day completed before B3.3 existed) |
| `Back to Today` preserved | Pass |

### 2.6 Console

Zero errors across every scenario above (draft, save, conflict, error, review, Vault list/detail,
guest, theme switch), other than the pre-existing environment-wide Astro dev-toolbar
`504 Outdated Optimize Dep` warning already documented in B3.2 and confirmed unrelated (it appears
identically on untouched pages).

### 2.7 Vault editing and copy — verified (added after review)

Added at Jeff's direction once testing exposed that a completed day's reflection was uneditable
everywhere. See the implementation summary §13 for the reasoning.

| Check | Result |
|---|---|
| Edit + Copy actions present on a reflection | Pass |
| Share action correctly absent | Pass |
| Delete action still present | Pass |
| Editor prefills with current text | Pass |
| Editor has an accessible name | Pass — `aria-label="Edit reflection"` |
| Save / Cancel touch targets | Pass — both 44px tall |
| Empty / whitespace-only edit refused | Pass — toast, editor stays open, nothing written |
| Cancel discards without writing | Pass — item byte-identical afterwards |
| Save updates in place | Pass — **same id, still 1 item**, `ts` preserved, `updatedTs` advanced |
| `day` / `journeyTitle` metadata preserved through an edit | Pass |
| Rendered body reflects the new text | Pass |
| Console errors | None |

**Vault-edit vs. Step 6 draft interaction — the reason this was originally deferred.** Verified
end-to-end: saved in Step 6, left a newer unsaved Step 6 draft, then edited the same reflection in
the Vault, then reopened Step 6.

| Check | Result |
|---|---|
| Vault edit produces a newer `updatedTs` than the draft | Pass |
| No spurious conflict prompt on reopen | Pass — Vault is newer, so it wins silently |
| Textarea shows the Vault text | Pass |
| Status / button | Pass — "Saved to Vault" / "Continue" |
| Superseded draft cleared | Pass |
| Still exactly one Vault item | Pass |

**The existing conflict rule required no modification** — `draftTs > (updatedTs ?? ts)` already
handles a Vault edit correctly, which retroactively validates that timestamp comparison as the
right abstraction rather than a Step-6-specific hack.

---

---

## 3. Responsive — verified, all required viewports × both themes

Captured Step 6 in three states (empty, draft-saved, saved-to-Vault) at every required target, in
both light and dark. All 12 viewport × theme combinations passed with no failures.

390×844 · 390×667 · 768×1024 portrait · 1024×768 landscape · 1440×900 · 1728×1117 · plus 200% zoom.

- **Mobile:** textarea usable, status subtle but visible, Save reachable, no footer overlap, no
  horizontal scroll.
- **Tablet:** comfortable writing width in both orientations; bounded dialog, not a stretched phone
  layout.
- **Desktop:** centered ritual shell over the dimmed/blurred app backdrop, comfortable measure,
  controls not oversized.

---

## 4. Accessibility — verified

| Check | Result |
|---|---|
| Textarea accessible label | Pass — `aria-label="Your reflection"` |
| Prompt associated with the field | Pass — `aria-describedby="reflectPrompt"`, target confirmed present |
| Status live region | Pass — `aria-live="polite"` |
| Error live region | Pass — `aria-live="assertive"` |
| Conflict panel labeled | Pass — `role="region"`, `aria-label="Draft conflict"` |
| Autosave does not spam announcements | Pass — the polite region only updates on settled events (post-debounce, restore, saved), never per keystroke |
| Focus is not stolen during autosave | Pass — focus stayed in the textarea across a debounce cycle |
| Save button reachable and operable by keyboard | Pass — reached by Tab, activated with Enter |
| Focus stable/restored across the save | Pass **after a fix** — see §5 |
| Conflict options keyboard reachable | Pass — both in tab order, sensible order |
| Touch targets ≥44px | Pass — Save button 52px tall; conflict options 60px |
| Hidden states not tabbable | Pass — `display:none` on both the error and conflict panels |
| 200% zoom | Pass — no horizontal scroll, Save still visible |
| Larger text (root font-size bump) | Pass — no horizontal scroll |
| Mobile keyboard-open layout | Pass — Save still reachable, no horizontal scroll (approximated with a 390×420 viewport) |
| No information by color alone | Pass — every state pairs color with an icon and explicit text |

---

## 5. Real defects found, and what was done

Four genuine bugs surfaced through live testing (none from re-reading the spec). Three were found
during the implementation pass; the fourth was found during the final review pass and was the most
serious of the set.

### Bug 1 — Save-failure path was unreachable dead code

| | |
|---|---|
| **Severity** | High — the entire error/retry experience could never fire, and a failed local write was reported to the user as a success |
| **File** | `src/app/declare/vault-store.js` |
| **Root cause** | `persist()` caught its own `localStorage` exception and returned `undefined`. `upsertItem()` had no way to know the write failed, so it always returned a truthy item and the caller always rendered "Saved to Vault" |
| **Fix** | `persist()` now returns a real boolean; `upsertItem()` returns `null` when the local write fails, before any Convex mirror is attempted |
| **Test used to expose it** | Monkey-patched `localStorage.setItem` to throw once for the `declare-vault-v1` key, then saved |
| **Verification** | Error panel appears, button becomes "Try Again", reflection text and draft both intact, Vault count stays 0, retry after restoring storage succeeds and count becomes 1 |
| **Origin** | **Pre-existing** — `persist()` has swallowed exceptions since before B3.3. B3.3 is the first caller that needed a success signal, which is what surfaced it |

### Bug 2 — Error button rendered with no background and the wrong shadow

| | |
|---|---|
| **Severity** | Medium — the error state was legible but visually wrong; the destructive/retry affordance did not read as such |
| **File** | `src/pages/journey.astro` (styles) |
| **Root cause** | Two independent faults. (a) `--rust`/`--sage` were declared on `.journey .block.reflect`, but `#dfComplete` lives in `.df-foot`, a **sibling** of that block, not a descendant, so `var(--rust)` resolved to nothing. (b) The error rule `.journey .df-btn-error.btn` tied on specificity with `.journey .df-foot .btn` and lost the `box-shadow` on source order |
| **Fix** | Moved the custom properties up to `.journey .dayflow` (covers the whole ritual shell, footer included) and raised the error rule to `.journey .df-foot .btn.df-btn-error` so it wins on specificity rather than order |
| **Test used to expose it** | Read computed styles on the button in the error state; `background` came back `rgba(0,0,0,0) none` |
| **Verification** | Computed `background: rgb(232,155,126)` and the rust box-shadow; confirmed visually in `draft/06-save-error.png` |
| **Origin** | **Introduced during B3.3** |

### Bug 3 — Saving destroyed keyboard focus

| | |
|---|---|
| **Severity** | High for keyboard and screen-reader users — focus silently jumped to `<body>`, so the user lost their place entirely and had to tab in from the top of the dialog |
| **File** | `src/pages/journey.astro` |
| **Root cause** | Setting `disabled = true` on the focused button (to render the "Saving..." state) blurs it to `<body>` in every browser. Nothing focused it back once it was re-enabled |
| **Fix** | Added `restoreSaveFocus(hadFocus)`, called after both the success and error branches. It reclaims focus **only** if the button owned focus before the save **and** focus has since fallen to `<body>`/`<html>` — so it never steals focus from a user who deliberately moved back into the textarea mid-save |
| **Test used to expose it** | Focused the button, activated it, and read `document.activeElement` during and after the save |
| **Verification** | Before: `BODY#` after save. After: `BUTTON#dfComplete`. Applies to both the success ("Continue") and error ("Try Again") outcomes |
| **Origin** | **Introduced during B3.3** (the "Saving..." disabled state is new) |

### Bug 4 — False save state after editing a saved reflection (found in final review)

| | |
|---|---|
| **Severity** | **High — this is the "false save state" acceptance blocker.** The UI claimed text was durably saved when it was not, and offered no way to save it |
| **File** | `src/pages/journey.astro` |
| **Root cause** | `ds.reflected` was set once on save and never re-evaluated. Editing the textarea afterwards left `reflected === true`, so the status kept reading "Saved to Vault", the footer kept offering "Continue", and `updateReflectButtonLive()` early-returned on `dstate().reflected` and refused to re-enable saving. The Vault still held the old text |
| **Fix** | New `syncReflectSavedState()` compares the trimmed textarea value against the actual Vault item on every input and flips `ds.reflected` to match reality. Diverging re-gates Step 6 and restores the "Save Reflection" action; editing back to exactly the saved text returns to the saved state rather than demanding a pointless re-save |
| **Test used to expose it** | Saved a reflection, edited it, then read the button label, the status text, and the Vault item's stored text together |
| **Verification** | Before: button "Continue", status "Saved to Vault", Vault text `"Original saved text."`, textarea `"Original saved text. PLUS AN UNSAVED EDIT."` — a direct contradiction. After: button "Save Reflection", status "Draft saved". Re-saving updates the same item (`sameId: true`, `ts` preserved, `updatedTs` advanced, count still 1). Editing back to the saved text returns "Continue" + "Saved to Vault". Whitespace-only differences correctly count as unchanged |
| **Origin** | **Introduced during B3.3** |

### Smaller polish corrections (same review passes)

- The error panel's two lines rendered side-by-side instead of stacked (`align-items: flex-start` on a row flexbox → `flex-direction: column`).
- Vault wrapped reflections in decorative quote marks like a scripture verse, which reads wrong for a personal journal entry — now unquoted, matching how declarations are already treated.
- Hardened the Vault detail metadata line: `t.day` is now passed through `esc()` like every other field, so nothing from `localStorage` is interpolated raw.
- Added a defensive `clearTimeout(reflectDebounceT)` at the top of `renderDayFlow()`. A pending debounce closes over the textarea node that `innerHTML` is about to destroy; the timer is currently always cleared by `closeDayFlow()` first, so this is latent rather than reachable, but the guard removes the whole class of stale-write bug.

---

## 6. Signed-in and Convex status — precise classification

Each layer is classified separately, because they have genuinely different confidence levels:

| Layer | Status |
|---|---|
| Local-first save while signed in | **Inferred, not verified.** The code path is identical to the guest path (`upsertItem()` writes locally before any auth check), and the guest path is fully verified. No signed-in session was exercised |
| Convex payload generation | **Inspected, not executed.** `toPayload()` was read and confirmed to whitelist the five new fields and to drop `null`/`undefined`. It was not observed producing a real payload |
| Deployed schema acceptance | **VERIFIED — deployed 2026-07-30 to `dev:good-dotterel-906`.** See §6a below for the probe method and results |
| Remote mirror | **Unblocked, but still not executed.** The deployment now accepts the payload; an actual signed-in mirror has not been observed |
| Cross-device retrieval | **Not verified.** Requires two signed-in sessions |

### 6a. Deployment verification (post-`npx convex dev`)

Verified without credentials by exploiting the fact that **Convex runs argument validation before the
handler**. `vault.save` calls `requireUserId()`, which throws for an unauthenticated caller — so the
*kind* of error distinguishes the two cases decisively, and no write can occur either way:

- An **`ArgumentValidationError`** means the field is not on the deployed validator.
- **`Not authenticated`** means validation passed and execution reached the handler.

| Probe | Result | Meaning |
|---|---|---|
| Payload with all five B3.3 fields | `Not authenticated` | Validation **passed** — fields are deployed |
| Control: payload with a deliberately bogus field | `ArgumentValidationError: ... extra field` | Validator **is** strict, so the pass above is meaningful, not a false positive |

The control probe's error also dumps the full deployed validator, which was parsed to confirm each
field individually:

```
day           v.optional(v.float64())
updatedTs     v.optional(v.float64())
journeyTitle  v.optional(v.string())
prompt        v.optional(v.string())
route         v.optional(v.string())
```

All five present, all optional. (`v.float64()` is Convex's internal representation of `v.number()`.)

**Backward-compatibility regression probe** — every pre-existing item type still passes argument
validation against the deployed mutation, confirming the additive change broke nothing:

| Type | Result |
|---|---|
| `verse` | args OK (reached handler) |
| `word` (verses + declarations + prayer) | args OK |
| `declaration` (with `bg*` card fields) | args OK |
| `journeyReflection` (new) | args OK |

**Still not verified:** an actual signed-in save, the resulting remote row, and cross-device
retrieval. Those need real Better Auth credentials in a browser session — see §8.

**Nothing in this milestone claims remote Convex success.** The user-facing copy says "Saved to
Vault" because Vault is the product destination and the local write genuinely succeeded; no copy
anywhere promises cross-device availability.

## 7. Other inferred items

- **Spanish rendering.** **Now verified live — see §7a.** (The Spanish *wording* is still flagged
  for native es-LA editorial review in the implementation doc; that is a copy-quality question, not
  a rendering one.)
### 7a. Spanish rendering — verified live

Run with the `declare-lang=es` cookie set before first paint (the i18n engine is cookie-driven);
`window.I18N.lang()` confirmed `"es"`. Every B3.3 surface was walked and the **actually rendered**
strings were read back from the DOM, not asserted from source:

| Surface | Rendered |
|---|---|
| Step label | `Reflexiona` |
| Textarea placeholder | `Escribe con libertad. Esto es entre tú y Dios.` |
| Textarea `aria-label` | `Tu reflexión` |
| Button, empty / typed | `Guardar reflexión` |
| Button, saving | `Guardando...` (three literal periods) |
| Button, saved | `Continuar` |
| Button, edited after save | `Guardar reflexión` (re-gate works in es) |
| Button, error | `Intentar de nuevo` |
| Status, draft | `Borrador guardado` / `Estamos manteniendo tu reflexión segura mientras escribes.` |
| Status, saved | `Guardado en la Bóveda` / `Puedes volver a esta reflexión cuando quieras en tu Bóveda.` |
| Error panel | `No pudimos guardar esta reflexión en la Bóveda.` / `Tu borrador sigue seguro.` |
| Conflict heading | `Encontramos un borrador más reciente.` |
| Conflict body | `Tienes un borrador más reciente que la reflexión guardada. ¿Qué te gustaría hacer?` |
| Conflict options | `Restaurar borrador` / `Usar reflexión guardada` (both with Spanish sublabels) |
| Conflict region `aria-label` | `Conflicto de borrador` |
| Review badge | `Repasando un día completado · Solo lectura` |
| Review empty state | `No se guardó ninguna reflexión para este día.` |
| Vault shelf | `Guardado recientemente` |
| Vault card name | `Reflexiones de camino` |
| Vault type tag | `Reflexión de camino` |
| Vault detail metadata | `Día 1 de 5 · Ansiedad → Paz` |

No page errors. Screenshots: `light/es-01..04-*`, `conflict/04-es-conflict-prompt.png`,
`review/03-es-no-reflection.png`, `vault/07-es-detail.png`.

**Behavioral note worth recording:** `journeyTitle` is captured from the localized `cFrom()`/`cTo()`
labels **at save time**, so a reflection saved in Spanish stores `"Ansiedad → Paz"` and one saved in
English stores `"Anxiety → Peace"`. A user who later switches language will still see the original
language on that stored item. This matches how other stored Vault content already behaves and was
not changed; flagged so it is a known, deliberate property rather than a surprise.

- **Draft loss window on hard refresh.** A refresh within the 650ms debounce window loses the last
  keystrokes. This is inherent to debounced autosave and is mitigated by the explicit flush on
  close; no `pagehide`/`visibilitychange` flush was added, since that was not requested and adds
  listener lifecycle the milestone did not ask for. Documented rather than silently accepted.

---

## 8. Not testable in this environment

- **Signed-in save, remote row, and cross-device retrieval.** Requires real Better Auth credentials
  in a browser session. The deployment now *accepts* the payload (§6a), but an actual signed-in
  mirror has not been observed. See §6 for the layer-by-layer classification.
- **Convex schema deploy.** Was **not run** during the implementation or review passes (both ended
  with it pending). Jeff ran `npx convex dev` afterwards; the resulting deployment was then verified
  independently — see §6a. **This report's §6a was written after that deploy; every other section
  predates it and describes local-first behavior only.**
- **TypeScript typecheck of `convex/`.** `typescript` is not installed in this project and
  `npx tsc` refuses to run without it. Installing it would add a dependency, which this milestone's
  engineering constraints forbid. The Convex changes were reviewed by reading, and are additive
  optional fields only. **No typecheck was run and none is claimed.**
- **Real screen readers** (VoiceOver / NVDA / TalkBack). Only DOM semantics, live-region attributes,
  focus behavior, and tab order were inspected and exercised. That is not the same as confirming
  actual announcement behavior.
- **OS-level Dynamic Type.** Only a browser root font-size increase and 200% zoom were tested.
- **No automated regression suite exists in this repo** to re-run any of this on future changes.
