/** Reference language: the `Messages` type comes from this file, so every new key starts here. */
export const en = {
  appTitle: 'Trophy Tracker',
  notAffiliated: 'Not affiliated with Valve or Steam.',

  crash: {
    title: 'Something went wrong',
    description:
      'This screen could not be shown. Reloading usually fixes it; the details were saved to the error log.',
    reload: 'Reload',
  },

  errors: {
    invalidKey: 'Steam rejected the Web API key.',
    private: 'Your profile’s game details are not public.',
    noStats: 'This game has no achievements.',
    notFound: 'No Steam profile was found with that SteamID.',
    network: 'Could not reach Steam. Check your connection.',
    notConfigured: 'The app has not been set up yet.',
    steamStatus: (status: number) => `Steam responded with error ${status}.`,
    unexpected: 'Unexpected error. Try again.',
    changeNotSaved: 'Could not save your change, so it was undone.',
  },

  validation: {
    steamIdFormat: 'A SteamID has 17 digits and starts with 7656119.',
    apiKeyFormat:
      'A Web API key has 32 characters (letters A to F and digits).',
    languageRequired: 'Choose a language.',
    verificationRequired: 'Verify the account before continuing.',
  },

  check: {
    privacyBlocked:
      'Steam did not allow reading your games. Set “Game details” to Public in your privacy settings.',
  },

  toast: {
    title: (game: string) => `Achievement unlocked — ${game}`,
    body: (achievement: string, left: number) =>
      `${achievement} · ${left === 0 ? 'all achievements unlocked!' : `${left} left`}`,
  },

  guides: {
    query: 'how to get',
    steam: 'Guides',
    steamTitle: 'Search the Steam community guides',
    searchOn: (site: string) => `Search on ${site}`,
  },

  nav: {
    game: 'Game',
    dashboard: 'Dashboard',
    settings: 'Settings',
    label: 'Main',
    pinWindow: 'Keep the window always on top',
    unpinWindow: 'Stop keeping the window on top',
    settingsWithUpdate: 'Settings · new version available',
  },

  common: {
    cancel: 'Cancel',
    undo: 'Undo',
    close: 'Close',
    dismiss: 'Dismiss',
    retry: 'Try again',
    refresh: 'Refresh',
    back: 'Back',
    next: 'Next',
    clearSearch: 'Clear search',
    openInBrowser: 'Open in browser',
    sortBy: 'Sort by',
  },

  game: {
    none: 'No game is open and nothing has been played yet. Pick one in the Dashboard.',
    running: 'running',
    summary: (unlocked: number, total: number, percent: number) =>
      `${unlocked} of ${total} achievements · ${percent}%`,
    left: (n: number) => `${n} left`,
    allUnlocked: 'all unlocked',
    justUnlocked: (names: string) => `Achievement unlocked: ${names}`,
    noAchievements: 'This game has no achievements.',
    pending: (n: number) => `Pending ${n}`,
    unlocked: (n: number) => `Unlocked ${n}`,
    search: 'Search achievements by name or description',
    hiddenOnly: (n: number) => `Hidden ${n}`,
    hiddenOnlyTitle: 'Show only hidden achievements',
    sort: {
      common: 'Most common first',
      rare: 'Rarest first',
      closest: 'Closest to done',
      recent: 'Most recent first',
      oldest: 'Oldest first',
      name: 'Name',
    },
    nothingFound: (query: string) => `Nothing found for “${query}”.`,
    inOtherList: {
      pending: (n: number) =>
        `${n} ${n === 1 ? 'result' : 'results'} in Pending`,
      unlocked: (n: number) =>
        `${n} ${n === 1 ? 'result' : 'results'} in Unlocked`,
    },
    filterLabel: 'Achievements shown',
    justCompleted: 'Every achievement unlocked!',
    complete: {
      title: 'Every achievement unlocked',
      completedOn: (date: string) => `Completed on ${date}`,
      rarest: (name: string, percent: string) =>
        `Rarest: ${name} · ${percent} of players`,
      seeUnlocked: 'See what you unlocked',
    },
    nothingUnlocked: 'No achievements unlocked yet.',
  },

  card: {
    hidden: 'hidden',
    rarityTitle: 'Players who have this achievement',
    noDescription: 'No description.',
    steamCounter: 'Steam counter',
    checklistCounter: 'Items checked in your checklist',
    unlockedOn: (date: string) => `Unlocked on ${date}`,
    list: 'List',
    listTitle: 'Checklist of what is missing',
    note: 'Add a note',
    notePlaceholder: 'Your note or a guide link',
    pin: 'Pin to top',
    unpin: 'Unpin',
  },

  checklist: {
    rename: 'Rename item',
    removed: (text: string) => `Removed “${text}”`,
    remove: 'Remove item',
    newItem: 'New item',
    add: 'Add item',
    paste: 'Paste list',
    duplicate: 'That item is already on the list.',
    pasteDescription: (achievement: string) =>
      `Paste the items from a guide for “${achievement}”, one per line. Bullets and numbering are removed.`,
    pastePlaceholder: 'Item 1\nItem 2\nItem 3',
    addButton: 'Add',
    addCount: (n: number) => `Add ${n} ${n === 1 ? 'item' : 'items'}`,
  },

  dashboard: {
    title: 'Dashboard',
    filterLabel: 'Games shown',
    refreshAll: 'Refresh everything',
    reading: (done: number, total: number) =>
      `Reading achievements: ${done} of ${total} games…`,
    loadingLibrary: 'Loading your library…',
    ongoing: (n: number) => `In progress ${n}`,
    complete: (n: number) => `Complete ${n}`,
    sort: {
      closest: 'Closest to 100%',
      played: 'Recently played',
      fewest: 'Fewest left',
      name: 'Name',
      completed: 'Recently completed',
    },
    nothingOngoing: 'No games in progress.',
    nothingComplete: 'No complete games yet.',
    inOtherList: {
      ongoing: (n: number) =>
        `${n} ${n === 1 ? 'result' : 'results'} in In progress`,
      complete: (n: number) =>
        `${n} ${n === 1 ? 'result' : 'results'} in Complete`,
    },
    achievementCount: (n: number) =>
      `${n} ${n === 1 ? 'achievement' : 'achievements'}`,
    search: 'Search games',
    nothingFound: (query: string) => `No game found for “${query}”.`,
    empty: 'No played games with achievements.',
    left: (n: number) => `${n} left`,
  },

  settings: {
    title: 'Settings',
    account: 'Steam account',
    steamId: (id: string) => `SteamID ${id}`,
    language: 'Language',
    languageHint:
      'The app reloads to apply the language, including achievement names.',
    redo: 'Redo setup',
    erase: 'Erase key and SteamID',
    eraseTitle: 'Erase key and SteamID?',
    eraseDescription:
      'The app goes back to the initial setup. Your notes, checklists and pinned achievements are kept.',
    eraseConfirm: 'Erase',
    version: (version: string) => `Version ${version}`,
    updateAvailable: (version: string) => `Version ${version} is available`,
    updateHint: 'Download it and install over this one; your data is kept.',
    download: 'Download',
    updateDownloading: (version: string) => `Downloading version ${version}…`,
    updateReady: (version: string) => `Version ${version} is ready to install`,
    updateReadyHint:
      'The app restarts to finish the update; your data is kept.',
    restart: 'Restart to update',
    updateBlockedHint:
      'Windows Smart App Control is on and blocks installers that are not digitally signed, which this one is not yet. The version you have keeps working.',
    learnMore: 'Learn more',
    checkForUpdates: 'Check for updates',
    checkingForUpdates: 'Checking…',
    upToDate: 'You already have the latest version.',
    updateCheckFailed: 'Could not check. Check your connection.',
  },

  update: {
    checking: 'Checking for updates…',
    found: (version: string) => `Version ${version} found`,
    downloading: (percent: number) => `Downloading… ${percent}%`,
    restartNotice:
      'The app restarts by itself when the download finishes. Your data is kept.',
    readyTitle: (version: string) => `Version ${version} was downloaded`,
    readyDescription:
      'The app needs to restart to finish the update. Your data is kept.',
    restartNow: 'Restart now',
    later: 'Later',
    available: (version: string) => `Version ${version} is available`,
    see: 'See',
  },

  onboarding: {
    steps: {
      language: 'Language',
      account: 'Account',
      done: 'Done',
    },
    goToStep: (step: string) => `Go to ${step}`,
    redoNotice: (reason: string) => `${reason} Set the app up again.`,

    language: {
      title: 'Trophy Tracker',
      description: 'See what is left to unlock in the game you are playing.',
      intro:
        'For the game you are playing, this app shows which achievements are missing, what the hidden ones are, how far along the counted ones are, and shortcuts to guides.',
      before: 'To set it up you will need:',
      items: [
        'your SteamID, which the app usually finds on its own;',
        'a free Steam Web API key;',
        'your game details set to public on your Steam profile.',
      ],
      keyStaysLocal: 'The key is stored only on this computer.',
      label: 'Language',
      start: 'Get started',
    },

    account: {
      title: 'Your account',
      description: 'The Steam account to follow and the key to read it.',
      steamId: {
        label: 'SteamID',
        detected: 'Detected from the Steam client on this computer.',
        saved: 'The account this app is set up with.',
        notDetected:
          'I could not find an account signed in to the Steam client. Paste your 17-digit SteamID.',
        change: 'Use another account',
        helpTitle: 'Where do I find my SteamID?',
        help: [
          'In the Steam client, click your name in the top right corner.',
          'Choose “Account details”.',
          'The 17-digit number under “Steam ID”, right below the account name, is your SteamID. It is not the friend code or the username.',
        ],
        openAccount: 'Open “Account details” in the browser',
      },
      key: {
        label: 'Web API key',
        placeholder: 'Paste the key here',
        helpTitle: 'How do I get a key?',
        help: [
          'Open the Steam key page.',
          'Sign in with your account. Under “Domain name”, type anything, for example localhost.',
          'Accept the terms, click Register and copy the 32-character key.',
        ],
        openPage: 'Open the key page in the browser',
      },
      privacy: {
        help: [
          'Open the privacy settings.',
          'Set “My profile” and “Game details” to Public.',
          'Come back and test again (Steam may take a minute to apply it).',
        ],
        openSettings: 'Open the privacy settings in the browser',
        testAgain: 'Test again',
      },
      verify: 'Verify',
      verifying: 'Verifying…',
      verified: (games: number) =>
        `Verified · ${games} ${games === 1 ? 'played game' : 'played games'}`,
      locked: 'To use another account or key, click Change.',
      change: 'Change',
    },

    done: {
      title: 'All set',
      description: 'The setup is complete.',
      found: (n: number) =>
        `I found ${n} ${n === 1 ? 'played game' : 'played games'} on your account.`,
      account: 'Account',
      language: 'Language',
      howItWorks:
        'Open a game on Steam and the app switches to it on its own. With no game open it shows the last one you played; the Dashboard lists them all.',
      saveFailed:
        'Could not save the setup. Go back and verify the account again.',
      finish: 'Enter the app',
      saving: 'Saving…',
    },
  },
};

export type Messages = typeof en;
