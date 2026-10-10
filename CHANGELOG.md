# Changelog

What changed in each version, for whoever uses the app. The section of a version is what its release shows on GitHub.

## Unreleased

### Fixed

- With more than one account, starting a game that only the account signed in to Steam owns no longer shows "your profile's game details are not public". The app switches to the account that is playing, and stays on it while the game runs.
- A game running on a Steam account that is not in the app is said to be so, with a way to add that account.

## 1.0.0

The first version called final. It does what 0.7.0 did, with what had lost its reason taken out.

### Changed

- The first setup has two steps instead of three: once an account is verified, the same step enters the app.
- The app follows the account signed in to Steam on macOS and Linux too, not only on Windows.
- The card of an account no longer shows a date beside its key. The date was when the account was added, while reading as when the key was last checked.

### Before you update

Come from 0.7.0. The app no longer reads the files of versions before it: from an older version it starts from the initial setup, and your old files are kept beside the new ones as `.v1.bak`, without being loaded. Opening 0.7.0 once on that computer first carries everything over.

## 0.7.0

### New

- **Several Steam accounts.** Settings lists your accounts as cards and switches between them in one click; each account has its own Web API key, and its own notes, checklists and pinned achievements. "Add account" asks for the SteamID and the key, as the first setup does.
- **The app follows the account signed in to Steam** (Windows): when you sign in to another of your accounts in the Steam client, the app switches to it and says so.
- **A key Steam refuses no longer sends you back to the setup.** The app stays open with what it had, says which key stopped working and offers "Replace key".
- The card of an account says when its key is saved without encryption, which happens on a system with no password keyring.

### Changed

- In the first setup, everything about accounts happens in the "Account" step: a verified account joins a list, and another can be added right there. The last step is only the summary.
- "Redo setup" and "Erase key and SteamID" are gone from Settings: replacing a key, adding an account and removing an account cover what they did. Removing an account deletes its key, what was read from Steam and its notes, and asks first.
- A saved key is never shown again, only its last four characters.

### Fixed

- **Your files can no longer be lost to a crash.** A file is now written whole before it replaces the previous one, and a file that cannot be read is kept aside instead of being treated as empty and overwritten.
- Reading a large library no longer rewrites the cache once per game.
- Switching tabs no longer redraws the list of the game behind it, and switching accounts no longer makes the avatars flicker.
- Pictures are only loaded from Steam's servers.

### Before you update

This version changes how the app's files are organised. It takes over what you have, but an older version cannot read the new files: to be able to go back, copy the app's data folder first (Settings → Data folder).

## 0.6.0

- On Windows, a downloaded update now installs by itself: the app closes, updates and opens again, with no installer to click through.
- On macOS, the "Download" button of the update notice downloads the right disk image for your Mac instead of opening the release page.
- The installers are named after their system, and the release page says which file to download.

## 0.5.1

- The steps at the top of the setup change colour when clicked, with no box drawn around them.
- A SteamID is checked against the whole range Steam uses, not a fixed beginning.
- A SteamID you typed is no longer locked as if it had been found in the Steam client.

## 0.5.0

- The Windows installer and the macOS disk image have the app's own pictures, and the installer speaks the four languages of the app.
- On Windows and macOS the window has no title bar: the system's buttons sit on the app's own bar.

## 0.4.0

- A new Settings screen, with the window's preferences, the data folder and the version.
- Details of the game on its screen: time played, last played, rarest achievement, hidden and counted achievements.
- A game with every achievement unlocked shows it, with the date and the rarest one.
- An unlocked achievement is announced at the top of the list; the system notification was removed, since Steam already raises one.
- The app looks for a new version as it opens and, where it can, updates itself before showing anything.
- Opened with Steam unreachable, the app says so instead of saying nothing was played.
- A game that was just closed stays on screen.

## 0.3.0

- French.
- "Check for updates" in Settings.
- A wider window, which is remembered.

## 0.2.0

- Spanish.
- The app updates itself on Windows and with the Linux AppImage, and announces new versions elsewhere.

## 0.1.0

- First release: the achievements of the game open on Steam, hidden ones revealed, counters, guides, notes, checklists and a dashboard of every played game.
