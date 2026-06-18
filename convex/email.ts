import { Resend } from "@convex-dev/resend";
import { components } from "./_generated/api";
import { ActionCtx } from "./_generated/server";

// ── Single source of truth for the sender ───────────────────────────────────
// `noreply` on the verified declareandbelieve.com root domain. Because the domain
// is verified in Resend, reset emails deliver to any recipient. Swap this one line
// if the sending address or domain ever changes.
const FROM_EMAIL = "Declare <noreply@declareandbelieve.com>";

// testMode:false so the component will enqueue to real addresses (default is true,
// which only permits *@resend.dev). Reads RESEND_API_KEY from the deployment env.
const resend: Resend = new Resend(components.resend, { testMode: false });

export const sendResetPassword = async (
  ctx: ActionCtx,
  { to, url }: { to: string; url: string },
) => {
  await resend.sendEmail(ctx, {
    from: FROM_EMAIL,
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
