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
 *   - one action, stated twice: the button, and the way to do it without one
 *
 * THE SPANISH IS A TRANSLATION OF THE INTENT, NOT OF THE WORDS. "We couldn't
 * reach your card" has no natural Spanish equivalent that stays that gentle, so
 * the Spanish says "no pudimos procesar tu tarjeta" and carries the same
 * meaning: the card did not answer, and nothing is wrong with you. It uses TÚ
 * throughout, matching auth-modal.js and the rest of the app — a billing email
 * that suddenly switched to usted would read as a letter from a collections
 * department, which is precisely the register this whole file exists to avoid.
 *
 * The banned-word list is enforced against the RENDERED text in BOTH
 * languages, because translating a ban list is exactly the kind of thing that
 * gets skipped. The Spanish list is not a translation of the English one: it
 * bans what Spanish billing letters actually say — "suspendido", "moroso",
 * "en mora", "inmediatamente", "aviso final", "dado de baja". Note that
 * "tarjeta vencida" is NOT banned and appears on purpose: applied to a card it
 * is the ordinary, blameless word for expired, and it is the single most
 * common real cause. Applied to a person it would be a different word. */
type Copy = {
  subject: string;
  heading: string;
  body: string[];
  cta: string | null;
  footer: string;
};

export type EmailLang = "en" | "es";

/* Which language a stored value means. Absent, unknown, or a language we no
 * longer ship all mean English — the same default a row sold before the
 * `locale` column existed gets. */
export function emailLang(x: unknown): EmailLang {
  return x === "es" ? "es" : "en";
}

/* Intl locale tags. es-US rather than es-ES deliberately: our Spanish readers
 * are overwhelmingly in the United States, are billed in dollars, and read
 * "$8.99" as naturally as an English reader does. es-ES would render the same
 * amount as "8,99 US$", which is correct in Spain and wrong for them. */
const INTL_LOCALE: Record<EmailLang, string> = { en: "en-US", es: "es-US" };

export function money(
  cents: number | null,
  currency: string | null,
  lang: EmailLang = "en",
): string | null {
  if (typeof cents !== "number") return null;
  try {
    return new Intl.NumberFormat(INTL_LOCALE[lang], {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format(cents / 100);
  } catch {
    return null;
  }
}

export function longDate(ms: number, lang: EmailLang = "en"): string {
  return new Date(ms).toLocaleDateString(INTL_LOCALE[lang], {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const FOOTER: Record<EmailLang, string> = {
  en:
    "You're receiving this because you have a Declare Plus subscription. " +
    "This is a one-off message about your billing, not a newsletter.",
  es:
    "Recibes esto porque tienes una suscripción a Declare Plus. " +
    "Es un mensaje puntual sobre tu pago, no un boletín.",
};

function copyEs(
  stage: DunningStage,
  card: string,
  amount: string,
  pausesOn: string,
): Copy {
  const footer = FOOTER.es;

  if (stage === "failed") {
    return {
      subject: "No pudimos procesar tu tarjeta",
      heading: "No pudimos procesar tu tarjeta",
      body: [
        `Tu pago${amount} de Declare Plus no se completó${card}. ` +
          `Casi siempre es una tarjeta vencida o reemplazada, no algo que hayas hecho tú.`,
        `No has perdido nada. Tu Plus sigue activo hasta el <strong>${pausesOn}</strong> mientras lo intentamos de nuevo.`,
        `Puedes actualizar tu tarjeta con el botón de abajo. Si prefieres no abrir un enlace de un correo, ` +
          `entra a Declare y ve a Facturación. Los dos llevan al mismo lugar.`,
        `Y si el motivo es el dinero, respóndenos a este correo y dínoslo. ` +
          `Lo resolvemos. No tendrás que explicarlo dos veces.`,
      ],
      cta: "Actualizar mi tarjeta",
      footer,
    };
  }

  if (stage === "reminder") {
    return {
      subject: "Tu tarjeta todavía no responde",
      heading: "Tu tarjeta todavía no responde",
      body: [
        `Seguimos sin poder procesar tu pago${amount} de Declare Plus${card}. ` +
          `Lo vamos a seguir intentando, y mientras tanto tu Plus sigue activo.`,
        `Si es una tarjeta vencida, actualizarla toma como un minuto. ` +
          `Puedes usar el botón, o entrar a Declare e ir a Facturación, lo que prefieras.`,
        `Tu Plus sigue activo hasta el <strong>${pausesOn}</strong>.`,
      ],
      cta: "Actualizar mi tarjeta",
      footer,
    };
  }

  if (stage === "ending") {
    return {
      subject: "Tu Plus se pausa mañana",
      heading: "Solo para avisarte",
      body: [
        `Todavía no hemos podido procesar tu tarjeta${card}, así que Declare Plus se pausa el <strong>${pausesOn}</strong>.`,
        `Actualizar tu tarjeta toma como un minuto y todo vuelve enseguida. No se borra nada, ` +
          `y nada de lo que has guardado se va a ningún lado.`,
        `Como antes, puedes usar el botón o entrar a Declare e ir a Facturación.`,
      ],
      cta: "Actualizar mi tarjeta",
      footer,
    };
  }

  return {
    subject: "Tu Plus está en pausa",
    heading: "Tu Plus está en pausa por ahora",
    body: [
      `No pudimos procesar tu tarjeta${card}, así que Declare Plus está en pausa.`,
      `Sigues teniendo Declare. La Palabra de cada día, las Escrituras y todo lo que has guardado siguen aquí, ` +
        `tal como lo dejaste. Pausar Plus no te quita nada de eso.`,
      `Cuando quieras, actualizar tu tarjeta vuelve a activar Plus al instante. No hay prisa y no hay penalización.`,
    ],
    cta: "Activar Plus de nuevo",
    footer,
  };
}

export function copyFor(
  stage: DunningStage,
  facts: { card: string | null; amount: string | null; pausesOn: string },
  lang: EmailLang = "en",
): Copy {
  /* Named so the sentences below read as sentences. A missing card or amount
     degrades the wording rather than printing an empty gap — Stripe may not
     hand either back, and an email that says "we could not charge your  " is
     worse than one that simply says less. */
  const card = facts.card ? ` (${facts.card})` : "";

  if (lang === "es") {
    /* "de $8.99", not "for $8.99". The preposition belongs to the language, so
       it is built here rather than passed in already glued to the number. */
    return copyEs(stage, card, facts.amount ? ` de ${facts.amount}` : "", facts.pausesOn);
  }

  const amount = facts.amount ? ` for ${facts.amount}` : "";
  const footer = FOOTER.en;

  if (stage === "failed") {
    return {
      subject: "We couldn't reach your card",
      heading: "We couldn't reach your card",
      body: [
        `Your payment${amount} for Declare Plus didn't go through${card}. ` +
          `That's almost always an expired or replaced card rather than anything you did.`,
        `Nothing has been lost. Your Plus features stay on until <strong>${facts.pausesOn}</strong> while we try again.`,
        `You can update your card from the button below. If you'd rather not click a link in an email, ` +
          `just open Declare and go to Billing. Both go to the same place.`,
        `And if money is the reason, please reply to this email and say so. ` +
          `We'll sort something out. You will not be asked to explain yourself twice.`,
      ],
      cta: "Update your card",
      footer,
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
          `You can use the button, or open Declare and go to Billing, whichever you prefer.`,
        `Plus stays on until <strong>${facts.pausesOn}</strong>.`,
      ],
      cta: "Update your card",
      footer,
    };
  }

  if (stage === "ending") {
    return {
      subject: "Your Plus features pause tomorrow",
      heading: "Just a heads up",
      body: [
        `We still haven't been able to reach your card${card}, so Declare Plus will pause on <strong>${facts.pausesOn}</strong>.`,
        `Updating your card takes about a minute and everything comes straight back. Nothing is deleted, ` +
          `and nothing you've saved goes anywhere.`,
        `As before, you can use the button or open Declare and go to Billing.`,
      ],
      cta: "Update your card",
      footer,
    };
  }

  return {
    subject: "Your Plus features are paused",
    heading: "Plus is paused for now",
    body: [
      `We weren't able to reach your card${card}, so Declare Plus is paused.`,
      `You still have Declare. The daily Word, Scripture and everything you've saved are all still here, ` +
        `exactly as you left them. Pausing Plus doesn't take any of that away.`,
      `Whenever you're ready, updating your card turns Plus back on right away. There's no rush and no penalty.`,
    ],
    cta: "Turn Plus back on",
    footer,
  };
}

/* ── The trial reminder ───────────────────────────────────────────────────
 *
 * THE EMAIL THAT MAKES A CARD-REQUIRED TRIAL FAIR.
 *
 * Three unrelated apps put the same screen in front of a trial: a timeline
 * promising "Day 5: we will remind you". It converts because it removes the one
 * real fear, which is a charge nobody saw coming. That promise is worthless
 * unless this email actually arrives, so it is written to the same standard as
 * the failed-payment sequence and asserted by the same suite.
 *
 * IT SAYS THE AMOUNT AND THE DATE IN THE FIRST TWO LINES. Anything that buries
 * either is the kind of reminder that technically exists.
 *
 * AND IT DOES NOT ARGUE. There is no last-minute pitch, no discount, no "are
 * you sure". Somebody deciding whether to keep paying for a prayer app should
 * not be handled. The button is how to stop; staying is what happens if they do
 * nothing, and that is stated plainly rather than implied. */
export function trialEndingCopy(
  facts: { amount: string | null; chargesOn: string; card: string | null },
  lang: EmailLang = "en",
): Copy {
  const card = facts.card ? ` (${facts.card})` : "";
  if (lang === "es") {
    return {
      subject: "Tu prueba de Plus termina en 3 días",
      heading: "Tu prueba termina en 3 días",
      body: [
        `Te avisamos como prometimos. El <strong>${facts.chargesOn}</strong> tu prueba gratis de Declare Plus ` +
          `termina y se hace el cobro${facts.amount ? ` de ${facts.amount}` : ""}${card}.`,
        `Si quieres seguir, no tienes que hacer nada. Plus continúa sin interrupción.`,
        `Si prefieres no seguir, cancela con el botón de abajo y no se te cobra nada. ` +
          `También puedes entrar a Declare e ir a Facturación. Toma menos de un minuto.`,
        `De cualquier forma, lo que has guardado sigue siendo tuyo.`,
      ],
      cta: "Ver o cancelar mi plan",
      footer: FOOTER.es,
    };
  }
  return {
    subject: "Your Plus trial ends in 3 days",
    heading: "Your trial ends in 3 days",
    body: [
      `This is the reminder we promised. On <strong>${facts.chargesOn}</strong> your free trial of Declare Plus ` +
        `ends and the card is charged${facts.amount ? ` ${facts.amount}` : ""}${card}.`,
      `If you want to carry on, there is nothing to do. Plus continues without a break.`,
      `If you would rather not, cancel with the button below and nothing is charged. ` +
        `You can also open Declare and go to Billing. It takes under a minute.`,
      `Either way, everything you have saved stays yours.`,
    ],
    cta: "See or cancel my plan",
    footer: FOOTER.en,
  };
}

/* Where the one button points.
 *
 * ALWAYS OUR OWN DOMAIN, never a Stripe-hosted URL — that is one of the three
 * anti-phishing properties this file exists to hold, and the only one a reader
 * can check before clicking.
 *
 * `?lang=es` is carried so the page opens in the language the email was
 * written in even on a device that has never chosen Spanish — somebody
 * reading on a work laptop should not land on an English billing page. i18n.js
 * honours the parameter, writes the choice, and then STRIPS it from the URL, so
 * it cannot pin them to Spanish afterwards. English is the default and carries
 * no parameter at all. */
export function billingUrl(site: string, lang: EmailLang = "en"): string {
  const base = site.replace(/\/+$/, "") + "/billing";
  return lang === "es" ? base + "?lang=es" : base;
}

/* Home, for a reader who would rather start from the front door than follow a
 * link about money. Carries the language for the same reason billingUrl does. */
export function homeUrl(site: string, lang: EmailLang = "en"): string {
  const base = site.replace(/\/+$/, "") + "/";
  return lang === "es" ? base + "?lang=es" : base;
}

/* ── Rendering ────────────────────────────────────────────────────────────── */

/* Deliberately plain. A billing email that arrives looking like a marketing
 * campaign is both less trusted and more likely to be filtered, and this one
 * has to survive a reader who has been trained to distrust exactly this
 * message. Inline styles because email clients discard <style> blocks.
 *
 * THE WORDMARK IS TEXT, NOT AN IMAGE, and that is the whole trick. Every other
 * company puts a logo file at the top of a billing email; we cannot, because a
 * remote image is exactly the mechanism an open-tracking pixel uses and this
 * file renders no <img> at all — a suite asserts it. Gmail also strips inline
 * SVG, so that is not a way round it either. Set in the app's own Cormorant
 * Garamond with Georgia as the real fallback, it carries the brand with no
 * external request, nothing for a client to block, and nothing to load.
 *
 * IT LINKS HOME, and the invariant it lives under is worth stating exactly.
 * An earlier version of this file allowed exactly ONE anchor, on the reasoning
 * that a single unambiguous action is what resists phishing. That was stricter
 * than the real property. What actually protects the reader is the card's last
 * four, a link on our own domain, and the stated alternative to clicking at all
 * — and a second link to our own front door weakens none of them. Somebody
 * anxious about a payment should not have to follow a link about money just to
 * reach the site.
 *
 * So the rule is: EVERY anchor points at our own domain, and exactly ONE of
 * them is an action. The suite asserts both halves, which is the part that
 * matters — the count was never the point, the destination is.
 *
 * The headings use the same serif as the app's headings; the body stays in the
 * system sans stack, because a webfont this email never loads would be a
 * declaration with no font behind it. */
export function render(copy: Copy, url: string, home: string): string {
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
         border-radius:14px;padding:30px 32px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <p style="margin:0 0 22px;padding-bottom:17px;border-bottom:1px solid #E8E0D0;
         font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:19px;
         line-height:1;font-weight:600;letter-spacing:.005em;">
         <a href="${home}" style="color:#2D4A3E;text-decoration:none;">Declare &amp; Believe</a></p>
      <h1 style="margin:0 0 18px;font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;
         font-size:27px;line-height:1.22;color:#2D4A3E;font-weight:600;letter-spacing:-.005em;">
        ${copy.heading}
      </h1>
      ${paras}
      ${button}
      <p style="margin:24px 0 0;padding-top:20px;border-top:1px solid #E8E0D0;
         font-size:12.5px;line-height:1.6;color:#8A9490;">${copy.footer}</p>
    </div>
  </div>`;
}


/* ── THE WELCOME ────────────────────────────────────────────────────────────
 *
 * MISSING UNTIL 2026-08-26, and its absence was the most one-sided thing in the
 * whole billing system: four emails when a payment fails, one before a trial
 * charges, and nothing at all at the single moment somebody decides to trust us
 * with money. The first message a new subscriber received from Declare was a
 * dunning notice, or nothing.
 *
 * THREE KINDS, because three genuinely different things just happened and the
 * facts a reader needs differ:
 *
 *   trial     nothing has been charged yet, and the date one WILL be is the
 *             thing they most need in writing. This is the promise /pricing
 *             makes, arriving where they can find it later.
 *   paid      a card has been charged and it renews. Where to manage it, and
 *             that cancelling is one screen, not an email to support.
 *   lifetime  nothing renews and no card is kept. Saying so is the point:
 *             the reassurance IS the absence of a next charge.
 *
 * These are not a newsletter and the footer says so, exactly as the dunning
 * footer does. Nobody has to opt out of being told what they bought.
 *
 * NOT A RECEIPT. Stripe emails those, itemised, and duplicating it here would
 * mean maintaining a second version of a legal document. */
/* FOUR, and `signup` is the one that is actually a welcome.
 *
 * The other three are Plus milestones: a trial began, a plan is running, a
 * founding seat was taken. `signup` is the moment somebody joins Declare at
 * all, and until 2026-08-26 nothing marked it. The only email in the codebase
 * whose first words were "Welcome to Declare & Believe" was
 * sendVerificationEmail in convex/email.ts, and auth.ts sets
 * `requireEmailVerification: false`, so it has never been sent to anybody. */
export type WelcomeKind = "signup" | "trial" | "paid" | "lifetime";

/* The sign-up welcome carries no billing footer, because there is no billing.
 * Reusing FOOTER here would tell a brand new free account that it is receiving
 * a message about its Declare Plus subscription. */
const JOIN_FOOTER: Record<EmailLang, string> = {
  en:
    "You're receiving this because you just created a Declare account. " +
    "It is the only message we send about joining.",
  es:
    "Recibes esto porque acabas de crear una cuenta en Declare. " +
    "Es el único mensaje que enviamos por unirte.",
};

export function welcomeCopy(
  kind: WelcomeKind,
  facts: { amount: string | null; chargesOn: string | null; renewsOn: string | null },
  lang: EmailLang = "en",
): Copy {
  if (lang === "es") {
    if (kind === "signup") {
      return {
        subject: "Bienvenido a Declare",
        heading: "Nos alegra que estés aquí",
        body: [
          "Declare existe para una cosa: poner la Palabra de Dios donde más la necesitas, en el momento en que la necesitas.",
          "Cuando algo te esté pesando, escríbelo tal como es. Recibes la Escritura que habla a eso, con declaraciones para decir en voz alta y una oración para orar. Sin filtrar. Sin arreglar la manera de decirlo primero.",
          "Tienes 3 respuestas de Guía Suave al día y 2 Caminos a la vez, de 5 días cada uno. Todo lo que guardes queda en tu Bóveda y es tuyo.",
          "Si estás pasando por algo ahora mismo, empieza ahí. No hace falta prepararse.",
        ],
        cta: "Empezar",
        footer: JOIN_FOOTER.es,
      };
    }
    if (kind === "trial") {
      return {
        subject: "Tus 7 días de Plus empiezan ahora",
        heading: "Todo está abierto",
        body: [
          "Ya tienes Declare Plus. Guía Suave sin límite diario y todos los Caminos que necesites, al mismo tiempo. No se guarda nada.",
          facts.chargesOn
            ? `Tu prueba gratis termina el <strong>${facts.chargesOn}</strong>` +
              `${facts.amount ? `, y ese día se cobra ${facts.amount}` : ""}. Te escribimos 3 días antes, como prometimos.`
            : "Te escribimos antes de que termine tu prueba, con la fecha y el monto, como prometimos.",
          "Si decides que no es para ti, cancela desde Facturación y no se te cobra nada. Toma menos de un minuto.",
          "Y algo que no cambia con ningún plan: la Palabra es la misma para todos.",
        ],
        cta: "Ver mi plan",
        footer: FOOTER.es,
      };
    }
    if (kind === "lifetime") {
      return {
        subject: "Eres miembro fundador de Declare",
        heading: "Gracias por creer en esto",
        body: [
          "Declare Plus es tuyo. Una sola vez, sin renovación, y no guardamos tu tarjeta.",
          "Guía Suave sin límite diario, todos los Caminos que necesites al mismo tiempo, y todo lo que Plus reciba en el futuro, incluido.",
          "No hay nada que administrar y nada que cancelar. Si alguna vez necesitas algo, responde a este correo.",
          "Ayudaste a construir esto en su primera ronda. Gracias.",
        ],
        cta: "Empezar",
        footer: FOOTER.es,
      };
    }
    return {
      subject: "Bienvenido a Declare Plus",
      heading: "Bienvenido a Plus",
      body: [
        "Ya está activo. Guía Suave sin límite diario y todos los Caminos que necesites, al mismo tiempo.",
        facts.renewsOn
          ? `Tu plan se renueva el <strong>${facts.renewsOn}</strong>${facts.amount ? ` por ${facts.amount}` : ""}.`
          : "Tu plan se renueva automáticamente.",
        "Puedes ver o cancelar tu plan cuando quieras desde Facturación. No hace falta escribirnos ni esperar respuesta.",
        "Y algo que no cambia con ningún plan: la Palabra es la misma para todos.",
      ],
      cta: "Ver mi plan",
      footer: FOOTER.es,
    };
  }

  if (kind === "signup") {
    return {
      subject: "Welcome to Declare",
      heading: "We are glad you are here",
      body: [
        "Declare exists for one thing: to put God's Word where you need it most, at the moment you need it.",
        "When something is weighing on you, write it down as it actually is. You get Scripture that speaks to that, declarations to say out loud, and a prayer to pray. Unfiltered. No tidying up the wording first.",
        "You have 3 Gentle Guidance responses a day and 2 Journeys at a time, 5 days each. Everything you save goes to your Vault and stays yours.",
        "If you are carrying something right now, start there. There is nothing to set up.",
      ],
      cta: "Get started",
      footer: JOIN_FOOTER.en,
    };
  }
  if (kind === "trial") {
    return {
      subject: "Your 7 days of Plus start now",
      heading: "Everything is open",
      body: [
        "You have Declare Plus. Gentle Guidance with no daily limit, and as many Journeys as you need at the same time. Nothing is held back.",
        facts.chargesOn
          ? `Your free trial ends on <strong>${facts.chargesOn}</strong>` +
            `${facts.amount ? `, and that is the day the card is charged ${facts.amount}` : ""}. We write to you 3 days before, as promised.`
          : "We write to you before your trial ends, with the date and the amount, as promised.",
        "If you decide it is not for you, cancel from Billing and nothing is charged. It takes under a minute.",
        "And one thing no plan changes: Scripture is the same for everyone.",
      ],
      cta: "See my plan",
      footer: FOOTER.en,
    };
  }
  if (kind === "lifetime") {
    return {
      subject: "You are a founding member of Declare",
      heading: "Thank you for believing in this",
      body: [
        "Declare Plus is yours. Bought once, nothing renews, and we keep no card on file.",
        "Gentle Guidance with no daily limit, as many Journeys as you need at the same time, and every future Plus feature included.",
        "There is nothing to manage and nothing to cancel. If you ever need anything, reply to this email.",
        "You helped build this in its first round. Thank you.",
      ],
      cta: "Get started",
      footer: FOOTER.en,
    };
  }
  return {
    subject: "Welcome to Declare Plus",
    heading: "Welcome to Plus",
    body: [
      "It is on. Gentle Guidance with no daily limit, and as many Journeys as you need at the same time.",
      facts.renewsOn
        ? `Your plan renews on <strong>${facts.renewsOn}</strong>${facts.amount ? ` for ${facts.amount}` : ""}.`
        : "Your plan renews automatically.",
      "You can see or cancel your plan any time from Billing. No email to us, no waiting for a reply.",
      "And one thing no plan changes: Scripture is the same for everyone.",
    ],
    cta: "See my plan",
    footer: FOOTER.en,
  };
}
