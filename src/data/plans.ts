/* Plan data — the single source for every sales surface.
 *
 * Limits are IMPORTED from convex/entitlementCatalog.ts, the same module the
 * server enforces. They are not retyped here. A price page that claims "3 a
 * day" while the server enforces something else is worse than no page at all,
 * and the only way to guarantee they agree is to read the same object.
 *
 * Prices and copy live here because they are sales concerns, not entitlement
 * concerns — the server has no business knowing what $8.99 is.
 *
 * Four routes (/pricing, /plus, /es/precios, /es/plus) all render from this.
 * There is no second copy of the plan table.
 */
import { definitionFor } from "../../convex/entitlementCatalog";

export type Lang = "en" | "es";

export const PRICES = {
  plusMonthly: 8.99,
  plusAnnual: 79.99,
  familyMonthly: 14.99,
  familyAnnual: 149.99,
} as const;

export const plusAnnualSaving = (PRICES.plusMonthly * 12 - PRICES.plusAnnual).toFixed(2);
export const plusAnnualPerMonth = (PRICES.plusAnnual / 12).toFixed(2);
export const familyAnnualPerMonth = (PRICES.familyAnnual / 12).toFixed(2);

// Read the enforced limits once, at build time.
const FREE = definitionFor("free").limits;
const PLUS = definitionFor("plus").limits;

export const LIMITS = {
  freeGuidanceDaily: FREE.gentleGuidanceDaily, // 3
  freeActiveJourneys: FREE.activeJourneys, // 2
  plusGuidanceDaily: PLUS.gentleGuidanceDaily, // null = no visible quota
  plusActiveJourneys: PLUS.activeJourneys, // null
};

/* Localized copy. Spanish is es-LA, informal "tú", and is marked for native
 * editorial review before launch — billing wording has to be unambiguous about
 * money.
 *
 * LANGUAGE RULE: Plus is a SUBSCRIPTION. Nothing here may call it a donation,
 * gift or contribution, imply it is tax-deductible, or describe it as support
 * without receiving a service. It buys access to a plan. */
type Copy = {
  htmlLang: string;
  pricingTitle: string;
  pricingDescription: string;
  plusTitle: string;
  plusDescription: string;
  navPlans: string;
  back: string;
  planLabel: string;
  h1: string;
  sub: string;
  monthly: string;
  annual: string;
  cycleAria: string;
  perMonth: string;
  perMonthShort: string;
  freeName: string;
  freeNote: string;
  freeFeatures: string[];
  freeCta: string;
  plusName: string;
  plusSave: string;
  plusMonthlyNote: string;
  plusChain: string;
  plusFeatures: string[];
  plusCta: string;
  plusFine: string;
  comingLabel: string;
  comingBody: string;
  moreLabel: string;
  familyName: string;
  familyDesc: string;
  comingSoon: string;
  churchName: string;
  churchDesc: string;
  churchCta: string;
  foot: string;
  termsLink: string;
  // /plus deep-dive
  plusH1: string;
  plusLede: string;
  plusWhatTitle: string;
  plusWhat: { title: string; body: string }[];
  plusBillingTitle: string;
  plusBilling: string[];
  plusSeePlans: string;
};

const EN: Copy = {
  htmlLang: "en",
  pricingTitle: "Plans and pricing — Declare & Believe",
  pricingDescription:
    "Declare is free to use. Plus is an optional subscription that removes the daily limits. Monthly or annual, cancel any time.",
  plusTitle: "Declare Plus — subscription details",
  plusDescription:
    "What Declare Plus includes, what it costs, and how billing, renewal and cancellation work.",
  navPlans: "Plans",
  back: "Back",
  planLabel: "Plans",
  h1: "Declare stays free",
  sub: "The Word, your declarations, your Journey and your Vault cost nothing and always will. Plus is an optional subscription that lifts the daily limits.",
  monthly: "Monthly",
  annual: "Annual",
  cycleAria: "Billing interval",
  perMonth: "/ month",
  perMonthShort: "/mo",
  freeName: "Free",
  freeNote: "No card. No trial that quietly ends.",
  freeFeatures: [
    "Unlimited Scripture, declarations and prayer",
    `${FREE.activeJourneys} active Journeys at a time`,
    `${FREE.gentleGuidanceDaily} Gentle Guidance responses a day`,
    "Unlimited saved verses, collections and verse images",
  ],
  freeCta: "Create a free account",
  plusName: "Plus",
  plusSave: `$${PRICES.plusAnnual} billed yearly — you keep $${plusAnnualSaving}`,
  plusMonthlyNote: "Billed monthly. Cancel any time.",
  plusChain: "Everything in Free, plus:",
  plusFeatures: ["Unlimited Gentle Guidance", "Unlimited active Journeys"],
  plusCta: "Opening soon",
  plusFine: "Plus is not open yet. Nothing here charges you.",
  comingLabel: "Coming to Plus",
  comingBody:
    "We are building Scripture memory, a weekly reflection, a Journey timeline and exports. They are not part of Plus today, and we will not charge for them before they exist.",
  moreLabel: "For families and churches",
  familyName: "Family",
  familyDesc: "Plus for everyone under one roof.",
  comingSoon: "Coming soon",
  churchName: "Church and groups",
  churchDesc: "For congregations walking through this together.",
  churchCta: "Contact us",
  foot: "Paying changes what the app allows, not what God gives. Everything essential stays free.",
  termsLink: "Subscription terms",
  plusH1: "Declare Plus",
  plusLede:
    "An optional subscription for people who want more room. Free keeps everything essential; Plus removes the daily limits.",
  plusWhatTitle: "What a Plus subscription includes",
  plusWhat: [
    {
      title: "Unlimited Gentle Guidance",
      body: `Free includes ${FREE.gentleGuidanceDaily} responses a day. Plus removes that daily limit.`,
    },
    {
      title: "Unlimited active Journeys",
      body: `Free lets you keep ${FREE.activeJourneys} Journeys open at once. Plus lets you keep as many as you want.`,
    },
  ],
  plusBillingTitle: "Billing, renewal and cancellation",
  plusBilling: [
    `Plus is $${PRICES.plusMonthly} per month, or $${PRICES.plusAnnual} per year (about $${plusAnnualPerMonth} a month).`,
    "Your plan renews automatically at the end of each billing interval until you cancel.",
    "You can cancel at any time from your account. Access continues to the end of the interval you have already paid for.",
    "Cancelling never deletes anything you have saved. Your verses, Journeys, reflections and collections stay exactly where they are.",
    "A subscription is a payment for access to a plan. It is not a donation, and it is not tax-deductible.",
  ],
  plusSeePlans: "See all plans",
};

const ES: Copy = {
  htmlLang: "es",
  pricingTitle: "Planes y precios — Declare & Believe",
  pricingDescription:
    "Declare es gratis. Plus es una suscripción opcional que quita los límites diarios. Mensual o anual, cancela cuando quieras.",
  plusTitle: "Declare Plus — detalles de la suscripción",
  plusDescription:
    "Qué incluye Declare Plus, cuánto cuesta y cómo funcionan el cobro, la renovación y la cancelación.",
  navPlans: "Planes",
  back: "Atrás",
  planLabel: "Planes",
  h1: "Declare sigue siendo gratis",
  sub: "La Palabra, tus declaraciones, tu Camino y tu Bóveda no cuestan nada y nunca costarán. Plus es una suscripción opcional que quita los límites diarios.",
  monthly: "Mensual",
  annual: "Anual",
  cycleAria: "Intervalo de cobro",
  perMonth: "/ mes",
  perMonthShort: "/mes",
  freeName: "Gratis",
  freeNote: "Sin tarjeta. Sin una prueba que termina en silencio.",
  freeFeatures: [
    "Escritura, declaraciones y oración sin límite",
    `${FREE.activeJourneys} Caminos activos a la vez`,
    `${FREE.gentleGuidanceDaily} respuestas de Guía Suave al día`,
    "Versículos, colecciones e imágenes guardadas sin límite",
  ],
  freeCta: "Crea una cuenta gratis",
  plusName: "Plus",
  plusSave: `$${PRICES.plusAnnual} cobrados al año — te quedas con $${plusAnnualSaving}`,
  plusMonthlyNote: "Cobro mensual. Cancela cuando quieras.",
  plusChain: "Todo lo de Gratis, más:",
  plusFeatures: ["Guía Suave sin límite", "Caminos activos sin límite"],
  plusCta: "Disponible pronto",
  plusFine: "Plus aún no está abierto. Nada aquí te cobra.",
  comingLabel: "Próximamente en Plus",
  comingBody:
    "Estamos construyendo memorización de Escritura, una reflexión semanal, una línea de tiempo del Camino y exportaciones. Hoy no son parte de Plus, y no cobraremos por ellas antes de que existan.",
  moreLabel: "Para familias e iglesias",
  familyName: "Familia",
  familyDesc: "Plus para todos bajo un mismo techo.",
  comingSoon: "Próximamente",
  churchName: "Iglesias y grupos",
  churchDesc: "Para congregaciones que caminan juntas en esto.",
  churchCta: "Escríbenos",
  foot: "Pagar cambia lo que la app permite, no lo que Dios da. Todo lo esencial sigue siendo gratis.",
  termsLink: "Términos de suscripción",
  plusH1: "Declare Plus",
  plusLede:
    "Una suscripción opcional para quienes quieren más espacio. Gratis conserva todo lo esencial; Plus quita los límites diarios.",
  plusWhatTitle: "Qué incluye una suscripción Plus",
  plusWhat: [
    {
      title: "Guía Suave sin límite",
      body: `Gratis incluye ${FREE.gentleGuidanceDaily} respuestas al día. Plus quita ese límite diario.`,
    },
    {
      title: "Caminos activos sin límite",
      body: `Gratis te permite tener ${FREE.activeJourneys} Caminos abiertos a la vez. Plus te permite tener los que quieras.`,
    },
  ],
  plusBillingTitle: "Cobro, renovación y cancelación",
  plusBilling: [
    `Plus cuesta $${PRICES.plusMonthly} al mes, o $${PRICES.plusAnnual} al año (unos $${plusAnnualPerMonth} al mes).`,
    "Tu plan se renueva automáticamente al final de cada intervalo de cobro hasta que lo canceles.",
    "Puedes cancelar cuando quieras desde tu cuenta. El acceso continúa hasta el final del intervalo que ya pagaste.",
    "Cancelar nunca borra nada de lo que guardaste. Tus versículos, Caminos, reflexiones y colecciones se quedan exactamente donde están.",
    "Una suscripción es un pago por acceso a un plan. No es una donación y no es deducible de impuestos.",
  ],
  plusSeePlans: "Ver todos los planes",
};

export const COPY: Record<Lang, Copy> = { en: EN, es: ES };

/* Canonical route map. One place that knows which URL is which language, so
 * hreflang, canonical and internal links cannot disagree. */
export const ROUTES = {
  pricing: { en: "/pricing", es: "/es/precios" },
  plus: { en: "/plus", es: "/es/plus" },
} as const;

export const SITE = "https://declareandbelieve.com";
