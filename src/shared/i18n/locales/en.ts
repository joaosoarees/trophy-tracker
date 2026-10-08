/** Reference language: the `Messages` type comes from this file, so every new key starts here. */
export const en = {
  appTitle: 'Steam Achievements',

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
    privacyRequired: 'Run the privacy check before finishing.',
  },

  check: {
    profileNotFound: 'Steam found no profile with that SteamID.',
    privacyBlocked:
      'Steam did not allow reading your games. Set “Game details” to Public in your privacy settings.',
    reasonNetwork: 'could not reach Steam',
    reasonStatus: (status: number) => `Steam responded with error ${status}`,
    reasonSteamSaid: (text: string) => `Steam responded: ${text}`,
    reasonUnexpected: 'Steam returned an unexpected response',
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
    pinWindow: 'Keep the window always on top',
    unpinWindow: 'Stop keeping the window on top',
  },

  common: {
    cancel: 'Cancel',
    retry: 'Try again',
    refresh: 'Refresh',
    back: 'Back',
    next: 'Next',
    clearSearch: 'Clear search',
    openInBrowser: 'Open in browser',
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
    sort: {
      common: 'Most common first',
      rare: 'Rarest first',
      closest: 'Closest to done',
      recent: 'Most recent first',
      oldest: 'Oldest first',
      name: 'Name',
    },
    nothingFound: (query: string) => `Nothing found for “${query}”.`,
    nothingPending: 'Nothing pending. 100%!',
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
    rename: 'Click to rename',
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
    refreshAll: 'Refresh everything',
    reading: (done: number, total: number) =>
      `Reading achievements: ${done} of ${total} games…`,
    loadingLibrary: 'Loading your library…',
    summary: (games: number, complete: number, ongoing: number) =>
      `${games} games with achievements · ${complete} complete · ${ongoing} in progress`,
    search: 'Search games',
    nothingFound: (query: string) => `No game found for “${query}”.`,
    empty: 'No played games with achievements.',
    complete: 'complete',
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
  },

  onboarding: {
    steps: {
      language: 'Language',
      account: 'Account',
      apiKey: 'Key',
      privacy: 'Privacy',
      done: 'Done',
    },
    loading: 'Loading…',
    redoNotice: (reason: string) => `${reason} Set the app up again.`,

    language: {
      title: 'Steam Achievements',
      description: 'See what is left to unlock in the game you are playing.',
      intro:
        'For the game you are playing, this app shows which achievements are missing, what the hidden ones are, how far along the counted ones are, and shortcuts to guides.',
      before: 'Before you start, three quick things:',
      items: [
        'confirm which account is yours (SteamID);',
        'create a free Steam Web API key;',
        'check that your game details are public.',
      ],
      keyStaysLocal: 'The key is stored only on this computer.',
      label: 'Language',
      start: 'Get started',
    },

    account: {
      title: 'Your account',
      description: 'Which Steam account should the app follow?',
      detected:
        'I found the account signed in to the Steam client on this computer. Confirm it is yours.',
      notDetected:
        'I could not find an account signed in to the Steam client. Paste your 17-digit SteamID below.',
      helpTitle: 'Where do I find my SteamID?',
      help: [
        'In the Steam client, click your name in the top right corner.',
        'Choose “Account details”.',
        'The 17-digit number under “Steam ID”, right below the account name, is your SteamID. It is not the friend code or the username.',
      ],
      openAccount: 'Open “Account details” in the browser',
      label: 'SteamID',
      found: 'Profile found',
      unconfirmed: (reason: string) =>
        `I could not confirm this profile right now (${reason}). You can try again or continue: the next step checks the SteamID together with the key.`,
      verify: 'Verify',
      verifying: 'Verifying…',
      mine: 'This is my account',
      continueAnyway: 'Continue anyway',
    },

    apiKey: {
      title: 'Web API key',
      description: 'Steam asks for a key to share your achievements.',
      steps: [
        'Open the Steam key page.',
        'Sign in with your account. Under “Domain name”, type anything, for example localhost.',
        'Accept the terms, click Register and copy the 32-character key.',
      ],
      label: 'Key',
      placeholder: 'Paste the key here',
      verify: 'Verify key',
      verifying: 'Verifying…',
    },

    privacy: {
      title: 'Profile privacy',
      description: 'The app can only read achievements from a public profile.',
      testing: 'Testing access to your achievements…',
      ok: 'All good: Steam allowed reading your achievements.',
      steps: [
        'Open the privacy settings.',
        'Set “My profile” and “Game details” to Public.',
        'Come back and test again (Steam may take a minute to apply it).',
      ],
      testAgain: 'Test again',
    },

    done: {
      title: 'All set',
      description: 'The setup is complete.',
      found: (n: number) =>
        `I found ${n} ${n === 1 ? 'played game' : 'played games'} on your account.`,
      howItWorks:
        'Open a game on Steam and the app switches to it on its own. With no game open it shows the last one you played; the Dashboard lists them all.',
      saveFailed: 'Could not save the setup. Go back and check the key.',
      finish: 'Enter the app',
      saving: 'Saving…',
    },
  },
};

export type Messages = typeof en;
