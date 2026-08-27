import type { ActionCtx } from "./_generated/server";

// ── Single source of truth for the sender ───────────────────────────────────
// `noreply` on the verified declareandbelieve.com root domain. Because the domain
// is verified in Resend, reset emails deliver to any recipient. Swap this one line
// if the sending address or domain ever changes.
const FROM_EMAIL = "Declare <noreply@declareandbelieve.com>";

/* ONE CLIENT FOR THE WHOLE APP, imported rather than constructed here.
 *
 * This file used to build a SECOND Resend client over the same component. Both
 * sent mail, but only the one in dunning.ts registered `onEmailEvent`, so
 * whether a bounce on a password-reset email was ever reported depended on
 * which instance the component happened to consult. That is not a question
 * worth having an answer to: a bounce is a bounce, and the suppression list
 * that stops us mailing somebody who complained should not depend on which
 * module sent the message.
 *
 * dunning.ts owns the instance because that is where the event handler and the
 * suppression logic live. */
import { resendClient as resend, supportReplyTo } from "./dunning";

export const sendResetPassword = async (
  ctx: ActionCtx,
  { to, url }: { to: string; url: string },
) => {
  await resend.sendEmail(ctx, {
    from: FROM_EMAIL,
    replyTo: supportReplyTo(),
    to,
    subject: "Reset your password",
    html: `
      <div style="font-family: sans-serif; line-height: 1.5;">
        <h2>Reset your password</h2>
        <p>We received a request to reset your Declare &amp; Believe password.</p>
        <p><a href="${url}">Click here to choose a new password</a></p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
    text: `Reset your password: ${url}`,
  });
};

export const sendVerificationEmail = async (
  ctx: ActionCtx,
  { to, url }: { to: string; url: string },
) => {
  await resend.sendEmail(ctx, {
    from: FROM_EMAIL,
    replyTo: supportReplyTo(),
    to,
    subject: "Confirm your email",
    html: `
      <div style="font-family: sans-serif; line-height: 1.6; color: #22382E;">
        <h2 style="font-family: Georgia, serif;">Welcome to Declare &amp; Believe</h2>
        <p>One quick step. Confirm your email and your words, verses, and journeys will follow you wherever you sign in.</p>
        <p><a href="${url}" style="display:inline-block; padding:12px 22px; background:#C9A84C; color:#22382E; text-decoration:none; border-radius:10px; font-weight:600;">Confirm my email</a></p>
        <p style="color:#6B6355; font-size:13px;">If you didn't create this account, you can safely ignore this email.</p>
      </div>
    `,
    text: `Confirm your email for Declare & Believe: ${url}`,
  });
};
