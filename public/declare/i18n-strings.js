/* Spanish string dictionary for the interactive Declare app (runtime i18n).
   English is the source, kept inline in each page's HTML (data-i18n marks it);
   only Spanish overrides live here. Keys are namespaced by surface.
   Voice: es-LA, informal "tú". Load this BEFORE /declare/i18n.js. */
window.__I18N_STRINGS = {
  es: {
    /* ---- shared nav / chrome ---- */
    'nav.menu': 'Menú',
    'nav.menuOpen': 'Abrir menú',
    'nav.menuClose': 'Cerrar menú',
    'nav.close': 'Cerrar',
    'nav.signin': 'Iniciar sesión',
    'nav.begin': 'Comienza',
    'nav.how': 'Cómo funciona',
    'nav.why': 'Por qué Declare',
    'nav.struggles': 'Luchas',
    'nav.word': 'La Palabra',
    'nav.journey': 'Camino',
    'nav.vault': 'Bóveda',
    'nav.you': 'Tú',
    'nav.declare': 'Declara',
    'nav.give': 'Da tu diezmo',
    'nav.about': 'Acerca de',
    'nav.crisis': 'Encuentra ayuda',
    'nav.receiveWord': 'Recibe la Palabra',
    'nav.langToggle': 'English',

    /* ---- bottom tab bar (short) ---- */
    'tab.word': 'Palabra',
    'tab.journey': 'Camino',
    'tab.declare': 'Declara',
    'tab.vault': 'Bóveda',

    /* ---- home (/) ---- */
    'home.kicker': 'Escritura, para el peso que cargas',
    'home.sub': 'Nombra lo que pesa. Recibe Su Palabra para este momento.',
    'home.begin': 'Comienza',
    'home.menuFootCrisis': 'Encuentra ayuda',
    'home.menuFootWord': 'Recibe la Palabra',

    /* ---- struggle chips (visible chip LABELS only; data-struggle stays English) ---- */
    'chip.fearAnxiety': 'Miedo y ansiedad',
    'chip.shameGuilt': 'Vergüenza y culpa',
    'chip.loneliness': 'Soledad',
    'chip.angerBitterness': 'Ira y amargura',
    'chip.doubt': 'Duda',
    'chip.griefLoss': 'Duelo y pérdida',

    /* ---- /today ---- */
    'today.heading': '¿Qué pesa en tu corazón?',
    'today.sub': 'Nómbralo, y recibe Su Palabra para este momento.',
    'today.placeholder': 'O escribe lo que hay en tu corazón…',
    'today.writeAria': 'Escribe lo que hay en tu corazón',
    'today.receiveAria': 'Recibe la Palabra',
    'today.orChoose': 'o elige lo que encaja',
    'today.more': 'Más +',
    'today.receiveBtn': 'Recibe la Palabra',
    'today.crisisLink': '¿En crisis? Encuentra ayuda',
    'today.back': 'Atrás',
    'today.intro': 'Camina por esto despacio.',
    'today.lblScripture': 'Escritura',
    'today.lblMindset': 'Mentalidad',
    'today.lblSpeak': 'Decláralo en voz alta',
    'today.lblPrayer': 'Oración',
    'today.readMore': 'Leer más',
    'today.readLess': 'Leer menos',
    'today.amen': 'Amén.',
    'today.saveWord': 'Guarda esta palabra',
    'today.saved': 'Guardado',
    'today.share': 'Compartir',
    'today.sjTag': 'Sé trasplantado',
    'today.sjH': 'No solo lo declares hoy',
    'today.sjP1': 'Arráigate en ella. Empieza un camino de 5 días y deja que esta verdad se haga real donde ',
    'today.sjP2': ' ha estado, una declaración a la vez.',
    'today.startJourney': 'Empieza un Camino de 5 días',
    'today.carry': 'Llévalo contigo',
    'today.nsReadT': 'Lee el pasaje completo',
    'today.nsReadD': 'Ábrelo en La Palabra y sigue leyendo',
    'today.nsReturnT': 'Vuelve a ello después',
    'today.nsReturnD': 'Todo lo que guardaste vive en tu Bóveda',
    'today.nsAnotherT': 'Recibe otra palabra',
    'today.nsAnotherD': 'Para lo que sea que esté pesando',
    'today.errTitle': 'Algo interrumpió esto',
    'today.errDesc': 'La Palabra sigue aquí. Intentemos de nuevo.',
    'today.tryAgain': 'Intenta de nuevo',
    'today.goBack': 'Regresar',
    'today.forPrefix': 'Para ',
    'today.savedShort': 'Guardado',
    'today.savedVault': 'Guardado en tu Bóveda.',
    'today.removedVault': 'Quitado de tu Bóveda.',
    'today.saveSignin': 'Crea una cuenta gratis para guardar esta palabra en tu Bóveda.'
  }
};

/* English struggle key -> Spanish display label (lowercase, for "Para ..." / sjStruggle).
   The canonical data-struggle key stays English; this is display only. */
window.__I18N_STRUGGLES_ES = {
  'Fear & Anxiety': 'miedo y ansiedad',
  'Shame & Guilt': 'vergüenza y culpa',
  'Loneliness': 'soledad',
  'Anger & Bitterness': 'ira y amargura',
  'Doubt': 'duda',
  'Grief & Loss': 'duelo y pérdida',
  'Depression': 'depresión',
  'Feeling Like a Failure': 'sentirte un fracaso',
  'Purpose & Direction': 'propósito y dirección',
  'Marriage': 'tu matrimonio',
  'Financial Pressure': 'presión financiera',
  'Unforgiveness': 'la falta de perdón',
  'Stress & Burnout': 'estrés y agotamiento',
  'Overthinking': 'pensar de más',
  'Church Hurt': 'heridas de la iglesia'
};

