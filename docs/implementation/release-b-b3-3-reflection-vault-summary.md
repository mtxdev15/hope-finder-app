# B3.3 — Reflection Draft and Vault Persistence (Implementation Summary)

**Branch:** `redesign/release-b-journey`
**Base commit:** `6d9a658` (B3.2 paginated seven-step ritual)
**Scope:** B3.3 *saves* the reflection. B3.4 *interprets* it. No AI code of any kind is in this change.

---

## 1. Corrections to the stated task assumptions

Verified directly against the code before writing anything. Four assumptions in the brief were
wrong, and the plan changed accordingly:

1. **The Vault store is `src/app/declare/vault-store.js`**, not `public/declare/vault-store.js`.
2. **`saveItem()` is not an upsert.** It creates once and silently ignores repeat saves with the
   same `id` (`if (!data.items.some(...))`). Every existing caller depends on that create-once
   behavior for idempotent verse/word saves, so it was left untouched and a new `upsertItem()`
   was added alongside it.
3. **A Convex schema change *was* required.** The `vaultItems` validator is a closed field set
   with nothing for day number, journey title, prompt, route, or an edited-timestamp. (The Convex
   `vault.save` mutation itself already upserts correctly by `clientId` — only the field list
   needed extending.)
4. **`vault.astro` only rendered `word`/`verse`/`declaration`/`prayer`.** Without a new branch, a
   reflection would have saved successfully and rendered nowhere.

Two further findings that shaped the work:

- **No `--ok`/`--err` semantic tokens exist.** Rather than invent a palette, the two colors reuse
  hex values already established in `vault.astro`: `#9BD0A8` (its prayer-type tag) for success and
  `#E89B7E` (its delete-hover accent) for error.
- **`ensureSignedIn()` passes guests through** (`isConfigured() || isSignedIn()` returns `true`),
  confirming no sign-in wall is needed. It is deliberately **not** called for Save Reflection.

---

## 2. Vault storage reality (verified, not assumed)

| Claim | Verified |
|---|---|
| Vault writes to localStorage first | Yes — synchronously, always, key `declare-vault-v1` |
| Signed-in users get a best-effort Convex mirror | Yes — `mirror()`, fail-soft, one retry, never throws |
| Guests stay local-only | Yes, permanently — no forced upgrade |
| `clientId` supports upsert | Convex side yes; **client side no** until `upsertItem()` was added |
| Deletion supported | Yes — `removeItem()`, already generic across all item types |
| Update supported | Not before this change; added via `upsertItem()` |
| A Journey-reflection type exists | No |
| Migration needed | No — the textarea was never wired to anything, so zero reflections exist |

---

## 3. Draft model

- **Storage:** the existing per-day `dayState[day]` object inside the existing
  `db_journey_inst:<struggleId>` localStorage blob. **No new storage key.** Three new fields:
  `reflectDraft` (string), `reflectDraftTs` (number), `reflected` (bool).
- **Backward compatibility:** `dstate()` backfills all three when missing, so a `db_journey_inst`
  cache written before B3.3 loads without error and simply starts with no draft.
- **Debounce:** 650ms (inside the requested 500–800ms band). Typing itself only flips the button's
  enabled state (`updateReflectButtonLive()`, one class/property toggle); the actual write happens
  after the pause.
- **Flush on close:** `closeDayFlow()` clears the pending timer and writes the draft immediately, so
  closing mid-sentence never loses the last keystrokes.
- **Never leaves the device before an explicit save:** the draft lives only in the journey instance
  blob, which is deliberately *not* mirrored to Convex (a pre-existing decision, see
  `saveInstance()`'s own comment: "Kept local (not mirrored) to avoid bloat").
- **Cleanup:** on a successful save, `reflectDraft`/`reflectDraftTs` are set to `null` — the draft
  is committed, so there is nothing left to restore or to conflict against.

---

## 4. Vault data model

- **Type:** `journeyReflection`.
- **Stable clientId:** `journeyReflection:<struggleId>:<seed>:day<N>`
  (e.g. `journeyReflection:anxiety:2390102210:day1`). This mirrors the existing
  `'journey:' + active.id + ':' + seed` convention already in this file. Including the seed means
  restarting the same struggle later never collides with the prior attempt's reflections. **The
  reflection text is never part of the identifier.**
- **Fields:** `text` (the body, same convention as a `verse` item), `struggle`, `day`,
  `journeyTitle` (e.g. "Anxiety → Peace"), `prompt` (the day's reflection question), `route`
  (`/journey`), `ts` (created — preserved across every update), `updatedTs` (edited — bumped each
  save). All new Convex fields are `v.optional`, so no existing item shape changes and no
  destructive migration exists.
- **Sync:** identical to every other Vault item — local write first, then a best-effort Convex
  mirror for signed-in users only.

---

## 5. Step 6 flow (every state)

```
empty             -> "Save Reflection", disabled
typing            -> button enables live (no status yet)
draft saved       -> "Draft saved / We're keeping your reflection safe while you write."
draft restored    -> "Draft restored / We restored what you were writing."
saving            -> "Saving..." button, disabled
saved to Vault    -> "Saved to Vault / You can revisit this reflection anytime in Vault." + "Continue"
edited after save -> re-gates: back to "Save Reflection" + "Draft saved"
                     (editing back to the saved text returns to "Continue" + "Saved to Vault")
save error        -> error panel + "Try Again" button (rust), draft intact, not advanced
conflict          -> "We found a newer draft." + Restore Draft / Use Saved Reflection
review (has one)  -> read-only badge + read-back text, no textarea, no controls
review (none)     -> "No reflection was saved for this day."
```

The primary footer button is the single action surface throughout (Save Reflection → Saving... →
Continue, or → Try Again on failure), matching the approved mockups rather than adding a second
competing button inside the block.

---

## 6. Gate behavior

**Step 6 is now a formal gate.** `stepReady(ds, 6)` returns `ds.reflected`, exactly parallel to
steps 3/4/5. An empty or whitespace-only reflection cannot be saved (button stays disabled), so
the user must intentionally write and save before continuing. Only leading/trailing whitespace is
trimmed for validation; internal paragraph breaks and the user's exact wording are preserved.

**`reflected` tracks reality, not history.** `syncReflectSavedState()` re-compares the textarea
against the actual Vault item on every keystroke, so the gate reflects whether *the text currently
on screen* is durably saved — not merely whether a save ever happened. Editing a saved reflection
re-gates Step 6 and restores the "Save Reflection" action; editing back to exactly the saved text
returns to the saved state without demanding a pointless re-save. This is what makes
"re-editing and re-saving updates the same Vault item" reachable directly from the UI, and it is
what prevents the footer from ever offering "Continue" over text that is not in the Vault.

Steps 3, 4, 5 and 7 gating are untouched. Step 7's defensive `cast && repented && spoke` check was
deliberately left exactly as-is rather than extended.

---

## 7. Guest and signed-in behavior

- **Guest:** saves to the local Vault, no sign-in gate, no interruption to the ritual. The UI says
  "Saved to Vault" because Vault is the product destination — and for a guest, the Vault genuinely
  is device-local. No cross-device promise is made anywhere in the copy.
- **Signed-in:** identical local-first write, plus the existing best-effort Convex mirror. A failed
  mirror never removes or corrupts the local item and never surfaces a false success message —
  there is no new sync UI in Step 6, because the existing Vault exposes no per-item sync state and
  inventing one was explicitly out of scope.

**Documented limitation:** cross-device availability for reflections depends on (a) the user being
signed in, (b) the Convex mirror succeeding, and (c) the schema change in §9 being deployed.

---

## 8. Duplicate prevention and conflict handling

**Duplicates:** one Vault item per Journey day, enforced by the deterministic clientId.
`upsertItem()` replaces the existing item's fields in place, preserves the original `ts`, and
stamps a new `updatedTs`. Verified live: two saves → one item, same id, `ts` unchanged,
`updatedTs` advanced.

**Conflict rule (exact):** a conflict is shown only when
`draftTs > (vaultItem.updatedTs ?? vaultItem.ts)` **AND** `draft !== vaultItem.text`. Equal or
older timestamps, or identical content, resolve silently with the Vault version winning. Neither
version is mutated until the user chooses; the unselected one stays intact. When there is no
conflict but a stale draft exists alongside a saved item (e.g. a newer copy synced down from
another device), the Vault version wins and the superseded draft is cleared rather than left to
re-compare forever.

---

## 9. Convex deployment — action required before cross-device sync works

`convex/schema.ts` and `convex/vault.ts` were edited to add the five optional fields.
**`npx convex dev` / `npx convex deploy` has NOT been run** — that pushes a real schema change to
the live dev deployment (`good-dotterel-906`) and is a deliberate, separate decision for Jeff.

Because every Convex call in this app fails soft, the feature is fully functional today for guests
and for local-first signed-in saves. Only the *remote mirror of reflection-specific fields* waits
on that deploy.

---

## 10. Review mode

Completed-day review is strictly read-only: no textarea, no autosave, no Save Reflection button,
no draft restore, no state mutation, no duplicate write. It shows either the saved reflection
(with a "Saved to Vault" badge and the text rendered via `textContent`, never `innerHTML`) or the
calm empty state. `Back to Today` is preserved. Review forces `ds.reflected = true` in memory the
same way it already forces `cast`/`repented`/`spoke`, so a day completed before B3.3 existed still
reviews cleanly.

---

## 11. Localization

`i18n-strings.js` holds **Spanish only** — English lives inline in markup (`data-i18n`) or via the
`esL() ? 'es' : 'en'` ternary for JS-rendered strings. Every B3.3 string is state-driven JS output,
so all of them follow the established ternary convention. One genuinely static key was added:
`vault.tReflection` ("Reflexión de camino"), plus the `Journey Reflections` shelf label in
`vault.astro`'s existing Spanish collection map.

New Spanish copy (flagged for editorial review by a native es-LA speaker):
Guardar reflexión · Guardando... · Borrador guardado · Borrador restaurado · Guardado en la Bóveda ·
Puedes volver a esta reflexión cuando quieras en tu Bóveda. · Estamos manteniendo tu reflexión
segura mientras escribes. · Restauramos lo que estabas escribiendo. · No pudimos guardar esta
reflexión en la Bóveda. · Tu borrador sigue seguro. · Intentar de nuevo · Encontramos un borrador
más reciente. · Restaurar borrador · Usar reflexión guardada · No se guardó ninguna reflexión para
este día.

No em/en dashes in new visible copy. "Saving..." uses three literal periods.

---

## 12. Accessibility

Textarea has `aria-label` plus `aria-describedby` pointing at the real prompt text. Status uses
`aria-live="polite"` and only announces on settled events (draft saved after debounce, draft
restored, saved to Vault) — never per keystroke. The error panel uses `aria-live="assertive"`. The
conflict panel is a labeled region with two full-width ≥44px options. Focus is never stolen during
autosave. Hidden states are `display:none`, so they are natively untabbable. No information is
conveyed by color alone — every state pairs its color with an icon and explicit text.

---

## 13. Vault editing decision (deliberate divergence from the concept mockup)

The concept mockup's Vault detail screen shows an **"Edit Reflection"** action. It is
**intentionally not implemented in B3.3.** The approved product behavior is:

- **Vault reflection items are view and delete.** No editing surface exists in `/vault`.
- **An active, unfinished Journey's reflection is edited in Step 6**, where the draft, save,
  conflict and gate logic all live.
- **Completed-day review stays read-only**, preserving exactly what was saved that day.
- **Editing a completed day's reflection is out of scope for B3.3.**

Rationale: a second editing surface in the Vault would directly contradict the read-only guarantee
of completed-day review, and would need its own conflict story against the Step 6 draft. That is a
scoped product decision, not an oversight. Flagged here rather than silently dropped, and no
document in this milestone promises an Edit Reflection button.

---

## 14. Explicitly excluded (B3.4)

Gentle Guidance · AI consent · AI loading/response states · AI Worker changes · crisis-language
detection · reflection text sent externally · new AI prompts · AI privacy copy · AI localization ·
Scripture-reader follow-through · personalized background expansion.

No AI code, no Worker file, and no unrelated TODO entry was touched.
