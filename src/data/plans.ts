/* Plan data — the single source for every sales surface.
 *
 * Limits are IMPORTED from convex/entitlementCatalog.ts, the same module the
 * server enforces. They are not retyped here. A price page that claims "3 a
 * day" while the server enforces something else is worse than no page at all,
 * and the only way to guarantee they agree is to read the same object.
 *
 * PRICES are IMPORTED from ./pricing.ts, which owns every storefront amount in
 * integer cents and derives savings arithmetically. They are not retyped here
 * either. This module is the COPY layer: it decides what words wrap the
 * numbers, never what the numbers are.
 *
 * Four routes (/pricing, /plus, /es/precios, /es/plus) all render from this.
 * There is no second copy of the plan table and no second copy of a price.
 */
import { definitionFor } from "../../convex/entitlementCatalog";
import { webPlanSummary, STOREFRONT_DISCLOSURE } from "./pricing";

export type Lang = "en" | "es";

// Precomputed, locale-formatted web amounts. Nothing below hardcodes a figure.
const EN$ = webPlanSummary("en");
const ES$ = webPlanSummary("es");

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
  // Founding-pricing presentation. `futureStandardLabel` must state what the
  // figure IS (a future standard price), never imply a past discount.
  foundingLabel: string;
  futureStandardLabel: string;
  bestValue: string;
  perYear: string;
  futureStandardLabelAnnual: string;
  perMonthBilledAnnually: string;
  saveVsMonthly: string;
  saveApprox: string;
  storefrontNote: string;
  familyPlanned: string;
  // Approved final pricing copy (hero, cards, compare table, FAQ, commitment).
  heroKicker: string;
  freeHeading: string;
  freeSub: string;
  freeIncludedLabel: string;
  freeNote2: string;
  plusHeading: string;
  plusMonthlyLabel: string;
  plusAnnualLabel: string;
  plusPerMonthLine: string;
  plusChain2: string;
  plusNote2: string;
  familyHeading: string;
  familyPlannedLabel: string;
  familyIntro: string;
  familyPlannedLabel2: string;
  familyFeatures: string[];
  churchHeading: string;
  churchPriceLabel: string;
  churchIntro: string;
  compareTitle: string;
  compareLede: string;
  compareCols: { experience: string; free: string; plus: string };
  compareRows: { label: string; free: string; plus: string }[];
  noTrialTitle: string;
  noTrialLede: string;
  noTrialBody: string;
  faqTitle: string;
  faq: { q: string; a: string[] }[];
  commitTitle: string;
  commitBody: string[];
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
  h1: "Start free. Go deeper when you\u2019re ready.",
  sub: "The core Declare & Believe experience is free for as long as you need it. Plus gives you unlimited Gentle Guidance and room for every Journey you are walking through.",
  monthly: "Monthly",
  annual: "Annual",
  cycleAria: "Billing interval",
  perMonth: "/ month",
  perMonthShort: "/mo",
  freeName: "Free",
  freeNote: "No card. No trial that quietly ends.",
  freeFeatures: [
    "Core Scripture and Declare experience",
    "Save Scripture and supported content",
    "Vault and completed Journey history",
    `Up to ${FREE.activeJourneys} active Journeys`,
    `${FREE.gentleGuidanceDaily} Gentle Guidance responses each day`,
    "Crisis and support resources always available",
  ],
  freeCta: "Continue Free",
  plusName: "Plus",
  plusSave: `${EN$.plus.annual} billed yearly — you keep ${EN$.plus.savings}`,
  foundingLabel: "Founding pricing planned for launch",
  futureStandardLabel: `Future standard price: ${EN$.plus.futureStandardMonthly}`,
  bestValue: "Best value",
  perYear: "/ year",
  futureStandardLabelAnnual: `Future standard price: ${EN$.plus.futureStandardAnnual}`,
  perMonthBilledAnnually: `${EN$.plus.monthlyEquivalent} per month, billed annually`,
  saveVsMonthly: `Save ${EN$.plus.savings} compared with monthly`,
  saveApprox: `Save about ${EN$.plus.savingsPercent}%`,
  storefrontNote: STOREFRONT_DISCLOSURE.en,
  familyPlanned: `Planned: ${EN$.family.monthly} monthly or ${EN$.family.annual} annually`,
  heroKicker: "Renew your mind with Scripture, guided reflection, and daily Journeys.",
  freeHeading: "Begin with Scripture",
  freeSub: "A meaningful place to begin, with no trial and no expiration.",
  freeIncludedLabel: "Included with Free",
  freeNote2: "No payment method required.",
  plusHeading: "Keep going without limits",
  plusMonthlyLabel: "Monthly",
  plusAnnualLabel: "Annual",
  plusPerMonthLine: `${EN$.plus.monthlyEquivalent} per month, billed annually`,
  plusChain2: "Everything in Free, plus",
  plusNote2: "Cancel anytime after subscriptions become available.",
  familyHeading: "Grow together, privately",
  familyPlannedLabel: "Planned founding pricing:",
  familyIntro: "Designed for families who want individual privacy with optional ways to grow together.",
  familyPlannedLabel2: "Planned for Family",
  familyFeatures: [
    "Up to 5 individual accounts",
    "A private Vault for each person",
    "Optional shared prayer circles and collections",
    "Shared family Journeys and devotions",
    "Sharing that is always opt-in",
  ],
  churchHeading: "Support spiritual formation together",
  churchPriceLabel: "Custom pricing",
  churchIntro: "Tools for churches, ministries, small groups, and spiritual-formation leaders are planned.",
  compareTitle: "Compare plans",
  compareLede: "Free is meaningful. Plus expands your capacity.",
  compareCols: { experience: "Experience", free: "Free", plus: "Plus" },
  compareRows: [
    { label: "Scripture and Declare", free: "Included", plus: "Included" },
    { label: "Save supported content", free: "Included", plus: "Included" },
    { label: "Vault access", free: "Included", plus: "Included" },
    { label: "Completed Journey history", free: "Included", plus: "Included" },
    { label: "Active Journeys", free: `Up to ${FREE.activeJourneys}`, plus: "Unlimited" },
    { label: "Gentle Guidance", free: `${FREE.gentleGuidanceDaily} per day`, plus: "Unlimited" },
    { label: "Crisis and support resources", free: "Always available", plus: "Always available" },
  ],
  noTrialTitle: "No trial countdown",
  noTrialLede: "Free does not expire",
  noTrialBody:
    "Declare & Believe does not require a trial to begin. Use the core experience for as long as it serves you. Plus is available when you want unlimited guidance and more room for your ongoing Journeys.",
  faqTitle: "Frequently asked questions",
  faq: [
    { q: "Is Free a trial?", a: ["No. The Free plan does not expire, and no payment method is required."] },
    { q: "What happens when I reach my daily Gentle Guidance limit?",
      a: ["Your saved reflection remains available, and you can continue using Scripture, Declare, your Vault, and your Journeys.",
          `Your ${FREE.gentleGuidanceDaily} Free Gentle Guidance responses reset the next account day. Plus provides unlimited Gentle Guidance at the product level.`] },
    { q: `What happens when I already have ${FREE.activeJourneys} active Journeys?`,
      a: ["You can continue, complete, or archive either Journey.",
          "To start another Journey, complete or archive one of your active Journeys, or explore Plus for unlimited active Journeys."] },
    { q: "Will reaching a limit remove my content?",
      a: ["No. Your saved reflections, Vault items, completed Journeys, and existing active Journeys remain yours."] },
    { q: "Why is the annual plan recommended?",
      a: [`The annual Plus plan is ${EN$.plus.annual} per year, equivalent to approximately ${EN$.plus.monthlyEquivalent} per month.`,
          `That saves ${EN$.plus.savings}, or approximately ${EN$.plus.savingsPercent}%, compared with twelve monthly payments.`] },
    { q: "Will app-store pricing be different?",
      a: ["Prices may vary when purchased through an app store. The app will display the price provided by the applicable storefront."] },
    { q: "Will I need to subscribe twice to use the web and mobile app?",
      a: ["The planned cross-platform system connects verified access to your Declare & Believe account.",
          "Once mobile purchase synchronization is available, an active subscriber should not need to purchase the same plan twice."] },
    { q: "Can I cancel at any time?",
      a: ["Once subscriptions become available, monthly and annual plans can be managed through the platform where the subscription was purchased."] },
  ],
  commitTitle: "Our commitment",
  commitBody: [
    "The core Scripture experience remains available through Free.",
    "Plus changes the capacity and features available inside Declare & Believe. It does not change your worth, God\u2019s nearness, the power of Scripture, or your access to prayer.",
  ],
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
    `Plus is ${EN$.plus.monthly} per month, or ${EN$.plus.annual} per year (about ${EN$.plus.monthlyEquivalent} a month).`,
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
  h1: "Empieza gratis. Profundiza cuando estés listo.",
  sub: "La experiencia central de Declare & Believe es gratis todo el tiempo que la necesites. Plus te da Guía Suave sin límite y espacio para cada Camino que estés recorriendo.",
  monthly: "Mensual",
  annual: "Anual",
  cycleAria: "Intervalo de cobro",
  perMonth: "/ mes",
  perMonthShort: "/mes",
  freeName: "Gratis",
  freeNote: "Sin tarjeta. Sin una prueba que termina en silencio.",
  freeFeatures: [
    "Experiencia central de la Escritura y Declare",
    "Guarda Escritura y contenido compatible",
    "Bóveda e historial de Caminos completados",
    `Hasta ${FREE.activeJourneys} Caminos activos`,
    `${FREE.gentleGuidanceDaily} respuestas de Guía Suave cada día`,
    "Recursos de crisis y apoyo siempre disponibles",
  ],
  freeCta: "Continúa gratis",
  plusName: "Plus",
  plusSave: `${ES$.plus.annual} cobrados al año — te quedas con ${ES$.plus.savings}`,
  foundingLabel: "Precio fundador previsto para el lanzamiento",
  futureStandardLabel: `Precio estándar futuro: ${ES$.plus.futureStandardMonthly}`,
  bestValue: "Mejor valor",
  perYear: "/ año",
  futureStandardLabelAnnual: `Precio estándar futuro: ${ES$.plus.futureStandardAnnual}`,
  perMonthBilledAnnually: `${ES$.plus.monthlyEquivalent} al mes, cobrado anualmente`,
  saveVsMonthly: `Ahorra ${ES$.plus.savings} frente al plan mensual`,
  saveApprox: `Ahorra alrededor del ${ES$.plus.savingsPercent}%`,
  storefrontNote: STOREFRONT_DISCLOSURE.es,
  familyPlanned: `Previsto: ${ES$.family.monthly} al mes o ${ES$.family.annual} al año`,
  heroKicker: "Renueva tu mente con la Escritura, reflexión guiada y Caminos diarios.",
  freeHeading: "Comienza con la Escritura",
  freeSub: "Un lugar significativo para comenzar, sin prueba y sin vencimiento.",
  freeIncludedLabel: "Incluido con Gratis",
  freeNote2: "No se requiere método de pago.",
  plusHeading: "Sigue adelante sin límites",
  plusMonthlyLabel: "Mensual",
  plusAnnualLabel: "Anual",
  plusPerMonthLine: `${ES$.plus.monthlyEquivalent} al mes, cobrado anualmente`,
  plusChain2: "Todo lo de Gratis, más",
  plusNote2: "Cancela cuando quieras una vez que las suscripciones estén disponibles.",
  familyHeading: "Crezcan juntos, en privado",
  familyPlannedLabel: "Precio fundador previsto:",
  familyIntro: "Diseñado para familias que quieren privacidad individual con formas opcionales de crecer juntos.",
  familyPlannedLabel2: "Previsto para Familia",
  familyFeatures: [
    "Hasta 5 cuentas individuales",
    "Una Bóveda privada para cada persona",
    "Círculos de oración y colecciones compartidos, opcionales",
    "Caminos y devocionales familiares compartidos",
    "Compartir siempre es opcional",
  ],
  churchHeading: "Apoyen juntos la formación espiritual",
  churchPriceLabel: "Precio personalizado",
  churchIntro: "Estamos planeando herramientas para iglesias, ministerios, grupos pequeños y líderes de formación espiritual.",
  compareTitle: "Compara los planes",
  compareLede: "Gratis es significativo. Plus amplía tu capacidad.",
  compareCols: { experience: "Experiencia", free: "Gratis", plus: "Plus" },
  compareRows: [
    { label: "Escritura y Declare", free: "Incluido", plus: "Incluido" },
    { label: "Guardar contenido compatible", free: "Incluido", plus: "Incluido" },
    { label: "Acceso a la Bóveda", free: "Incluido", plus: "Incluido" },
    { label: "Historial de Caminos completados", free: "Incluido", plus: "Incluido" },
    { label: "Caminos activos", free: `Hasta ${FREE.activeJourneys}`, plus: "Sin límite" },
    { label: "Guía Suave", free: `${FREE.gentleGuidanceDaily} al día`, plus: "Sin límite" },
    { label: "Recursos de crisis y apoyo", free: "Siempre disponibles", plus: "Siempre disponibles" },
  ],
  noTrialTitle: "Sin cuenta regresiva de prueba",
  noTrialLede: "Gratis no vence",
  noTrialBody:
    "Declare & Believe no requiere una prueba para comenzar. Usa la experiencia central todo el tiempo que te sirva. Plus está disponible cuando quieras guía sin límite y más espacio para tus Caminos en curso.",
  faqTitle: "Preguntas frecuentes",
  faq: [
    { q: "¿Gratis es una prueba?", a: ["No. El plan Gratis no vence y no se requiere método de pago."] },
    { q: "¿Qué pasa cuando alcanzo mi límite diario de Guía Suave?",
      a: ["Tu reflexión guardada sigue disponible, y puedes seguir usando la Escritura, Declare, tu Bóveda y tus Caminos.",
          `Tus ${FREE.gentleGuidanceDaily} respuestas gratuitas de Guía Suave se reinician al siguiente día de tu cuenta. Plus ofrece Guía Suave sin límite a nivel de producto.`] },
    { q: `¿Qué pasa cuando ya tengo ${FREE.activeJourneys} Caminos activos?`,
      a: ["Puedes continuar, completar o archivar cualquiera de los dos Caminos.",
          "Para empezar otro Camino, completa o archiva uno de tus Caminos activos, o explora Plus para tener Caminos activos sin límite."] },
    { q: "¿Alcanzar un límite elimina mi contenido?",
      a: ["No. Tus reflexiones guardadas, los elementos de tu Bóveda, tus Caminos completados y tus Caminos activos siguen siendo tuyos."] },
    { q: "¿Por qué se recomienda el plan anual?",
      a: [`El plan anual de Plus cuesta ${ES$.plus.annual} al año, equivalente a aproximadamente ${ES$.plus.monthlyEquivalent} al mes.`,
          `Eso ahorra ${ES$.plus.savings}, o aproximadamente un ${ES$.plus.savingsPercent}%, en comparación con doce pagos mensuales.`] },
    { q: "¿El precio será diferente en las tiendas de aplicaciones?",
      a: ["Los precios pueden variar si compras a través de una tienda de aplicaciones. La app mostrará el precio que proporcione la tienda correspondiente."] },
    { q: "¿Tendré que suscribirme dos veces para usar la web y la app móvil?",
      a: ["El sistema multiplataforma previsto conecta el acceso verificado con tu cuenta de Declare & Believe.",
          "Una vez que la sincronización de compras móviles esté disponible, quien ya esté suscrito no debería tener que comprar el mismo plan dos veces."] },
    { q: "¿Puedo cancelar en cualquier momento?",
      a: ["Una vez que las suscripciones estén disponibles, los planes mensuales y anuales se administran desde la plataforma donde se compró la suscripción."] },
  ],
  commitTitle: "Nuestro compromiso",
  commitBody: [
    "La experiencia central de la Escritura sigue disponible en Gratis.",
    "Plus cambia la capacidad y las funciones disponibles dentro de Declare & Believe. No cambia tu valor, la cercanía de Dios, el poder de la Escritura ni tu acceso a la oración.",
  ],
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
    `Plus cuesta ${ES$.plus.monthly} al mes, o ${ES$.plus.annual} al año (unos ${ES$.plus.monthlyEquivalent} al mes).`,
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

/* Precomputed, locale-formatted web amounts for the sales components. Exported
   so a page never formats or divides a price itself. */
export const AMOUNTS = { en: EN$, es: ES$ } as const;
