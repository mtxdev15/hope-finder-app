/* Declare & Believe — the failed-payment sequence's DECISIONS and WORDS.
 *
 * WHY THIS IS SEPARATE FROM dunning.ts
 * Dependency-free, exactly like plusPlans.ts, subscriptionGuard.ts and
 * stripeCancellation.ts, and for the same reason: scripts/verify-dunning-emails.ts
 * IMPORTS AND EXECUTES what is here rather than grepping for it. A suite that
 * greps source proves the file mentions a rule; a suite that runs the function
 * proves the rule holds.
 *
 * That matters more here than almost anywhere else in the codebase. This
 * sequence is scheduled by a mutation and its later stages fire days later, so
 * the only way to discover it is wrong is for it to be wrong in production, to
 * somebody whose card has just failed.
 *
 * The Convex parts — reading the subscription, resolving the address, calling
 * Stripe, sending — live in dunning.ts, which cannot be imported outside Convex.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

export type DunningStage = "failed" | "reminder" | "ending" | "paused";

/* WHEN EACH STAGE FIRES, as a delay from the first failure.
 *
 * `ending` is skipped entirely when grace is too short for it to be distinct —
 * at a 2-day grace, "tomorrow it pauses" and "it has paused" land close enough
 * together to read as nagging rather than warning. Below that threshold the
 * sequence is simply two emails, which is the honest shape rather than three
 * emails squeezed to fit. */
export function dunningDelayMs(stage: DunningStage, graceMs: number): number | null {
  if (stage === "failed") return 0;
  if (stage === "paused") return graceMs;

  /* THE MIDPOINT, and it exists because the window got longer.
   *
   * The first version of this had three stages: immediately, 24h before, and
   * on the day. That reads correctly at a 3-day grace — day 0, 2, 3. At the
   * 16-day window Apple uses it becomes day 0, 15, 16: one email, then over two
   * WEEKS of silence, then two emails inside a day. Somebody would reasonably
   * conclude it had been sorted out, and then lose Plus with a day's notice.
   *
   * So a reminder lands halfway, and only when halfway is far enough from both
   * ends to be its own message rather than a third nudge. Below a week the
   * three-stage shape was already right and this would just be noise. */
  if (stage === "reminder") {
    if (graceMs < 7 * DAY_MS) return null;
    return Math.round(graceMs / 2);
  }

  /* 24h before access stops. Skipped when the window is too short for the
     warning to be meaningfully distinct from the pause itself — at two days,
     "it pauses tomorrow" and "it has paused" land close enough together to read
     as nagging. Below that the sequence is honestly two emails rather than
     three squeezed to fit. */
  if (graceMs < 3 * DAY_MS) return null;
  return graceMs - DAY_MS;
}

/** The stages actually sent at a given grace window, in order.
 *
 * Never more than four, whatever the window — Paddle sends four, Recurly's own
 * guidance is three to four, and Stripe's own toggle sends eight. A longer
 * grace buys the reader more TIME, not more email. */
export function dunningSchedule(graceMs: number): DunningStage[] {
  return (["failed", "reminder", "ending", "paused"] as DunningStage[])
    .filter((s) => dunningDelayMs(s, graceMs) !== null);
}

/* ── Copy ─────────────────────────────────────────────────────────────────── */

/* House style, and it is the whole point of writing these ourselves:
 *   - the fault is the CARD's, never the reader's
 *   - no red, no capitals, no countdown, no "FAILED", "suspended", "terminated"
 *   - in a faith app, "your access has been withdrawn" can land as a verdict on
 *     the person rather than a billing status. It never appears.
 *   - one action, stated twice: the button, and the way to do it without one */
type Copy = { subject: string; heading: string; body: string[]; cta: string | null };

export function money(cents: number | null, currency: string | null): string | null {
  if (typeof cents !== "number") return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format(cents / 100);
  } catch {
    return null;
  }
}

export function longDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function copyFor(
  stage: DunningStage,
  facts: { card: string | null; amount: string | null; pausesOn: string },
): Copy {
  /* Named so the sentences below read as sentences. A missing card or amount
     degrades the wording rather than printing an empty gap — Stripe may not
     hand either back, and an email that says "we could not charge your  " is
     worse than one that simply says less. */
  const card = facts.card ? ` (${facts.card})` : "";
  const amount = facts.amount ? ` for ${facts.amount}` : "";

  if (stage === "failed") {
    return {
      subject: "We couldn't reach your card",
      heading: "We couldn't reach your card",
      body: [
        `Your payment${amount} for Declare Plus didn't go through${card}. ` +
          `That's almost always an expired or replaced card rather than anything you did.`,
        `Nothing has been lost. Your Plus features stay on until <strong>${facts.pausesOn}</strong> while we try again.`,
        `You can update your card from the button below — or, if you'd rather not click a link in an email, ` +
          `just open Declare and go to Billing. Both go to the same place.`,
        `And if money is the reason, please reply to this email and say so. ` +
          `We'll sort something out. You will not be asked to explain yourself twice.`,
      ],
      cta: "Update your card",
    };
  }

  if (stage === "reminder") {
    return {
      subject: "Still can't reach your card",
      heading: "Still no luck with your card",
      body: [
        `We're still not able to take your payment${amount} for Declare Plus${card}. ` +
          `We'll keep trying, and Plus stays on in the meantime.`,
        `If it's an expired card, updating it takes about a minute. ` +
          `You can use the button, or open Declare and go to Billing — whichever you prefer.`,
        `Plus stays on until <strong>${facts.pausesOn}</strong>.`,
      ],
      cta: "Update your card",
    };
  }

  if (stage === "ending") {
    return {
      subject: "Your Plus features pause tomorrow",
      heading: "Just a heads up",
      body: [
        `We still haven't been able to reach your card${card}, so Declare Plus will pause on <strong>${facts.pausesOn}</strong>.`,
        `Updating your card takes about a minute and everything comes straight back — nothing is deleted, ` +
          `and nothing you've saved goes anywhere.`,
        `As before, you can use the button or open Declare and go to Billing.`,
      ],
      cta: "Update your card",
    };
  }

  return {
    subject: "Your Plus features are paused",
    heading: "Plus is paused for now",
    body: [
      `We weren't able to reach your card${card}, so Declare Plus is paused.`,
      `You still have Declare. The daily Word, Scripture and everything you've saved are all still here, ` +
        `exactly as you left them — pausing Plus doesn't take any of that away.`,
      `Whenever you're ready, updating your card turns Plus back on right away. There's no rush and no penalty.`,
    ],
    cta: "Turn Plus back on",
  };
}

/* ── Rendering ────────────────────────────────────────────────────────────── */

/* Deliberately plain. A billing email that arrives looking like a marketing
 * campaign is both less trusted and more likely to be filtered, and this one
 * has to survive a reader who has been trained to distrust exactly this
 * message. Inline styles because email clients discard <style> blocks. */
export function render(copy: Copy, url: string): string {
  const paras = copy.body
    .map(
      (t) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#3D4A44;">${t}</p>`,
    )
    .join("");
  const button = copy.cta
    ? `<p style="margin:26px 0 8px;">
         <a href="${url}" style="display:inline-block;background:#2D4A3E;color:#FAF7F2;
            text-decoration:none;padding:13px 26px;border-radius:10px;font-size:15px;
            font-weight:600;">${copy.cta}</a>
       </p>`
    : "";
  return `<div style="background:#FAF7F2;padding:32px 16px;">
    <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #E8E0D0;
         border-radius:14px;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:#2D4A3E;font-weight:600;">
        ${copy.heading}
      </h1>
      ${paras}
      ${button}
      <p style="margin:24px 0 0;padding-top:20px;border-top:1px solid #E8E0D0;
         font-size:12.5px;line-height:1.6;color:#8A9490;">
        You're receiving this because you have a Declare Plus subscription.
        This is a one-off message about your billing, not a newsletter.
      </p>
    </div>
  </div>`;
}

