import type { Messages } from './en';

export const es: Messages = {
  appTitle: 'Trophy Tracker',
  notAffiliated: 'Sin afiliación con Valve ni con Steam.',

  crash: {
    title: 'Algo ha salido mal',
    description:
      'No se ha podido mostrar esta pantalla. Recargar suele solucionarlo; los detalles se han guardado en el registro de errores.',
    reload: 'Recargar',
  },

  errors: {
    invalidKey: 'Steam ha rechazado la clave de la Web API.',
    private: 'Los detalles de juego de tu perfil no son públicos.',
    noStats: 'Este juego no tiene logros.',
    notFound: 'No se ha encontrado ningún perfil de Steam con ese SteamID.',
    network: 'No se ha podido conectar con Steam. Revisa tu conexión.',
    notConfigured: 'La aplicación aún no está configurada.',
    rateLimited: 'Steam está limitando esta clave por ahora. Se reanuda sola.',
    steamStatus: (status) => `Steam ha respondido con el error ${status}.`,
    unexpected: 'Error inesperado. Inténtalo de nuevo.',
    changeNotSaved:
      'No se ha podido guardar el cambio, así que se ha deshecho.',
  },

  validation: {
    steamIdFormat:
      'Un SteamID es un número de 17 dígitos que empieza por 7656.',
    apiKeyFormat:
      'Una clave de la Web API tiene 32 caracteres (letras de la A a la F y dígitos).',
    languageRequired: 'Elige un idioma.',
    verificationRequired: 'Verifica la cuenta antes de continuar.',
  },

  check: {
    privacyBlocked:
      'Steam no ha permitido leer tus juegos. Pon «Detalles de los juegos» en Público en tus ajustes de privacidad.',
  },

  guides: {
    query: 'cómo conseguir',
    steam: 'Guías',
    steamTitle: 'Buscar en las guías de la comunidad de Steam',
    searchOn: (site) => `Buscar en ${site}`,
  },

  nav: {
    game: 'Juego',
    dashboard: 'Panel',
    settings: 'Ajustes',
    label: 'Principal',
    pinWindow: 'Mantener la ventana siempre visible',
    unpinWindow: 'Dejar de mantener la ventana siempre visible',
    updateAvailable: (version) => `Versión ${version} disponible`,
  },

  common: {
    cancel: 'Cancelar',
    undo: 'Deshacer',
    close: 'Cerrar',
    dismiss: 'Descartar',
    retry: 'Reintentar',
    refresh: 'Actualizar',
    back: 'Atrás',
    next: 'Siguiente',
    clearSearch: 'Borrar la búsqueda',
    openInBrowser: 'Abrir en el navegador',
    sortBy: 'Ordenar por',
  },

  game: {
    none: 'No hay ningún juego abierto y aún no se ha jugado a nada. Elige uno en el Panel.',
    running: 'en ejecución',
    summary: (unlocked, total, percent) =>
      `${unlocked} de ${total} logros · ${percent}%`,
    left: (n) => (n === 1 ? 'falta 1' : `faltan ${n}`),
    allUnlocked: 'todos desbloqueados',
    justUnlocked: (names) => `Logro desbloqueado: ${names}`,
    noAchievements: 'Este juego no tiene logros.',
    pending: (n) => `Pendientes ${n}`,
    unlocked: (n) => `Desbloqueados ${n}`,
    search: 'Buscar logros por nombre o descripción',
    hiddenOnly: (n) => `Ocultos ${n}`,
    hiddenOnlyTitle: 'Mostrar solo los logros ocultos',
    sort: {
      common: 'Más comunes primero',
      rare: 'Más raros primero',
      closest: 'Más cerca de completarse',
      recent: 'Más recientes primero',
      oldest: 'Más antiguos primero',
      name: 'Nombre',
    },
    nothingFound: (query) => `No se ha encontrado nada para «${query}».`,
    inOtherList: {
      pending: (n) =>
        `${n} ${n === 1 ? 'resultado' : 'resultados'} en Pendientes`,
      unlocked: (n) =>
        `${n} ${n === 1 ? 'resultado' : 'resultados'} en Desbloqueados`,
    },
    filterLabel: 'Logros mostrados',
    justCompleted: '¡Todos los logros desbloqueados!',
    details: {
      toggle: 'Detalles',
      progress: 'Tu progreso',
      left: 'Lo que falta',
      playtime: 'Tiempo de juego',
      lastPlayed: 'Última partida',
      lastUnlocked: 'Último logro',
      easiest: 'El más fácil',
      rarest: 'El más raro',
      closest: 'El más cerca de completarse',
      never: 'Todavía no',
    },
    complete: {
      title: 'Todos los logros desbloqueados',
      completedOn: (date) => `Completado el ${date}`,
      rarest: (name, percent) =>
        `El más raro: ${name} · ${percent} de los jugadores`,
      seeUnlocked: 'Ver lo que has desbloqueado',
    },
    nothingUnlocked: 'Aún no hay logros desbloqueados.',
  },

  card: {
    hidden: 'oculto',
    rarityTitle: 'Jugadores que tienen este logro',
    noDescription: 'Sin descripción.',
    steamCounter: 'Contador de Steam',
    checklistCounter: 'Elementos marcados en tu lista',
    unlockedOn: (date) => `Desbloqueado el ${date}`,
    list: 'Lista',
    listTitle: 'Lista de lo que falta',
    note: 'Añadir una nota',
    notePlaceholder: 'Tu nota o el enlace de una guía',
    pin: 'Fijar arriba',
    unpin: 'Dejar de fijar',
  },

  checklist: {
    rename: 'Cambiar el nombre',
    removed: (text) => `Se ha quitado «${text}»`,
    remove: 'Quitar elemento',
    newItem: 'Nuevo elemento',
    add: 'Añadir elemento',
    paste: 'Pegar lista',
    duplicate: 'Ese elemento ya está en la lista.',
    pasteDescription: (achievement) =>
      `Pega los elementos de una guía para «${achievement}», uno por línea. Las viñetas y la numeración se eliminan.`,
    pastePlaceholder: 'Elemento 1\nElemento 2\nElemento 3',
    addButton: 'Añadir',
    addCount: (n) => `Añadir ${n} ${n === 1 ? 'elemento' : 'elementos'}`,
  },

  dashboard: {
    title: 'Panel',
    filterLabel: 'Juegos mostrados',
    refreshAll: 'Actualizar todo',
    reading: (done, total) => `Leyendo logros: ${done} de ${total} juegos…`,
    loadingLibrary: 'Cargando tu biblioteca…',
    ongoing: (n) => `En curso ${n}`,
    complete: (n) => `Completos ${n}`,
    sort: {
      closest: 'Más cerca del 100%',
      played: 'Jugados recientemente',
      fewest: 'Menos pendientes',
      name: 'Nombre',
      completed: 'Completados recientemente',
    },
    nothingOngoing: 'No hay juegos en curso.',
    nothingComplete: 'Aún no hay juegos completos.',
    inOtherList: {
      ongoing: (n) =>
        `${n} ${n === 1 ? 'resultado' : 'resultados'} en En curso`,
      complete: (n) =>
        `${n} ${n === 1 ? 'resultado' : 'resultados'} en Completos`,
    },
    achievementCount: (n) => `${n} ${n === 1 ? 'logro' : 'logros'}`,
    search: 'Buscar juegos',
    nothingFound: (query) =>
      `No se ha encontrado ningún juego para «${query}».`,
    empty: 'No hay juegos jugados con logros.',
    left: (n) => (n === 1 ? 'falta 1' : `faltan ${n}`),
  },

  accounts: {
    use: (name: string) => `Usar ${name}`,
    verified: 'Verificada',
    inUse: 'En uso',
    addAnother: 'Añadir otra cuenta',
    removeNamed: (name: string) => `Quitar ${name}`,
    title: 'Cuentas',
    add: 'Añadir cuenta',
    status: {
      valid: 'Clave en funcionamiento',
      rejected: 'Clave rechazada por Steam',
      rateLimited: 'Steam está limitando esta clave',
      unchecked: 'Clave aún sin verificar',
    },
    keyEnding: (ending: string) => `Clave terminada en ${ending}`,
    checkedOn: (date: string) => `Verificada el ${date}`,
    showKey: 'Mostrar clave',
    hideKey: 'Ocultar clave',
    key: 'Clave de la Web API',
    replaceKey: 'Cambiar la clave',
    newKey: 'Nueva clave de la Web API',
    saveKey: 'Verificar y guardar',
    recheck: 'Verificar de nuevo',
    remove: 'Quitar cuenta',
    removeTitle: (name: string) => `¿Quitar ${name}?`,
    removeDescription: (name: string) =>
      `La clave de ${name}, lo que se leyó de Steam y sus notas, listas y logros fijados se borran de este ordenador. Nada cambia en Steam.`,
    removeConfirm: 'Quitar',
    alreadyAdded:
      'Esta cuenta ya se añadió. Para cambiar su clave, usa «Cambiar la clave» en Ajustes.',
    switched: (name: string) =>
      `Ahora se sigue a ${name}, la cuenta conectada en Steam.`,
    keyRefused: (name: string) => `Steam rechazó la clave de ${name}.`,
    keyRefusedHint:
      'Lo que ya se leyó sigue en pantalla. Cambia la clave para mantenerlo al día.',
    keyLimited: (name: string) => `Steam está limitando la clave de ${name}.`,
    keyLimitedHint:
      'La lectura se reanuda sola cuando Steam vuelva a aceptar la clave.',
  },
  settings: {
    title: 'Ajustes',
    steamId: (id) => `SteamID ${id}`,
    language: 'Idioma',
    languageHint:
      'La aplicación se recarga para aplicar el idioma, también en los nombres de los logros.',
    groups: {
      account: 'Cuenta',
      window: 'Ventana e idioma',
      data: 'Datos y privacidad',
      about: 'Acerca de',
    },
    alwaysOnTop: 'Mantener la ventana siempre visible',
    alwaysOnTopHint:
      'Queda por encima de otras ventanas, como un juego en modo ventana.',
    rememberWindow: 'Recordar el tamaño y la posición de la ventana',
    privacy:
      'Todo se queda en este ordenador. La aplicación solo se comunica con Steam y, para las actualizaciones, con GitHub.',
    dataFolder: 'Carpeta de datos',
    openFolder: 'Abrir carpeta',
    copyPath: 'Copiar ruta',
    pathCopied: 'Ruta copiada.',
    errorLog: 'Registro de errores',
    errorLogHint:
      'Está en logs/errors.log, dentro de la carpeta de datos. Nunca se envía a ningún sitio.',
    versionLabel: 'Versión',
    source: 'Código fuente',
    reportIssue: 'Informar de un problema',
    license: 'Licencia',
    version: (version) => `Versión ${version}`,
    updateAvailable: (version) => `La versión ${version} está disponible`,
    updateHint: 'Descárgala e instálala sobre esta; tus datos se conservan.',
    download: 'Descargar',
    updateDownloading: (version) => `Descargando la versión ${version}…`,
    updateReady: (version) =>
      `La versión ${version} está lista para instalarse`,
    updateReadyHint:
      'La aplicación se reinicia para completar la actualización; tus datos se conservan.',
    restart: 'Reiniciar para actualizar',
    updateBlockedHint:
      'El Control inteligente de aplicaciones de Windows está activo y bloquea los instaladores sin firma digital, que este todavía no tiene. La versión instalada sigue funcionando.',
    learnMore: 'Más información',
    checkForUpdates: 'Buscar actualizaciones',
    checkingForUpdates: 'Buscando…',
    upToDate: 'Ya tienes la última versión.',
    updateCheckFailed: 'No se ha podido comprobar. Revisa tu conexión.',
  },

  update: {
    checking: 'Buscando actualizaciones…',
    found: (version) => `Versión ${version} encontrada`,
    downloading: (percent) => `Descargando… ${percent}%`,
    restartNotice:
      'La aplicación se reinicia sola cuando termine la descarga. Tus datos se conservan.',
    readyTitle: (version) => `Se ha descargado la versión ${version}`,
    readyDescription:
      'La aplicación necesita reiniciarse para completar la actualización. Tus datos se conservan.',
    restartNow: 'Reiniciar ahora',
    later: 'Más tarde',
    available: (version) => `La versión ${version} está disponible`,
    see: 'Ver',
  },

  onboarding: {
    steps: {
      language: 'Idioma',
      account: 'Cuenta',
      done: 'Listo',
    },
    goToStep: (step) => `Ir a ${step}`,

    language: {
      title: 'Trophy Tracker',
      description:
        'Mira lo que te falta por desbloquear en el juego al que estás jugando.',
      intro:
        'Para el juego al que estás jugando, esta aplicación muestra qué logros faltan, cuáles son los ocultos, cómo van los que tienen contador y accesos directos a guías.',
      before: 'Para configurarla necesitarás:',
      items: [
        'tu SteamID, que la aplicación suele encontrar por sí sola;',
        'una clave gratuita de la Web API de Steam;',
        'los detalles de tus juegos en público en tu perfil de Steam.',
      ],
      keyStaysLocal: 'La clave se guarda solo en este ordenador.',
      label: 'Idioma',
      start: 'Empezar',
    },

    account: {
      title: 'Tu cuenta',
      description:
        'La cuenta de Steam que se va a seguir y la clave para leerla.',
      steamId: {
        label: 'SteamID',
        detected: 'Detectado en el cliente de Steam de este ordenador.',
        notDetected:
          'No he encontrado ninguna cuenta con sesión iniciada en el cliente de Steam. Pega tu SteamID de 17 dígitos.',
        change: 'Usar otra cuenta',
        helpTitle: '¿Dónde encuentro mi SteamID?',
        help: [
          'En el cliente de Steam, haz clic en tu nombre en la esquina superior derecha.',
          'Elige «Detalles de la cuenta».',
          'El número de 17 dígitos junto a «ID de Steam», justo debajo del nombre de la cuenta, es tu SteamID. No es el código de amigo ni el nombre de usuario.',
        ],
        openAccount: 'Abrir «Detalles de la cuenta» en el navegador',
      },
      key: {
        label: 'Clave de la Web API',
        placeholder: 'Pega la clave aquí',
        helpTitle: '¿Cómo consigo una clave?',
        help: [
          'Abre la página de claves de Steam.',
          'Inicia sesión con tu cuenta. En «Nombre de dominio», escribe cualquier cosa, por ejemplo localhost.',
          'Acepta los términos, haz clic en Registrar y copia la clave de 32 caracteres.',
        ],
        openPage: 'Abrir la página de claves en el navegador',
      },
      privacy: {
        help: [
          'Abre los ajustes de privacidad.',
          'Pon «Mi perfil» y «Detalles de los juegos» en Público.',
          'Vuelve y prueba de nuevo (Steam puede tardar un minuto en aplicarlo).',
        ],
        openSettings: 'Abrir los ajustes de privacidad en el navegador',
        testAgain: 'Probar de nuevo',
      },
      verify: 'Verificar',
      verifying: 'Verificando…',
    },

    done: {
      title: 'Todo listo',
      description: 'La configuración está completa.',
      found: (n) =>
        `He encontrado ${n} ${n === 1 ? 'juego jugado' : 'juegos jugados'} en tu cuenta.`,
      account: 'Cuenta',
      language: 'Idioma',
      howItWorks:
        'Abre un juego en Steam y la aplicación cambia a él por sí sola. Sin ningún juego abierto muestra el último al que jugaste; el Panel los lista todos.',
      saveFailed:
        'No se ha podido guardar la configuración. Vuelve atrás y verifica la cuenta de nuevo.',
      finish: 'Entrar en la aplicación',
      saving: 'Guardando…',
    },
  },
};
