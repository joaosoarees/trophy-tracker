import type { Messages } from './en';

export const fr: Messages = {
  appTitle: 'Trophy Tracker',
  notAffiliated: 'Non affilié à Valve ni à Steam.',

  crash: {
    title: 'Une erreur est survenue',
    description:
      'Cet écran n’a pas pu être affiché. Recharger règle généralement le problème ; les détails ont été enregistrés dans le journal des erreurs.',
    reload: 'Recharger',
  },

  errors: {
    invalidKey: 'Steam a refusé la clé de l’API Web.',
    private: 'Les détails des jeux de votre profil ne sont pas publics.',
    noStats: 'Ce jeu n’a pas de succès.',
    notFound: 'Aucun profil Steam n’a été trouvé avec ce SteamID.',
    network: 'Impossible de joindre Steam. Vérifiez votre connexion.',
    notConfigured: 'L’application n’est pas encore configurée.',
    steamStatus: (status) => `Steam a répondu avec l’erreur ${status}.`,
    unexpected: 'Erreur inattendue. Réessayez.',
    changeNotSaved:
      'La modification n’a pas pu être enregistrée ; elle a été annulée.',
  },

  validation: {
    steamIdFormat: 'Un SteamID comporte 17 chiffres et commence par 7656119.',
    apiKeyFormat:
      'Une clé de l’API Web comporte 32 caractères (lettres de A à F et chiffres).',
    languageRequired: 'Choisissez une langue.',
    verificationRequired: 'Vérifiez le compte avant de continuer.',
  },

  check: {
    privacyBlocked:
      'Steam n’a pas autorisé la lecture de vos jeux. Réglez « Détails des jeux » sur Public dans vos paramètres de confidentialité.',
  },

  guides: {
    query: 'comment obtenir',
    steam: 'Guides',
    steamTitle: 'Chercher dans les guides de la communauté Steam',
    searchOn: (site) => `Chercher sur ${site}`,
  },

  nav: {
    game: 'Jeu',
    dashboard: 'Tableau de bord',
    settings: 'Paramètres',
    label: 'Principale',
    pinWindow: 'Garder la fenêtre toujours au premier plan',
    unpinWindow: 'Ne plus garder la fenêtre au premier plan',
    updateAvailable: (version) => `Version ${version} disponible`,
  },

  common: {
    cancel: 'Annuler',
    undo: 'Annuler',
    close: 'Fermer',
    dismiss: 'Fermer l’avis',
    retry: 'Réessayer',
    refresh: 'Actualiser',
    back: 'Retour',
    next: 'Suivant',
    clearSearch: 'Effacer la recherche',
    openInBrowser: 'Ouvrir dans le navigateur',
    sortBy: 'Trier par',
  },

  game: {
    none: 'Aucun jeu n’est ouvert et rien n’a encore été joué. Choisissez-en un dans le Tableau de bord.',
    running: 'en cours',
    summary: (unlocked, total, percent) =>
      `${unlocked} succès sur ${total} · ${percent} %`,
    left: (n) => (n === 1 ? '1 restant' : `${n} restants`),
    allUnlocked: 'tous déverrouillés',
    justUnlocked: (names) => `Succès déverrouillé : ${names}`,
    noAchievements: 'Ce jeu n’a pas de succès.',
    pending: (n) => `À obtenir ${n}`,
    unlocked: (n) => `Déverrouillés ${n}`,
    search: 'Chercher des succès par nom ou description',
    hiddenOnly: (n) => `Cachés ${n}`,
    hiddenOnlyTitle: 'Afficher uniquement les succès cachés',
    sort: {
      common: 'Les plus courants d’abord',
      rare: 'Les plus rares d’abord',
      closest: 'Les plus proches du but',
      recent: 'Les plus récents d’abord',
      oldest: 'Les plus anciens d’abord',
      name: 'Nom',
    },
    nothingFound: (query) => `Aucun résultat pour « ${query} ».`,
    inOtherList: {
      pending: (n) =>
        `${n} ${n === 1 ? 'résultat' : 'résultats'} dans À obtenir`,
      unlocked: (n) =>
        `${n} ${n === 1 ? 'résultat' : 'résultats'} dans Déverrouillés`,
    },
    filterLabel: 'Succès affichés',
    justCompleted: 'Tous les succès déverrouillés !',
    details: {
      toggle: 'Détails',
      progress: 'Votre progression',
      left: 'Ce qu’il reste',
      playtime: 'Temps de jeu',
      lastPlayed: 'Dernière session',
      lastUnlocked: 'Dernier succès',
      easiest: 'Le plus facile',
      rarest: 'Le plus rare',
      closest: 'Le plus proche du but',
      never: 'Pas encore',
    },
    complete: {
      title: 'Tous les succès déverrouillés',
      completedOn: (date) => `Terminé le ${date}`,
      rarest: (name, percent) =>
        `Le plus rare : ${name} · ${percent} des joueurs`,
      seeUnlocked: 'Voir ce que vous avez déverrouillé',
    },
    nothingUnlocked: 'Aucun succès déverrouillé pour l’instant.',
  },

  card: {
    hidden: 'caché',
    rarityTitle: 'Joueurs qui ont ce succès',
    noDescription: 'Pas de description.',
    steamCounter: 'Compteur Steam',
    checklistCounter: 'Éléments cochés dans votre liste',
    unlockedOn: (date) => `Déverrouillé le ${date}`,
    list: 'Liste',
    listTitle: 'Liste de ce qui manque',
    note: 'Ajouter une note',
    notePlaceholder: 'Votre note ou le lien d’un guide',
    pin: 'Épingler en haut',
    unpin: 'Désépingler',
  },

  checklist: {
    rename: 'Renommer l’élément',
    removed: (text) => `« ${text} » retiré`,
    remove: 'Retirer l’élément',
    newItem: 'Nouvel élément',
    add: 'Ajouter un élément',
    paste: 'Coller une liste',
    duplicate: 'Cet élément est déjà dans la liste.',
    pasteDescription: (achievement) =>
      `Collez les éléments d’un guide pour « ${achievement} », un par ligne. Les puces et la numérotation sont retirées.`,
    pastePlaceholder: 'Élément 1\nÉlément 2\nÉlément 3',
    addButton: 'Ajouter',
    addCount: (n) => `Ajouter ${n} ${n === 1 ? 'élément' : 'éléments'}`,
  },

  dashboard: {
    title: 'Tableau de bord',
    filterLabel: 'Jeux affichés',
    refreshAll: 'Tout actualiser',
    reading: (done, total) => `Lecture des succès : ${done} jeux sur ${total}…`,
    loadingLibrary: 'Chargement de votre bibliothèque…',
    ongoing: (n) => `En cours ${n}`,
    complete: (n) => `Terminés ${n}`,
    sort: {
      closest: 'Les plus proches de 100 %',
      played: 'Joués récemment',
      fewest: 'Le moins de succès restants',
      name: 'Nom',
      completed: 'Terminés récemment',
    },
    nothingOngoing: 'Aucun jeu en cours.',
    nothingComplete: 'Aucun jeu terminé pour l’instant.',
    inOtherList: {
      ongoing: (n) =>
        `${n} ${n === 1 ? 'résultat' : 'résultats'} dans En cours`,
      complete: (n) =>
        `${n} ${n === 1 ? 'résultat' : 'résultats'} dans Terminés`,
    },
    achievementCount: (n) => `${n} succès`,
    search: 'Chercher des jeux',
    nothingFound: (query) => `Aucun jeu trouvé pour « ${query} ».`,
    empty: 'Aucun jeu joué avec des succès.',
    left: (n) => (n === 1 ? '1 restant' : `${n} restants`),
  },

  settings: {
    title: 'Paramètres',
    account: 'Compte Steam',
    steamId: (id) => `SteamID ${id}`,
    language: 'Langue',
    languageHint:
      'L’application se recharge pour appliquer la langue, y compris aux noms des succès.',
    redo: 'Refaire la configuration',
    erase: 'Effacer la clé et le SteamID',
    eraseTitle: 'Effacer la clé et le SteamID ?',
    eraseDescription:
      'L’application revient à la configuration initiale. Vos notes, listes et succès épinglés sont conservés.',
    eraseConfirm: 'Effacer',
    groups: {
      account: 'Compte',
      window: 'Fenêtre et langue',
      data: 'Données et confidentialité',
      about: 'À propos',
    },
    redoAction: 'Refaire',
    redoHint: 'Reprend la configuration. Vos notes sont conservées.',
    eraseHint: 'Oublie la clé et le SteamID sur cet ordinateur.',
    alwaysOnTop: 'Garder la fenêtre au premier plan',
    alwaysOnTopHint:
      'Reste au-dessus des autres fenêtres, comme un jeu en mode fenêtré.',
    rememberWindow: 'Mémoriser la taille et la position de la fenêtre',
    privacy:
      'Tout reste sur cet ordinateur. L’application ne communique qu’avec Steam et, pour les mises à jour, avec GitHub.',
    dataFolder: 'Dossier des données',
    openFolder: 'Ouvrir le dossier',
    copyPath: 'Copier le chemin',
    pathCopied: 'Chemin copié.',
    errorLog: 'Journal des erreurs',
    errorLogHint:
      'Il se trouve dans logs/errors.log, dans le dossier des données. Il n’est jamais envoyé.',
    versionLabel: 'Version',
    source: 'Code source',
    reportIssue: 'Signaler un problème',
    license: 'Licence',
    version: (version) => `Version ${version}`,
    updateAvailable: (version) => `La version ${version} est disponible`,
    updateHint:
      'Téléchargez-la et installez-la par-dessus celle-ci ; vos données sont conservées.',
    download: 'Télécharger',
    updateDownloading: (version) => `Téléchargement de la version ${version}…`,
    updateReady: (version) =>
      `La version ${version} est prête à être installée`,
    updateReadyHint:
      'L’application redémarre pour terminer la mise à jour ; vos données sont conservées.',
    restart: 'Redémarrer pour mettre à jour',
    updateBlockedHint:
      'Le Contrôle intelligent des applications de Windows est activé et bloque les programmes d’installation sans signature numérique, ce qui est encore le cas de celui-ci. La version installée continue de fonctionner.',
    learnMore: 'En savoir plus',
    checkForUpdates: 'Rechercher des mises à jour',
    checkingForUpdates: 'Recherche…',
    upToDate: 'Vous avez déjà la dernière version.',
    updateCheckFailed: 'La vérification a échoué. Vérifiez votre connexion.',
  },

  update: {
    checking: 'Recherche de mises à jour…',
    found: (version) => `Version ${version} trouvée`,
    downloading: (percent) => `Téléchargement… ${percent} %`,
    restartNotice:
      'L’application redémarre toute seule à la fin du téléchargement. Vos données sont conservées.',
    readyTitle: (version) => `La version ${version} a été téléchargée`,
    readyDescription:
      'L’application doit redémarrer pour terminer la mise à jour. Vos données sont conservées.',
    restartNow: 'Redémarrer maintenant',
    later: 'Plus tard',
    available: (version) => `La version ${version} est disponible`,
    see: 'Voir',
  },

  onboarding: {
    steps: {
      language: 'Langue',
      account: 'Compte',
      done: 'Terminé',
    },
    goToStep: (step) => `Aller à ${step}`,
    redoNotice: (reason) => `${reason} Configurez de nouveau l’application.`,

    language: {
      title: 'Trophy Tracker',
      description:
        'Voyez ce qu’il vous reste à déverrouiller dans le jeu auquel vous jouez.',
      intro:
        'Pour le jeu auquel vous jouez, cette application montre quels succès manquent, quels sont les succès cachés, où en sont ceux qui ont un compteur, et des raccourcis vers des guides.',
      before: 'Pour la configurer, il vous faudra :',
      items: [
        'votre SteamID, que l’application trouve généralement toute seule ;',
        'une clé gratuite de l’API Web de Steam ;',
        'les détails de vos jeux réglés sur public dans votre profil Steam.',
      ],
      keyStaysLocal: 'La clé est stockée uniquement sur cet ordinateur.',
      label: 'Langue',
      start: 'Commencer',
    },

    account: {
      title: 'Votre compte',
      description: 'Le compte Steam à suivre et la clé pour le lire.',
      steamId: {
        label: 'SteamID',
        detected: 'Détecté dans le client Steam de cet ordinateur.',
        saved: 'Le compte avec lequel cette application est configurée.',
        notDetected:
          'Je n’ai trouvé aucun compte connecté au client Steam. Collez votre SteamID à 17 chiffres.',
        change: 'Utiliser un autre compte',
        helpTitle: 'Où trouver mon SteamID ?',
        help: [
          'Dans le client Steam, cliquez sur votre nom en haut à droite.',
          'Choisissez « Détails du compte ».',
          'Le numéro à 17 chiffres à côté de « ID Steam », juste sous le nom du compte, est votre SteamID. Ce n’est ni le code ami ni le nom d’utilisateur.',
        ],
        openAccount: 'Ouvrir « Détails du compte » dans le navigateur',
      },
      key: {
        label: 'Clé de l’API Web',
        placeholder: 'Collez la clé ici',
        helpTitle: 'Comment obtenir une clé ?',
        help: [
          'Ouvrez la page des clés de Steam.',
          'Connectez-vous avec votre compte. Dans « Nom de domaine », saisissez n’importe quoi, par exemple localhost.',
          'Acceptez les conditions, cliquez sur S’inscrire et copiez la clé de 32 caractères.',
        ],
        openPage: 'Ouvrir la page des clés dans le navigateur',
      },
      privacy: {
        help: [
          'Ouvrez les paramètres de confidentialité.',
          'Réglez « Mon profil » et « Détails des jeux » sur Public.',
          'Revenez et testez de nouveau (Steam peut mettre une minute à l’appliquer).',
        ],
        openSettings:
          'Ouvrir les paramètres de confidentialité dans le navigateur',
        testAgain: 'Tester de nouveau',
      },
      verify: 'Vérifier',
      verifying: 'Vérification…',
      verified: (games) =>
        `Vérifié · ${games} ${games === 1 ? 'jeu joué' : 'jeux joués'}`,
      locked:
        'Pour utiliser un autre compte ou une autre clé, cliquez sur Modifier.',
      change: 'Modifier',
    },

    done: {
      title: 'Tout est prêt',
      description: 'La configuration est terminée.',
      found: (n) =>
        `J’ai trouvé ${n} ${n === 1 ? 'jeu joué' : 'jeux joués'} sur votre compte.`,
      account: 'Compte',
      language: 'Langue',
      howItWorks:
        'Ouvrez un jeu sur Steam et l’application bascule dessus toute seule. Sans jeu ouvert, elle montre le dernier auquel vous avez joué ; le Tableau de bord les liste tous.',
      saveFailed:
        'La configuration n’a pas pu être enregistrée. Revenez en arrière et vérifiez de nouveau le compte.',
      finish: 'Entrer dans l’application',
      saving: 'Enregistrement…',
    },
  },
};
