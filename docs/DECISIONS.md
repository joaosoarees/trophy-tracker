# Decisions

Why things are the way they are, for the choices that are not obvious from the code. `CLAUDE.md` and the other files of this folder hold the rules; this file holds the reasons and what was tried before. Newest first. Add an entry when a choice is made that someone could reasonably want to undo.

## Cleared out before 1.0

With the app in its final shape, what had lost its reason was removed rather than carried into 1.0:

- **The "not checked yet" status of a key**, notes kept for no account, and the guard for a key whose ending was unknown: all three only ever happened to an account taken over from the single-account files.
- **The failure counter** that made the interface ask for the state again after every failed read: the main process now says by itself when the status of a key changes.
- **The draft of the setup**, which kept the typed SteamID and the step across a window reload: nothing reloads the window during the setup, the language is saved as it is picked, and an account as it is verified.
- **The date beside the key** ("Checked on…"). It was only written when the status changed, so it showed when the account was added while claiming to be when the key was last checked.
- **The "Code signing policy" section of the README**, written for the SignPath application.
- `saveConfig` became `addAccount`, which is what it does.
- **The last step of the setup.** Once everything about accounts happened in the account step, "Done" was two lines of summary and a button. The account step now ends the setup, and its sentence about how the app works moved there.

## No migration code

Two pieces of code converted old data: one copied the files out of the folder of the app's first name (`steam-trophy-tracker`), and one read the files of the single-account versions (0.1.0 to 0.6.0) as the first account. The first was written for a folder that only ever existed on the developer's machine, before anything was published, and ran on every start of every install with nothing to do. The second served published versions, but the only person who had installed them was the owner, who had already moved on. Both were removed.

What stayed is the check, not the conversion: a file whose format has another version number (or none, as before 0.7.0) is kept aside and not read, so it is never mangled or erased.

## Unsigned for now

SignPath Foundation refused the application for free signing in October 2026. The reason was the project's visibility, not its quality: they look for stars, forks, contributors and mentions elsewhere, and invite a new application once there are some.

What else was looked into that month, for when this is taken up again (prices and rules change; check before spending):

- **Microsoft Store.** Free for an individual since September 2025, with an identity check. The app goes as an MSIX package that Microsoft signs, and the Store takes over updates. The likeliest way past Smart App Control at no cost, though no official page was found saying so in those words. It means a second package and a Store listing to keep.
- **Certum Open Source Code Signing.** About 50 euros a year, in the developer's own name. Signing needs a code from a phone app each time, so releases would stop being automatic, and reports differ on whether Smart App Control accepts it.
- **Azure Artifact Signing.** Ten dollars a month, but individuals are only accepted in the United States and Canada.
- **Apple Developer ID**, for macOS: 99 dollars a year, the only way to automatic updates and to opening the app with no warning there.

The owner chose to go on unsigned. The app already copes: where Windows would refuse the installer, it does not download it and says why.

## Storage that cannot lose a file

A file used to be written straight over the previous one, and a file that could not be parsed was treated as empty. A crash in the middle of a write (or the updater closing the app) left half a file; the next start read it as "no notes", and the first edit erased it for good. Files are now written under a temporary name and renamed into place, and one that cannot be used is copied aside before the app starts from nothing. Each file carries the version of its format, so a later version's file is recognised and kept instead of being guessed at.

The cache was rewritten whole on every game read. It is now written once, a second after it last changed, and when the app closes.

## Lists are not windowed

Measured on the built app with 500 played games and a game with 300 achievements: both lists scroll at 60 frames a second, a tab switch costs about 40 ms, and the heaviest moment (showing a list of 200 cards) about 150 ms. Windowing would complicate the lists, the search and the keyboard for nothing that can be seen. Measure again before deciding otherwise.

## What redraws

The three screens and the rows of the dashboard are memoised, because the shell around them redraws for its own reasons. Before that, switching tabs redrew the 80 cards of the game behind it. What was measured and left alone: a letter typed in a note costs about 1 ms, switching accounts about 45 ms. Memoising further would add code for nothing anyone can see.

## One card per account

The first design showed the accounts as avatar tiles with the details of the one in use as loose rows under them, as the user had sketched. It shipped to a preview build and was rejected: a tile lit up mostly empty on hover, sat outside the alignment of its section, and nothing tied the rows to the account. Each account is now a card that holds its own key and actions.

The card keeps one shape whether it is in use or not. When it was a button in one case and a plain element in the other, every switch threw away and redrew both cards, and the avatars flickered.

In the setup, adding a second account first lived in the last step, which sent the user back to the account step. Everything about accounts now happens in the account step, and the last step is only the summary.

## A refused key does not reopen the setup

With one account, a key Steam refused sent the user back to the onboarding. With several, one bad key must not take the others down: the app stays open with what it had and says which key needs replacing.

## Several accounts, one key each, Steam only

A Web API key can read any public profile, so a second key is not technically needed. Each account still has its own, because that is how Steam issues them and "each account with its key" is the model a user can explain. Support for other platforms was considered and dropped: the other platforms' achievement APIs are too different to design for before there is a second real case.

A saved key is never revealed or copied: whoever needs it has it on Steam's page, and the interface never receives more than its last four characters.

## A running game decides the account

Found by the owner on 1.0.0: with the second account picked by hand and Steam on the first, starting a game the second account does not own made the Game tab say "your profile's game details are not public". The app was reading the first account's game with the second account's key, and Steam answers an unowned game like a private profile.

The follower only acted when the client's account changed, so a manual pick stood even against a running game. It now also acts when a game starts, and while the game runs the other accounts cannot be switched to: the owner asked for that, since switching back would recreate the same wrong screen. When the game closes the app stays where it is.

## Following the Steam account on every system

It was Windows only at first, out of caution: there the registry says who is signed in. The Steam client's own files say the same on macOS and Linux, the app already read them to offer the SteamID in the setup, and the audit had been following an account through those files all along. So the restriction was removed. On macOS and Linux it was checked through the audit's fake client folder, not on a real Steam install.

## No title bar on Windows and macOS

The system draws only its own buttons over the tab bar. Buttons drawn by the app, as the Steam client does, would lose the Windows 11 snap menu and make maximise, restore and their accessibility our code. Linux keeps the system's title bar: what a frameless window does there depends on the desktop, and it could only be tried under WSLg.

## Installers named after their system, release files labelled

GitHub cannot hide a file of a release, and the app needs `latest*.yml` and the block maps there to update itself. Every file gets a label instead, and the notes open with which one to download. Hosting the update files elsewhere would leave the page with installers only, at the price of one more piece in the update chain.

The macOS disk images keep `arm64` and `x64` in their names because electron-builder writes the architecture that way, and renaming afterwards would leave the update files pointing at names that do not exist.

## Updates install silently

On Windows the app closed and the installer's wizard came up asking everything the first install already had. `quitAndInstall(true, true)` installs silently and opens the app again.

macOS cannot update itself: its updater only replaces an app signed with an Apple Developer ID certificate, which costs a yearly fee the project does not pay. The notice downloads the right disk image instead.

## Smart App Control

Found the hard way: 0.1.0 and 0.2.0 installed, 0.3.0 was refused by the same machine. With Smart App Control on, Windows runs an unsigned executable only if Microsoft's reputation service accepts it, which cannot be predicted, and there is no per-app exception. So the app does not download or restart there; the notice says the system would block the install. The check looks at the signature of the running app, so it stops applying by itself once the installers are signed.

The MIT license and the "Code signing policy" and "Privacy" sections of the README were written for an application to SignPath Foundation, which signs open-source projects for free. See "Unsigned for now".

## The audit and the fake Steam

Written after details shipped that no test could catch: a hover wash wider than its section, a second scrollbar, a line drawn twice, a screen captured that was not the one meant. The fake Steam exists because "an unlock cannot be simulated" turned out to be false: a local server that answers in the shape Steam does can unlock an achievement, start a game, refuse a key or go off the air.

The audit runs once per language as a new user, so the interface and what Steam sends are in the same language on every screen. It is not in CI: it takes several minutes, needs a display and fetches pictures from Steam.

Storybook does not replace it. A story shows a component alone; nearly every defect found so far was one of composition or of flow.

## No system notification

Steam already announces an unlocked achievement. The app's own notification was redundant, and on WSL it needed a PowerShell detour. The app says what was unlocked in the notice at the top of the list.

## A closed game stays on screen

With no game running the app shows the last one played, read from a library cached for ten minutes. Closing a game started after that read made the app jump to the game played before it and back. A game the watcher saw running is the last one played, whatever the cached library says.

## SteamID validation

The first rule required the prefix `7656119`. A SteamID64 is a base number plus a 32-bit account number, so the leading digits roll over as accounts are created; the rule now accepts the whole range.

## One way to write the main process, and names checked by tooling

The main process had grown two styles: classes that receive what they depend on (`Tracker`, `Store`), and factory functions returning objects or closures (`createAccountFollower`, `createRunningGameSource`, `createSteamLocal`), plus files of loose functions. Both work; having both meant every new file was a choice, and the choices drifted. It is now classes throughout: constructor-injected when there is state or a dependency, static methods grouped by subject when there is neither (`TextVdf.parse`, `WindowBounds.restore`). A class of static methods is a namespace and nothing more; it was chosen over loose functions so that a helper is always found under the name of its subject, and so that there is one answer to "where does this go". `shared/` and the interface are not part of this: pure functions and hooks are what React and the store expect.

File names and boolean names were drifting the same way, and a rule kept in someone's head had already failed, so both are enforced: the boolean prefix by `@typescript-eslint/naming-convention`, unused code by `knip`. The boolean exceptions are the names that are part of a file format or of Steam's answers; renaming those in memory only would have given one thing two names.

## Not done on purpose

- **Docker Compose for development**: tried and reverted. The app is a desktop window; a container complicated something still experimental.
- **Hiding a card's tools until hover, one guide button instead of three, more visual character**: findings of a design critique that were rejected (see `.impeccable/critique/ignore.md`).
- **A usage meter per key**: Steam allows 100,000 calls a day and the app makes a few hundred.
