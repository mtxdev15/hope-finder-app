import { internalAction } from "./_generated/server";
import { v } from "convex/values";

// ── New-signup → Resend registration ────────────────────────────────────────
// Fires once per newly created account (email sign-up AND Google OAuth both
// converge on the `user.create.after` hook in convex/auth.ts). It is scheduled
// to run AFTER the sign-up commits and is fully decoupled from the sign-up
// request: nothing here can ever throw back into account creation, so a Resend
// outage can never break or slow a sign-up.
//
// Why raw REST instead of the @convex-dev/resend component: that component only
// *sends* email (see convex/email.ts). It has no contacts/segments/events
// surface, and the marketing flow needs to (1) add the person as a contact in a
// segment and (2) fire a custom event that the welcome automation triggers on.
//
// Env vars (Convex deployment):
//   RESEND_API_KEY     — already set, shared with convex/email.ts. Must be a
//                        FULL-ACCESS key (contacts + events), not sending-only.
//   RESEND_SEGMENT_ID  — id of the "Declare — All Signups" segment.
const RESEND_API = "https://api.resend.com";

export const registerNewContact = internalAction({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    // "en" | "es". Defaults to "en" until locale capture is wired at sign-up.
    locale: v.optional(v.string()),
  },
  handler: async (_ctx, { email, name, locale }) => {
    const apiKey = process.env.RESEND_API_KEY;
    // Missing config degrades to a silent no-op — never an error that could
    // surface anywhere near the sign-up path.
    if (!apiKey) {
      console.warn("[marketing] RESEND_API_KEY unset — skipping registration");
      return;
    }
    const segmentId = process.env.RESEND_SEGMENT_ID;
    const lang = locale === "es" ? "es" : "en";
    const firstName = (name ?? "").trim().split(/\s+/)[0] ?? "";
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    // (1) Upsert the contact into the signups segment, tagging locale so the
    //     welcome automation and blog broadcasts can branch en vs es. Snake_case
    //     body per the Resend REST contacts API; `segments` is an array of
    //     { id }. An already-existing contact is fine — log and continue.
    try {
      const res = await fetch(`${RESEND_API}/contacts`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          email,
          first_name: firstName,
          unsubscribed: false,
          properties: { locale: lang },
          ...(segmentId ? { segments: [{ id: segmentId }] } : {}),
        }),
      });
      if (!res.ok) {
        console.warn(
          `[marketing] contact upsert ${res.status}: ${await res.text()}`,
        );
      }
    } catch (err) {
      console.warn("[marketing] contact upsert failed", err);
    }

    // (2) Fire the `user.created` event for this contact — the trigger the
    //     welcome/onboarding automation will listen on (built next). With no
    //     automation attached yet, this is a harmless no-op on Resend's side.
    //     NOTE: confirm this endpoint the first time via the Convex dev logs —
    //     Resend's events REST route is the least-documented piece here.
    try {
      const res = await fetch(`${RESEND_API}/events`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          event: "user.created",
          email,
          payload: { locale: lang, name: name ?? "" },
        }),
      });
      if (!res.ok) {
        console.warn(
          `[marketing] user.created event ${res.status}: ${await res.text()}`,
        );
      }
    } catch (err) {
      console.warn("[marketing] user.created event failed", err);
    }
  },
});
