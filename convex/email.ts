import { Resend } from "@convex-dev/resend";
import { components } from "./_generated/api";
import { ActionCtx } from "./_generated/server";

// ── Single source of truth for the sender ───────────────────────────────────
// Resend's shared test sender. Until the declareandbelieve.com domain is verified
// in Resend (later step), real delivery is limited to the Resend account's own
// email. Swap this one line to a verified address when ready.
const FROM_EMAIL = "Declare & Believe <onboarding@resend.dev>";

// testMode:false so the component will enqueue to real addresses (default is true,
// which only permits *@resend.dev). Reads RESEND_API_KEY from the deployment env.
const resend: Resend = new Resend(components.resend, { testMode: false });

export const sendResetPassword = async (
  ctx: ActionCtx,
  { to, url }: { to: string; url: string }
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
