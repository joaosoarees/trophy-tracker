# Decisions

Why things are the way they are, for the choices that are not obvious from the code. `CLAUDE.md` and the other files of this folder hold the rules; this file holds the reasons and what was tried before. Newest first. Add an entry when a choice is made that someone could reasonably want to undo.

## The audit runs once, and layouts adapt to their texts

Until 2026-10-13 `pnpm audit:ui` ran once per language, four apps side by side, and the full run was what counted. The owner cut it to one run, in English: a check that takes minutes should not be what keeps a long label from breaking a row. The layout should adapt to its texts instead, wrapping or shrinking, and that is now a rule for new rows (`docs/interface.md`).

What was given up: Spanish, French and Portuguese are no longer seen on every change, so a text that is cut in one of them, or an achievement name that is not Steam's in that language, is found only when that language is asked for (`AUDIT_LANGUAGES=fr`). The two width measurements (the tab bar, a card's row at 480 px) stay in the single run, where English is the shortest of the four.

Two rows do not adapt yet and were only ever kept whole by measuring: the tab bar, which French fills to the pixel, and a card's row. The tab bar is in `docs/ROADMAP.md`.

## One saved link per achievement

Asked on 2026-10-13 what was still opened beside the app during a hunt, the owner named one thing: a YouTube video. The card only offered searches, so the right video was found again every session. An achievement now keeps one address, which opens in the browser from the first button of its row.

The choices, each of which could have gone the other way:

- **A field of its own**, not addresses made clickable in the note: the point is one click without opening the note.
- **One link**, not a list: several would need names and a row of their own in a window 480 px wide. A second address fits in the note.
- **Any `https` address**, not only YouTube: a written guide or a map of collectibles is the same field. `http`, other schemes, an address with a user or a password, and a host with no dot are refused, by the same function in the card and in the main process (`shared/link.ts`), since the address is handed to the system to open.
- **The searches stay** beside a saved link: a video can be taken down, and the search is the way out.
- **The row was tightened to take the new button.** At 480 px it would have broken in two on every card, in the four languages (366 px needed, 352 at hand). The searches lost 2 px of padding a side and the user's tools stand together with no gap, which leaves 338 px (345 in French); the audit now measures it. A card with a saved link still breaks at that width, between the searches and the tools.
- **The page opens in the browser**, not in the window: a player 480 px wide over a game is small, carries advertising, and would be the first thing the app loads from somewhere other than Steam and GitHub.
- **No new format version** for `userdata.json`: the field is optional, as the checklist was, and a version before it reads the file and writes the links back as it found them. The one loss: there, an achievement edited down to no note, no pin and no checklist has its entry removed, link included.

Considered in the same conversation and left out by the owner: exporting and importing checklists (a "Copy list" per achievement included), a comparison with friends' achievements, a history of unlocks, a queue of games to complete, and a compact mode for use during a game.

## No React Compiler

Measured on 2026-10-10 (React 19.3.0, `babel-plugin-react-compiler` 1.0.0) against a rule set beforehand: adopt only if a scenario gains 20% outside the noise, none gets worse, and every check passes. Typing a note, checking a checklist and the dashboard gained 30% to 90%, which is a few milliseconds at most; clearing the achievement search got slower in most runs at the size of a typical game, and the bundle grew 8%. One condition failed, so it stayed off. The numbers and the way to measure again are in `docs/store.md`.

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

A third piece went later for the same reason: the dashboard read once more any complete game whose cached summary had no completion date (`lastUnlockAt`). Every release since 0.1.0 writes that date with the summary, so only a cache from the developer's machine, older than the first release, could lack it. The field is now required in a summary.

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

Since 2026-10-11 the three files only the user can give back are also flushed to the disk before the rename. The rename protects a file from the app dying mid-write; it does not protect it from the system going down just after (a power cut during a game), when a file system may have recorded the new name and not the new content. The next start would then find `userdata.json` empty and set it aside as damaged, and the notes and checklists would be gone. Whether NTFS or APFS really lose a file this way was not tested, and cannot be without cutting the power: the flush was added because it is cheap (no difference that could be measured on the development machine, at 59 kB a write) and the loss is the one thing Steam cannot give back.

## Lists are not windowed

Measured on the built app with 500 played games and a game with 300 achievements: both lists scroll at 60 frames a second, a tab switch costs about 40 ms, and the heaviest moment (showing a list of 200 cards) about 150 ms. Windowing would complicate the lists, the search and the keyboard for nothing that can be seen. Measure again before deciding otherwise.

## What redraws

The three screens and the rows of the dashboard are memoised, because the shell around them redraws for its own reasons. Before that, switching tabs redrew the 80 cards of the game behind it. What was measured and left alone: a letter typed in a note costs about 1 ms, switching accounts about 45 ms. Memoising further would add code for nothing anyone can see.

## One card per account

The first design showed the accounts as avatar tiles with the details of the one in use as loose rows under them, as the user had sketched. It shipped to a preview build and was rejected: a tile lit up mostly empty on hover, sat outside the alignment of its section, and nothing tied the rows to the account. Each account is now a card that holds its own key and actions.

The card keeps one shape whether it is in use or not. When it was a button in one case and a plain element in the other, every switch threw away and redrew both cards, and the avatars flickered.

In the setup, adding a second account first lived in the last step, which sent the user back to the account step. Everything about accounts now happens in the account step, and the last step is only the summary.

## The account in use is the face on the Settings button

With two accounts, nothing on the Game or the Dashboard said whose data was on screen, and the app changes account by itself (a game starting, another account signing in to Steam). The owner asked for the account in use to be visible, as its avatar on the tab bar, shown only with more than one account and leading to Settings.

A button of its own does not fit. Measured by the audit on 2026-10-12, at 480 px beside the 138 px of buttons Windows draws the bar has 342 px: without it the bar needs 342 in French (326 in English, 285 in Spanish, 280 in Portuguese), with it 378 and 362. So the face takes the place of the gear (`AppShell/SettingsButton`): no width is added, the click already led to Settings, and the tooltip names the account. The cost is that Settings stops looking like a gear once there are two accounts. Also considered: the avatar in the header of the Game and the toolbar of the Dashboard (two places, and none on the Game tab with no game), and tabs that drop their text when the window is narrow (a larger change to the bar for one avatar).

This is the one thing about an account drawn outside its card, and it is only its face: the name is in the tooltip, and the key, its status and every action stay in the card.

## A refused key does not reopen the setup

With one account, a key Steam refused sent the user back to the onboarding. With several, one bad key must not take the others down: the app stays open with what it had and says which key needs replacing.

## Several accounts, one key each, Steam only

A Web API key can read any public profile, so a second key is not technically needed. Each account still has its own, because that is how Steam issues them and "each account with its key" is the model a user can explain. Support for other platforms was considered and dropped: the other platforms' achievement APIs are too different to design for before there is a second real case.

A saved key is never revealed or copied: whoever needs it has it on Steam's page, and the interface never receives more than its last four characters.

## A running game decides the account

Found by the owner on 1.0.0: with the second account picked by hand and Steam on the first, starting a game the second account does not own made the Game tab say "your profile's game details are not public". The app was reading the first account's game with the second account's key, and Steam answers an unowned game like a private profile.

The follower only acted when the client's account changed, so a manual pick stood even against a running game. It now also acts when a game starts, and while the game runs the other accounts cannot be switched to: the owner asked for that, since switching back would recreate the same wrong screen. When the game closes the app stays where it is.

## A registry read that fails is not a game closing

On Windows the running game comes from the registry, through `reg.exe`, every ten seconds. A read that failed (the command killed at its ten seconds, or not started) answered "no game" until 2026-10-11: the watcher then made the game's last read, announced it closed and freed the account, and ten seconds later the game "started" again, with the dashboard read again and the app brought back to the Game tab. The Web API path already kept its last answer when a call failed; the registry path now does the same (`Windows.getRunningAppId` rejects, `RunningGame` keeps what it had). The cost is a game that really closed during a run of failed reads staying on screen as running until one works. How often `reg.exe` fails on a real machine was not measured: the change makes the three systems behave alike rather than answer a count.

## A picked game is shown while it runs on an account the app does not have

With a game running on a Steam account the app does not have, the Game tab says so and offers to add the account. Until 2026-10-11 the same screen came back when that game was picked in the dashboard of the account in use, which had played it too: the selector could not tell "nothing picked, the current game is on screen" from "the user picked the game that happens to be the current one", and that one game could not be opened until it closed. The owner chose to show the pick: the dashboard lists only this account's games, so what is shown is this account's data, with no running mark, since it is not this account that plays. The other reading (the game stays blocked while it runs elsewhere) was considered and dropped: `docs/accounts.md` forbids showing a running game with another account's data, which this does not do.

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

## A check for updates that cannot be made is tried again

Until 2026-10-11 any failure on the automatic path, the check included, put `AppUpdates` on the notice with the download page until the app was restarted or the user pressed the updates button. An app opened before the network was up therefore stopped updating itself for that whole run: when a release appeared, an app that could install it only offered the download. A check that could not be made now changes nothing: no version is known, and the look stays due, so the hourly timer asks again. A download that fails, an error the updater reports and a version whose install already failed still fall back to the notice, since those say something about the updater or the version.

## Smart App Control

Found the hard way: 0.1.0 and 0.2.0 installed, 0.3.0 was refused by the same machine. With Smart App Control on, Windows runs an unsigned executable only if Microsoft's reputation service accepts it, which cannot be predicted, and there is no per-app exception. So the app does not download or restart there; the notice says the system would block the install. The check looks at the signature of the running app, so it stops applying by itself once the installers are signed.

The license (MIT at the time) and the "Code signing policy" and "Privacy" sections of the README were written for an application to SignPath Foundation, which signs open-source projects for free. The owner changed the license to Apache 2.0 on 2026-10-11; versions up to 1.1.0 were published under MIT. See "Unsigned for now".

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

## Nothing the app does by itself keeps the window from opening

Since the store throws on a write the disk refuses (the entry below), two writes made before the window opened could end the wiring: the client's account being followed, and the record of a finished update being erased. The process then stayed alive with no window, holding the single-instance lock. Both are things nobody asked for, so both now take the refusal, write it to the error log and are tried again when they naturally would be. The look at the client's account runs every 30 seconds: it is logged once for as long as it keeps failing, because one entry per look would rotate the half-megabyte log within hours and lose everything else in it.

What cannot be worked around ends in a box (`dialog.showErrorBox`), the only thing Electron can show before a window exists. On Linux the single-instance lock is a file in the data folder (seen there; macOS runs the same Chromium code, Windows was not looked at), so a folder that cannot be created or written to looks exactly like "the app is already open": the app used to quit there, silently. A refused lock is therefore checked against the folder (`DataFolder.canWrite`) before it is taken to mean a second launch. Running read-only was considered and left out: without the lock every launch would open another app, and Chromium itself cannot use the folder.

## The store keeps nothing it could not write

`Store` used to change what it held and then write it. When the disk refused the write, the caller got the error and the store kept the change: the app ran on an account, a language or a note the file did not have, the next write that worked saved the refused change along with its own, and otherwise a restart undid it. It now writes first and takes the change only then (`docs/local-data.md`). The alternative, keeping the change and trying the write again later, was not taken: the interface has already told the user the change failed and put the screen back.

Three choices follow from it that could have gone the other way. **A removal that cannot delete the notes puts the account back** rather than leaving it removed with its notes on disk, because adding that account again would bring those notes back. **A key status that cannot be written is logged and fails nothing** rather than failing the read that learnt it: the status is what Steam last said, the game was read, and the next read learns it again; keeping it in memory only would have made it the one thing held that the file does not have. **The cache stays as it was**, taken at once and written a second later: it is what makes a library of hundreds of games one write, and nothing in it is the user's.

## Not done on purpose

- **Docker Compose for development**: tried and reverted. The app is a desktop window; a container complicated something still experimental.
- **Hiding a card's tools until hover, one guide button instead of three, more visual character**: findings of a design critique that were rejected (see `.impeccable/critique/ignore.md`).
- **A usage meter per key**: Steam allows 100,000 calls a day and the app makes a few hundred.
