# Trophy Tracker

Desktop app (Electron + React + TypeScript) that shows, for the game open on Steam, which achievements are missing, what the hidden ones are, progress counters, user checklists and shortcuts to guides. It runs natively on Windows, macOS and Linux, and is developed on WSL.

**Language rules:** everything in the repository is written in English: code, comments, test names, docs and commit messages. The interface ships in four languages, **English (default), Brazilian Portuguese, Spanish and French**; text in another language belongs only in its file under `src/shared/i18n/locales/` (`pt-BR.ts`, `es.ts`, `fr.ts`) and in test data that checks that locale. The user talks to you in Portuguese; answer in Portuguese.

## Commands

```bash
pnpm dev         # app with reload (window through WSLg)
pnpm build       # builds into out/
pnpm start           # runs the build
pnpm test            # Vitest, once (test:coverage also measures coverage, as CI does)
pnpm test:watch      # re-runs the tests affected by each file you save
pnpm test:verbose    # lists every test by name, grouped by file
pnpm typecheck   # tsc on both projects (main process and interface)
pnpm lint        # ESLint (lint:fix to auto-fix)
pnpm format      # Prettier (format:check to only verify)
pnpm audit:ui    # builds the app, runs it against a fake Steam and audits every screen and flow

pnpm dist:linux  # AppImage and .deb into dist/ (dist:win, dist:mac, dist for the current system)
pnpm dist:docker # Linux and Windows installers built inside a container
pnpm test:package # installs the .deb in a clean container and checks that the app starts
```

Electron needs `libnss3 libnspr4 libasound2t64` installed on WSL. `dist:docker` and `test:package` need Docker.

**Package manager: pnpm only.** The exact version is pinned in `packageManager` and provided by Corepack (`corepack enable`, once). `devEngines.packageManager` makes npm refuse to install, and the `preinstall` script (`only-allow pnpm`) refuses any other manager. Never run `npm install` or commit a `package-lock.json`. Use `pnpm add` / `pnpm add -D` / `pnpm remove`, and `pnpm dlx` instead of `npx`. pnpm blocks dependency install scripts unless they are allowed in `pnpm-workspace.yaml` (`allowBuilds`); only `esbuild` is allowed. Electron needs no entry because it downloads its binary on first run. pnpm's `node_modules` is strict: a package must be listed in `package.json` to be imported.

## Code standards

Enforced by tooling; do not work around it.

- **Formatting:** Prettier with `{ "singleQuote": true }`: single quotes, semicolons, 80 columns, trailing commas. `.editorconfig` covers indentation and line endings.
- **Lint:** ESLint 9 flat config in `eslint.config.mjs`: typescript-eslint type-checked rules, React, React Hooks, jsx-a11y and import ordering. `src/renderer/src/ui/primitives` (generated shadcn/ui) is formatted but not linted. Exceptions for tests, config files and async JSX handlers are written down in the config with the reason.
- **Interfaces start with `I`** (`IAchievement`, `IGameView`, `IStepperProps`); the rule is `@typescript-eslint/naming-convention`. Type aliases (`type X = ...`) have no prefix. The global `Window` augmentation is the only exception.
- **Imports** are grouped (builtin, external, internal `@app`/`@ui`/`@shared`, parent, sibling, index), alphabetised, with a blank line between groups, and type imports are inline (`import { type X }`). `pnpm lint:fix` sorts them.
- **Function-typed members** use property syntax (`onClick: () => void`), not method syntax.
- **No untyped JSON:** responses from Steam are typed where they are read (`Envelope<T>`, `PlayerStats<T>` in `steam/client.ts`).
- **TypeScript projects:** `tsconfig.node.json` (main, preload, shared, tests; no DOM) and `tsconfig.web.json` (interface and shared; no Node types), both extending `tsconfig.base.json`. Using a browser API in the main process, or a Node API in the interface, is a compile error.
- **Version pins with a reason:** TypeScript stays on 6.0 because typescript-eslint does not support 7 yet, and ESLint stays on 9 because the React and jsx-a11y plugins do not support 10 yet. Revisit both when the plugins catch up.

## Platforms

The same code runs on Windows, macOS, Linux and, for development, WSL. What differs per system is isolated in `main/steam/` (`local.ts`, `windows.ts`, `steamFiles.ts`), `main/system/` and `storage/createCipher.ts`; services, IPC handlers and the interface never test `process.platform`.

| What                            | Windows (and WSL)                                  | macOS and Linux                                             |
| ------------------------------- | -------------------------------------------------- | ----------------------------------------------------------- |
| Running game                    | registry, `HKCU\Software\Valve\Steam\RunningAppID` | Web API: `gameid` in `GetPlayerSummaries`, asked every 30 s |
| Signed-in account               | registry, `ActiveProcess\ActiveUser`               | `config/loginusers.vdf` in the Steam folder (`MostRecent`)  |
| Steam folder (counter stat map) | registry, `SteamPath`                              | the known install paths, first one that exists              |
| Opening links                   | Electron (`rundll32.exe` on WSL)                   | Electron                                                    |

- `steam/local.ts` builds `ISteamLocal` (registry or files) once; services receive it and never ask which system they are on. `services/runningGame.ts` picks the registry when there is one and the Web API otherwise, reusing the last answer when a call fails so a network hiccup does not look like the game closing. When a game closes, `GameWatcher` keeps it as the last one played instead of asking the library, whose cached copy still names the game played before it.
- `steam/windows.ts` is the Windows side. On WSL it calls the same `.exe` files through interop (`reg.exe`, `rundll32.exe`, `powershell.exe`); WSL is recognised by the kernel name **and** `WSL_DISTRO_NAME`, so a container on a WSL host counts as plain Linux.
- `system/browser.ts` hides the WSL detour: links must open in the Windows browser.
- **The app raises no system notification.** Steam already announces an unlocked achievement; the app says what was unlocked, and how many are left, in the notice at the top of the list. A notification of its own was removed as redundant (and it needed a PowerShell detour on WSL).
- The Web API only reports the running game when the profile shows it; on macOS and Linux a profile that hides the game status simply never switches games on its own.
- The data folder is `trophy-tracker` on every system (set in `main/index.ts`); `storage/migrateUserData.ts` moves the files of the old `steam-trophy-tracker` folder once.
- A second launch focuses the open window (`requestSingleInstanceLock`).

## Packaging and releases

- **electron-builder**, configured in `electron-builder.yml`: NSIS installer for Windows, dmg for macOS (Intel and Apple Silicon), AppImage and deb for Linux. Everything the app runs is bundled into `out/` by electron-vite, so **no `node_modules` go into the package**: `electron-builder.yml` excludes them and `electron.vite.config.ts` turns off `externalizeDeps` for the main and preload bundles. `package.json` still tells the truth: what ships to the user (React, Zustand, `electron-updater`...) is in `dependencies`, tooling is in `devDependencies`. A package imported by `src/` goes into `dependencies`.
- **Not signed yet.** Windows shows the SmartScreen warning, or refuses the installer outright under Smart App Control (see below); macOS uses an ad-hoc signature (`identity: '-'`, without it an Apple Silicon Mac refuses to start the app) and the user has to allow the app in System Settings. Revisit if the app is published for real.
- **`deb.depends` is written out** because the default list misses libraries a minimal system lacks (`libgbm1`); it was found by installing the package in a clean container, which `pnpm test:package` repeats (`scripts/package-test/`).
- **Docker builds and tests, it does not run the app for the user:** `scripts/docker-dist.sh` builds the Linux and Windows installers in a container (the image brings Wine), and the package test installs the deb under a virtual display. macOS installers can only be built on macOS.
- **GitHub Actions:** `ci.yml` checks formatting, lint, types, tests and the build on every push; `release.yml` runs on a `v*.*.*` tag (which must match `version` in `package.json`), builds the installers on the three systems and, when all three succeed, **publishes** the release with the installers and the update metadata (`latest*.yml`, block maps).
- **New versions reach the user in two ways**, decided by `system/autoUpdate.ts`:
  - **Windows and the Linux AppImage update themselves** (`electron-updater`). `services/AppUpdates.ts` looks for a version, downloads it and reports the progress; the interface decides when the restart happens.
  - **macOS and a .deb install only get a notice** with a button to the download page: macOS accepts updates only from apps signed with an Apple certificate, and a .deb needs the administrator password. `services/UpdateChecker.ts` asks GitHub for the latest release.
  - `AppUpdates` falls back to the notice whenever the automatic path fails. A failure to check (offline, no release) means "nothing new".
- **When the app opens** (`store/slices/updatesSlice.ts`, screen `ui/screens/Update`), before the onboarding or the app is shown, it waits up to 4 s to hear about a new version:
  - found in time, where the app updates itself → the update screen shows the progress and **the app restarts by itself** when the download ends. Nothing was in use yet, so nothing is lost. If the download fails, the app opens normally;
  - found in time, elsewhere → the app opens and a toast says a version is available, leading to Settings;
  - nothing in 4 s (or offline) → the app opens; whatever arrives later is handled as below.
- **With the app in use** (the hourly timer in `main/index.ts`, which checks once six hours have passed, or "Check for updates" in Settings), a version downloads in the background, Settings shows the progress, and when it is ready a dialog asks: restart now or later. The app never restarts by itself while in use.
- A window reload (language change) is not the app opening: `sessionStorage` remembers that the startup check ran.
- **Restart loop guard:** before closing to install, the app records the version in `settings.json` (`updateAttempt`). If it opens and that version is still newer than the running one, the install failed: that version is never installed automatically again, only offered for download. Without this, a blocked installer would close the app on every start.
- **Smart App Control blocks unsigned installers** (found the hard way: 0.1.0 and 0.2.0 installed, 0.3.0 was refused by the same machine). With it on, Windows runs an unsigned executable only if Microsoft's reputation service accepts it, which cannot be predicted, and there is no per-app exception. So on Windows, when Smart App Control is enforcing and the running app is unsigned (`isInstallBlockedBySystem` in `system/autoUpdate.ts`), the app does not download or restart: the notice says the system would block the install (`updateStatus: 'blocked'`). The check looks at the signature of the running app, so it stops applying by itself once the installers are signed.
- **Signing plan:** free signing for open source through SignPath Foundation (hence the MIT license and the "Code signing policy" and "Privacy" sections of the README, which their terms require). It needs their approval, and every signed release then needs a manual approval, so releases will stop being fully automatic.
- **What protects the update:** the installers are not signed, so the only guarantee is the hash in `latest*.yml`, published in the same release. Whoever can publish a release controls what users install; that is why the `v*` tags are protected on GitHub (only the owner creates, moves or deletes them) and `main` refuses force-pushes.
- To release: bump `version` in `package.json`, commit, push, then tag `vX.Y.Z` and push the tag. An app can only update itself to a version newer than the one that introduced the updater (0.2.0).

## Production behaviour

- **Errors are logged locally, never sent anywhere:** `system/errorLog.ts` writes to `logs/errors.log` in the data folder (rotated at 512 KB). The main process logs uncaught exceptions and rejections; the interface reports its own through `SystemService.logError` (`app/lib/reportUnhandledErrors.ts` and `ui/components/ErrorBoundary`).
- **A render error does not leave a blank window:** `ErrorBoundary` wraps the app and shows `CrashScreen` with a reload button.
- **Code only needed sometimes is loaded lazily:** the onboarding is loaded with `app/lib/namedLazyLoad.ts` inside `Suspense`.
- The interface bundle is minified (`electron.vite.config.ts`). Its main file is about 510 kB, roughly half of it `react-dom`; the size warning is set to 800 kB because the file is read from disk, not downloaded. If the warning shows again, find out what grew before raising the limit.
- **Every language is bundled** (about 5 kB each in the main file). Loading only the language in use would make reading messages asynchronous everywhere; revisit at around ten languages.

## Architecture

Three processes' worth of code, each with its own layers:

```
src/shared/            the contract between the two sides: types and pure logic
  types/                 one file per entity: Achievement, Game, Profile, Check, AppState,
                         UserData, Guide, and Api (IApi: everything the interface can ask)
  ipcEvents.ts           names of the events the main process pushes to the interface
  checklist.ts           parseChecklist, createChecklistItem, shownProgress
  achievementSort.ts     the orders each list of a game can have, and the stored preference
  dashboardSort.ts       the same for the two lists of the dashboard
  view.ts                mergeView: merges reads, reusing what did not change
  version.ts             isNewerVersion
  updateFlow.ts          what an update state means for the interface (hold the app, tell the user)
  validation.ts          SteamID and key formats
  i18n/                  languages: index.ts (registry) and locales/ (one file per language)

src/main/              main process: the only part that talks to Steam and to the disk
  index.ts               composition root: builds each piece once and wires them together
  window.ts              MainWindow: the single window and the events pushed to it
  ipc/registerIpc.ts     answers IApi; handlers only route, the work lives in the services
  services/
    Tracker.ts             reads games and the dashboard: cache, deduplication, art
    SetupService.ts        setup state, language, and the checks that get the app set up
    GameWatcher.ts         follows the running game and keeps its view fresh while it is played
    runningGame.ts         which game is running: registry, or the Web API where there is none
    UpdateChecker.ts       asks GitHub whether a newer version was released
    AppUpdates.ts          self-update where the system allows it, the notice elsewhere
    onboardingChecks.ts    key + SteamID and privacy checks against Steam
  steam/                 client.ts (Web API), achievements.ts (buildGameView, guideUrl),
                         local.ts (ISteamLocal: what the installed Steam client tells),
                         windows.ts (registry and WSL interop), steamFiles.ts and textVdf.ts
                         (Steam folder on macOS and Linux), vdf.ts (binary cache reader)
  storage/               Store.ts (JSON persistence), secureCipher.ts and createCipher.ts (key encryption),
                         migrateUserData.ts (one-off move from the old data folder)
  system/                browser.ts (links), errorLog.ts (local log), dataFolder.ts, windowBounds.ts,
                         autoUpdate.ts (electron-updater, where the app can replace itself)

src/preload/           exposes `window.api` (contextBridge), typed by `IApi`

src/renderer/src/      the interface, in two layers
  app/                 everything that is not visual
    services/            classes with static methods; the ONLY code that touches window.api
    store/               Zustand store and its slices
    hooks/               useT, useLocale, useActiveGame
    lib/                 saver (debounced writes), safeSessionStorageGetItem, namedLazyLoad,
                         reportUnhandledErrors
  ui/                  everything that is drawn
    App.tsx + useAppController.ts   decides between onboarding and the app
    screens/             one folder per screen: Game, Dashboard, Settings, Onboarding, Update
    components/          shared between screens: AppShell, Pressable, IconButton, Hint, OptionSelect,
                         RemoteImage, ProgressBar, Segmented, SearchBox, Empty, ErrorBoundary, CrashScreen,
                         UpdateReadyDialog, DetailList (DetailGroup and DetailRow), Switch, Collapsible
    primitives/          shadcn/ui components (generated; do not hand-edit without a reason)
    styles/index.css     Tailwind and the theme tokens
    utils/               cn, text (accent-free search), format (dates and numbers)

test/                  Vitest: one file per unit mirroring src/, factories/, fixtures/ (real API responses)
```

### Path aliases

- `@app/*` → `src/renderer/src/app/*` and `@ui/*` → `src/renderer/src/ui/*` (interface only)
- `@shared/*` → `src/shared/*` (interface, main process and preload)

Import through the alias, except for files inside the importing file's own folder (`./useGameController`, `./components/GameHeader`). Tests use aliases too, with `@main/*` and `@test/*` added for them (see Tests).

### Layers and who may call whom

```
ui (screens, components) → app/store and app/hooks → app/services → window.api → main/ipc → main/services → steam / storage
```

- A screen or component never calls `window.api`; a lint rule enforces it. It reads the store, calls a store action, or (for one-off requests such as opening a link or an onboarding check) calls a service.
- Services hold no state: they are typed doors to the main process. State lives in the store.
- In the main process, `registerIpc` holds no logic and services receive what they depend on through the constructor (see `index.ts`), which is what makes them testable without Electron.
- To add a call: a method on `IApi` (`shared/types/Api.ts`), a handler in `main/ipc/registerIpc.ts`, the name in the list in `preload/index.ts`, and a method on the matching class in `app/services`.

### Screens and components

A screen is a folder in `ui/screens/<Name>/`:

```
Game/
  index.tsx              the view: layout only, no state or effects of its own
  useGameController.ts   state, store access, derived values and handlers
  achievementList.ts     pure logic of the screen (tested)
  components/            what only this screen uses
    GameHeader.tsx
    AchievementCard/       index.tsx + useAchievementCardController.ts + GuideLinks.tsx
    Checklist/             index.tsx + useChecklistController.ts + ChecklistRow.tsx + PasteListDialog.tsx
```

- **View and controller.** `index.tsx` calls `useXController()` and renders what it returns. The controller owns `useState`, `useEffect`, store selection and handlers, and returns them named `isX` for booleans and `handleX` for actions.
- **Who gets a controller:** anything with state or effects. A component that only draws its props (`GameHeader`, `GameRow`, `ProgressBar`) is a single file with no controller.
- **Where a component lives:** used by one screen → that screen's `components/`; used by more than one → `ui/components/`. Move it up only when the second use appears.
- A component with parts is a folder with `index.tsx`; a simple one is a single `.tsx` file.
- Props are an interface named `I<Component>Props`, declared right above the component.
- Logic that needs no React goes into a plain function next to the screen (or into `shared/` when the main process needs it too) and gets a test.
- Forms add `schema.ts` to the folder (see Forms).

## Data sources

| Data                                                          | Source                                                      | Key? |
| ------------------------------------------------------------- | ----------------------------------------------------------- | ---- |
| Achievement list, hidden descriptions, counter target, rarity | `IPlayerService/GetGameAchievements` (in the app language)  | no   |
| Unlocked or not, and when                                     | `ISteamUserStats/GetPlayerAchievements`                     | yes  |
| Current counter values                                        | `ISteamUserStats/GetUserStatsForGame`                       | yes  |
| Which stat feeds each counter                                 | local file `appcache/stats/UserGameStatsSchema_<appid>.bin` | —    |
| Library and playtime                                          | `IPlayerService/GetOwnedGames`                              | yes  |
| Game art                                                      | `IStoreBrowseService/GetItems` (batched)                    | no   |
| Name and avatar in the onboarding; running game off Windows   | `ISteamUser/GetPlayerSummaries`                             | yes  |

Things that have already cost time:

- The public community profile page (`steamcommunity.com/profiles/<id>/?xml=1`) rate-limits requests (HTTP 429). The app used it to confirm a SteamID without a key and no longer does: the SteamID is confirmed together with the key, through the official API.
- The Web API does not say which stat feeds a counter; only the local Steam client file does. Without the file, the achievement shows no counter (never invent a value).
- Steam does not report which achievements belong to DLC (`groupid` is always 0) nor which items are missing in a "collect them all"; the user checklist exists for that.
- New games have no art at a fixed path (`header.jpg` returns 404); the hashed path comes only from the store service.
- Achievement icons must come from `shared.fastly.steamstatic.com/community_assets/images`. The older `steamcommunity/public/images` hosts return 404 for the icons of newer (DLC) achievements.
- A key error comes back as HTML with status 403; a private profile comes back as JSON with 403.

## Languages

- One file per language in `src/shared/i18n/locales/`. `en.ts` is the reference: the `Messages` type comes from it, so a new key starts there and the compiler flags whatever is missing elsewhere. Messages are strings or functions (`left: (n) => ...`) for interpolation and plurals; there is no translation library.
- New language: create the file and register it in `i18n/index.ts` with the name Steam uses (`steam`), the locale for dates and numbers (`locale`) and the store country.
- The language changes **the whole app**: texts and error messages (the main process translates with `SetupService.messages`), achievement names and descriptions and game art (requested from Steam in that language), and the suffix of guide searches.
- No user-facing text is hard-coded: in the interface use `const t = useT()`; in the main process, take `Messages` as a parameter. `SteamError` carries only the kind of error; the text comes from `steamErrorMessage(m, e)`.
- The language lives in `settings.json`. Changing it drops the translated cache (games, achievement lists, art); `cache.json` records which language it was read in and is dropped on startup if it does not match.
- In Settings, changing the language saves and **reloads the window**. In the onboarding the change is immediate, with no reload, because there is no Steam data on screen yet.
- The tab, the picked game and the already-seen running game are kept in `sessionStorage` by `navigationSlice` so the reload does not lose them.

## Forms (react-hook-form + zod)

The onboarding (`ui/screens/Onboarding/`) is a single multi-step form with three steps: Language, Account, Done.

```
Onboarding/
  index.tsx                  FormProvider + Stepper with the steps
  useOnboardingController.ts useForm, the watch subscription, the submit
  schema.ts                  onboardingSchema: one schema per step, and OnboardingFormData
  draft.ts                   what survives a reload (sessionStorage)
  components/                Stepper/ (index, stepperState, useStepper), StepHeader, FieldError,
                             ControlledLanguageSelect, HelpList
  steps/<Name>Step/          index.tsx + schema.ts (+ use<Name>StepController.ts when it has state)
```

- The controller owns the form: `useForm` with `zodResolver(onboardingSchema)`. `DoneStep` has no schema: it is the summary and the submit.
- Each step reads the form with `useFormContext<OnboardingFormData>()` and only advances after validating its own fields.
- **Stepper.** `stepperState.ts` is a pure, tested reducer holding the current step and the furthest one reached. It is local to the component on purpose (React's `useReducer`, not a store slice): the state is born and dies with the onboarding, and the `Stepper` stays a self-contained component. Do not move it to Zustand for uniformity. The step names at the top are buttons: any step already reached can be revisited in either direction, steps ahead stay locked. A step that changes something later steps depend on calls `lockFollowingSteps()` (through `useStepper`) so they must be reached again. Changing the language locks nothing.
- **The account step checks the SteamID and the key together.** A Web API key does not say whose it is, so the SteamID is still an input: detected from the Steam client (or taken from the saved setup) and shown locked, with "Use another account" as the way out. One "Verify" calls `checkApiKey` (key + SteamID against the official API, which returns name and avatar) and then `checkPrivacy`. There is no lookup of the public community profile any more: it was rate-limited and unreliable.
- **Verification is a form value.** `accountStep.verified` has no input: it is set when both checks pass and the schema requires it, so the form cannot be finished with a well-formed key that was never verified. Once verified, both fields are read-only; "Change" removes the value and locks the following steps.
- Errors from Steam about the pair (rejected key, unknown SteamID, private profile) are shown in the step, not under one field, because they are not about one field. Format errors stay under their field.
- Schemas hold the message **key** (`'steamIdFormat'`), not the text; `FieldError` translates it when rendering, so the error follows a language change. Every key used in a schema must exist under `validation` in the locales (there is a test for it).
- A field that is not a plain `<input>` becomes a controlled component with `useController` (e.g. `ControlledLanguageSelect`).
- Field side effects use the `form.watch` subscription (e.g. switching the screen language), always with `unsubscribe` on cleanup.
- The draft (language, SteamID and step) goes to `sessionStorage` to survive a reload. **The Web API key never goes into the draft**; after a reload the form resumes at the account step at most.
- Enter in a field does not submit the whole form: the step treats Enter as its own "advance".

## Optimistic UI

The screen never waits for something it can already show, and never keeps showing something that was not saved.

- **Optimistic update (writes).** Apply the change to the store at once, save afterwards, and on failure put back what is actually saved and tell the user with a toast (`sonner`, message `errors.changeNotSaved`). User data goes through `app/lib/saver.ts`, which batches the writes, remembers the last saved value per key and skips the rollback when a newer edit is waiting; `settings.toggleAlwaysOnTop` shows the same pattern for a single call. A new action that writes follows it: remember the previous value, apply, save, roll back in the `catch`.
- **No `pending` state on items.** Saves are local and take milliseconds, so marking an item as pending would only flicker. Revisit if a write ever goes to a remote server.
- **Optimistic read.** `Tracker.getGameStaleFirst` answers with the last known view, however old, and refreshes it in the background; the interface gets a `game-updated` event only if something changed. A game that was opened before never shows a loading state.
- **Skeletons are for first loads only:** `GameSkeleton` the first time a game is opened, skeleton rows the first time the dashboard loads.
- **Remote images** always go through `ui/components/RemoteImage` (never a bare `<img>` with a network URL): fixed-size box, skeleton while loading, fallback icon on failure. Each instance tracks its own load, so one image that fails or lags does not affect the others.

## Read policy (do not fire requests for nothing)

- **Opening a game** serves the cached view at once (see Optimistic UI); a view older than 60 s triggers one background refresh.
- **Game open:** every 60 s it re-reads only the player state (and counters, if the game has them). The achievement list is cached for 24 h; the ↻ button forces everything.
- **No change, no event:** `Tracker.getGame` returns the same object when nothing changed, and the main process only emits `game-updated` when the object is a different one.
- **Dashboard:** loads on startup, on ↻ (`all`) and when a game closes (`changed`: only games whose playtime changed).
- **Identical simultaneous requests** share one read (`Tracker.once`).
- The periodic checks live in `GameWatcher` (running game every 10 s, unlocks every 60 s). Where the running game comes from the Web API, that check reaches Steam at most every 30 s.
- **Update check:** one check when the app opens and then at most every six hours (an hourly timer asks whether they have passed); a version being downloaded or already downloaded is not looked for again. A window reload does not check.
- **Art and names** are cached on disk; a store failure never takes the screen down.

When touching this, measure before and after: count HTTP and IPC calls on startup, while idle and when switching tabs.

## Interface state (Zustand)

A single store in `src/renderer/src/app/store/`, split into namespaced slices:

```
store/
  Store.ts              the Store type (one field per slice) and the StoreSlice<T> type
  index.ts              create() with the devtools (dev only) and immer middlewares
  connect.ts            wires the store to the main process events once the app is set up
  slices/
    sessionSlice.ts       language, current game and failure counter
    settingsSlice.ts      app state from the main process, always on top, preferences, data folder,
                          list order, language change, erase
    navigationSlice.ts    current tab, Pending/Unlocked list, game picked in the dashboard, redoing the setup
    gamesSlice.ts         game views already read, by appid
    userDataSlice.ts      notes, pins and checklists
    dashboardSlice.ts     dashboard
    updatesSlice.ts       new versions: the check as the app opens, download progress, the restart
```

Conventions:

- Each slice declares `XStore` (data), `XActions` (actions) and `XSlice = XStore & XActions`, and exports `createXSlice: StoreSlice<XSlice>`.
- State is namespaced: `state.games.entries`, `state.dashboard.load`. A slice can read and change another one through the whole-store `get()`/`set()`.
- Actions mutate the Immer draft directly (`prevState.games.entries[appid].loading = true`) and pass a name for the devtools: `set(fn, false, 'games/load')`.
- Slices reach the main process through `@app/services`, never through `window.api`.
- Controllers read state and actions together with `useStore(useShallow(state => ({ ... })))`. Default values inside the selector must be stable constants (e.g. `NONE_UNLOCKED`), otherwise the component re-renders every time.
- **A preference the main process acts on** (remembering the window) is an `IPreferences` field: add it to `shared/types/Preferences.ts` with its default, and `Store.getPreferences` / `setPreference` and `settings.setPreference` carry it with no further wiring. It gets a `Switch` row in Settings.
- Do not use `persist`: what must survive closing the app is written by the main process (`main/storage/Store.ts`). The navigation slice keeps the tab and the picked game in `sessionStorage` only so they survive the window reload of a language change.
- Where a piece of screen state lives depends on how long it should last:
  - only while the screen is mounted (search text, an open field) → `useState` in the controller;
  - across games and the reload of a language change (current tab, Pending/Unlocked list and hidden-only filter of a game, In progress/Complete list of the dashboard, picked game) → `navigationSlice`, mirrored in `sessionStorage`;
  - across restarts, because it is a preference (order of each list, always on top, language) → `settingsSlice`, saved by the main process in `settings.json`.
- There is no router: `navigationSlice` holds the tab and `AppShell` draws it. The Game and Dashboard tabs stay mounted; switching tabs only hides the other one.
- Edits to notes and checklists update the screen right away and are written half a second later (`app/lib/saver.ts`), with a flush when the window closes.
- `connectStore` drops what was read from Steam when the app leaves the configured state; language, settings and navigation are kept.

## Interface

- Tailwind v4 (config in `src/renderer/src/ui/styles/index.css`, no `tailwind.config`) + shadcn/ui components + Lucide icons. New shadcn component: `pnpm dlx shadcn@latest add <name>` (it lands in `ui/primitives`); the command tends to install a wrong `cn` package and import from it: remove it with `pnpm remove cn` and point the import to `@ui/utils/cn`.
- Dark theme only, with the Steam palette in the tokens in `ui/styles/index.css` (`--primary` light blue, `--success` green, `--warning` amber).
- The window is narrow (600 px wide, for a second monitor, and never under 480): check that toolbars and buttons fit that width **in every language**. Spanish and French labels are the longest; the Game toolbar is the tightest row. A row that cannot fit wraps, with the sort select taking the whole second row.
- Lightness is the priority: no library with runtime styling.

## Accessibility

An automated audit (axe) of every screen reports zero violations; keep it that way.

### A feature is not done until it was audited in the running app

Tests passing is not the end of a change that touches the interface. Every new or changed screen, section or control is audited in the running app before it is reported as done, and the report says what was audited and what was not. This was written down after details shipped that no test could catch: a hover wash wider than its section, a second scrollbar, a line drawn twice, a screen captured that was not the one meant.

1. **Run `pnpm audit:ui`** (`scripts/audit-ui.mjs`). It builds the app and runs it for real against a **fake Steam** (`scripts/fake-steam.mjs`), a local server that answers the Web API's calls from the real responses in `test/fixtures` and lets the audit change what "Steam" says, and against a fake Steam client folder. Nothing of this computer's account, key or data is read, and the result is the same on every run. **The audit runs once per language, as a new user each time**, so everything on screen is in that one language from the first screen on: interface, errors, and the achievement names and descriptions, which the fake Steam answers in the language asked for (the audit fails when a name on screen is not Steam's in that language). In each language it:
   - **goes through the onboarding**, picking the language on its first screen, with the SteamID found in the Steam client and locked, and Steam rejecting the key, being unreachable and hiding the profile before it accepts, up to the Done step;
   - **checks every screen** (Game, the open game details, Dashboard, Settings top and end): accessibility with axe; no scrollbar on the window itself and nothing overflowing sideways; a visible change on hover and on keyboard focus for every kind of clickable element (both states are forced and the computed styles compared); and no clickable element wider than what contains it, which is how a hover wash spills out of its row;
   - **makes the interface fail to draw** and checks the crash screen like any other, that the error reached `logs/errors.log`, and that "Reload" brings the app back.

   Then, in the first language only, **the flows no single capture shows**: "Use another account" opening the SteamID for typing; the game details animating open and closed (the height is sampled on every frame) and leading to each achievement they name with the hidden-only filter on; a game starting (the app switches to it by itself, from another tab); an achievement unlocked while playing, which the app has to notice with nobody touching it (it leaves the pending list, the notice names it, the header counts one less); the last one being unlocked (the completion state); the game closing (it stays on screen as the last one played); and Steam going off the air with the app open (what is on screen stays, with an error), before it opens (the app comes up with what it had), and before it opens with nothing cached (both tabs say Steam could not be reached, never that nothing was played, and the app recovers when Steam is back). `AUDIT_LANGUAGES=fr pnpm audit:ui` runs one language while working on it; the full run is what counts.

2. **Add the new thing to the script** when the audit cannot reach it as it is: a new screen, a section that has to be opened, a state behind a click. A feature the audit never opens has not been audited. Two kinds of thing always get a flow check of their own: **a control that opens something is audited in both directions**, and **a shortcut that leads to an item is audited with every filter that could hide the item turned on**.
3. **Prove a new check can fail**: undo the fix it is meant to guard, run the audit, see it fail, restore. A check that was only ever seen passing may be checking nothing.
4. **Look at the captures** it saves to `.audit-ui/`, every one that the change could have touched. The checks pass on whatever is on screen, so a capture of the wrong screen is the only sign that the script went astray; it has happened more than once.
5. **Check by eye what no script measures**, on those captures: lines and separators (one between two things, never two in a row and none at the end of a group), alignment of text with the page margin, spacing between groups, text that wraps or is cut in Spanish and French, and anything said twice on the same screen.
6. **Open by hand what the script does not**: dialogs, the update screen, a finished game, toasts, and the pressed state. Say in the report which of these were not opened.

**The audit runs on a developer's machine only.** It is not part of CI nor of the commit and push hooks: it takes several minutes, needs a display and fetches pictures from Steam.

**The fake Steam is reachable in development only.** `main/index.ts` reads `TROPHY_TRACKER_FAKE_STEAM` (and `TROPHY_TRACKER_FAKE_STEAM_HOME`, the home folder holding the fake Steam client) when the app is not packaged; an installed app ignores both, because the user's key is sent to whatever address that is. In that mode the app behaves as on Linux whatever the system: the signed-in account and the stat that feeds each counter come from the fake client folder (`writeFakeSteamFolder`), the running game comes from the fake Web API, and the periodic checks run every two or three seconds instead of every ten and sixty, so the audit does not wait a minute for an unlock. What the fake still does not stand in for: the pictures (art and icons are fetched from Steam's real servers, so without internet the audit only notes that the art did not load), GitHub (the update check always finds nothing) and the Windows registry.

### Rules

- **Nothing clickable is a raw element.** Use `Button` (primitive), `IconButton` (icon only), or `Pressable` (the base of hand-made clickables such as tabs and rows). They carry the keyboard focus ring and the disabled state; a raw `<button>` or `<select>` in `ui/` fails the lint. The pointer cursor comes from a global rule in `styles/index.css`.
- **Every clickable has three visible states besides rest:** hover (normally a background tint, `hover:bg-accent/40`), pressed, and keyboard focus. The pressed state comes from a global rule (`scale: 0.96` while `:active`); wide elements such as rows and cards tone it down with `active:scale-[0.99]` and darken instead, and list options use a tint (`active:bg-primary/25`).
- In the dark theme a `dark:` background class can silently cancel a `hover:` one; give it a `dark:hover:` too (that is why the destructive button and the select options were hand-edited in `primitives/`).
- Red text on the usual hover tint fails contrast: a destructive ghost button hovers with a red tint (`hover:bg-destructive/15`).
- **Icon-only buttons** use `IconButton`, whose `label` is mandatory: it is both the accessible name and the tooltip. Explain other controls with `Hint`, never with the native `title` (it is slow and does not show on keyboard focus).
- **State is announced, not just drawn:** `aria-pressed` on toggles (Segmented, pin, always on top, hidden only), `aria-current="page"` on the current tab, `aria-expanded` on what opens a section.
- **Selects** go through `OptionSelect`, whose `label` is mandatory. Its list is drawn inside the page; a native `<select>` opens an OS-level popup that is slow to close under WSLg and cannot be themed, so it is forbidden by lint.
- **Structure:** one `<main>` per window, `<nav>` with a label, and headings in order (`h1` for the screen, `h2` inside it).
- **Motion** is turned off globally under `prefers-reduced-motion`; do not add animation that bypasses it.

### Motion

Transitions are CSS only (no animation library), short and small: the app sits next to a game and is read at a glance. The tokens are in `ui/styles/index.css`.

- `animate-screen-in` (fade + 6 px rise, 180 ms) on a main tab when it is shown.
- `animate-list-in` (fade, 160 ms) on a list keyed by its filter, so switching Pending/Unlocked or In progress/Complete fades the new list in.
- `animate-step-forward` / `animate-step-backward` (20 px slide, 200 ms) on onboarding steps; `Stepper` tracks the direction.
- `collapsible` on a section that opens in place (the game details, a card's checklist and note): it grows to its height when it opens and shrinks back when it closes. Use it through `ui/components/Collapsible`, which keeps the section mounted only while the closing transition runs and then takes it out of the page. That is what lets an exit be animated without a library and without keeping 80 closed checklists alive.
- An animation that moves an element makes it overflow its parent while it runs. The parent must clip it (`overflow-hidden` on `<main>` in `AppShell`), or the window gets a scrollbar for the length of the transition.
- **What opens in place closes the same way.** A section that animates open and then vanishes when closed reads as broken; `Collapsible` covers that case. Screens, lists and steps still animate only their entry: animating their exit would need the old one to outlive its state, which is what an animation library is for; add one only if that becomes a real need.
- An element shown only on hover must also show on keyboard focus (`focus-visible:opacity-100`).
- After changing a screen, audit it in the running app, element by element and in every state (lists open, dialogs open, sections expanded): pointer cursor, accessible name, reachable by keyboard, and a visible change on hover, on press and on keyboard focus. Forcing the `:hover`, `:active` and `:focus-visible` states through the DevTools protocol and comparing computed styles does this reliably; park the mouse pointer first, or a really hovered element hides a missing hover style. Then run axe.

## Local data

`~/.config/trophy-tracker/` (`%APPDATA%\trophy-tracker` on Windows, `~/Library/Application Support/trophy-tracker` on macOS): `config.json` (SteamID and key, permission 600; encrypted only if there is a keyring), `cache.json`, `userdata.json` (notes, pins, checklists), `settings.json` (language, always on top, list orders, the window's size and position). Never copy the key out of that folder or print it.

## Tests

- **What is tested:** main-process and `shared/` logic, the pure logic of the screens (`achievementList`, `gameList`, step schemas, `stepperState`, `saver`) and the store slices that hold logic (`updatesSlice`, `settingsSlice`, `userDataSlice`). Views and controllers are validated by running the app. A behaviour change in a main-process service, `steam/client`, `storage/Store` or `shared/` comes with a test.
- **One test file per unit, mirroring `src/`:** `src/main/services/Tracker.ts` is tested by `test/main/services/Tracker.test.ts`; interface logic goes under `test/renderer/` following the path after `src/renderer/src/`. A new unit gets its own file; do not append to a neighbour's.
- **Tests import through aliases:** `@main/*`, `@shared/*`, `@app/*`, `@ui/*` for the code and `@test/*` for helpers, factories and fixtures. `@main` and `@test` exist for tests only; the main process itself keeps using relative imports.
- **One behaviour per test**, written as arrange, act, assert, with a blank line between the three when there is more than a line of each. A test that needs a second scenario is two tests. The name is a plain sentence about the behaviour (`'reports a later release'`), with no "should".
- **`it.each` for the same check over several inputs**, with the case in the name (`'sorts the pending list by $sort'`).
- **Factories in `test/factories/`** (`makeAchievement`, `makeGameView`, `makeGameSummary`, `makeAppInfo`): each returns a valid object and takes only what the test is about. Do not rebuild these objects by hand in a test file; a file may wrap a factory when all its tests share a default (`rarity: 50`).
- **Fakes, not mocks:** services receive fakes through the constructor (`fakeFetch` in `test/helpers.ts`, a fake updater, an injected clock) and tests assert on results, not on which method was called. No mocking library. `vi.fn` is fine for a callback whose calls are the result.
- **Code that calls the system takes it as a dependency, defaulting to the real thing:** the functions of `steam/windows.ts` take the command runner as their last argument, `createSteamLocal` takes the disk and the registry, and `storage/secureCipher.ts` takes Electron's storage (`createCipher.ts` is the one-line wrapper that passes it). New code that runs a command, reads the disk or uses an Electron API follows the same shape, so it can be tested on any machine.
- **Store slices are tested against a fake main process:** `test/renderer/app/store/makeStore.ts` builds a fresh store with a fake `window.api` and `sessionStorage`; a call the test did not provide throws. These tests have their own TypeScript project (`tsconfig.webtest.json`), because the store uses browser types. `sonner` is the one module that is mocked, to see what was announced to the user.
- **Fixtures are real responses** (`test/fixtures`: Nioh 3 and Onimusha: Way of the Sword). The achievement lists exist in the four languages (`.en`, `.es`, `.fr`; the file without a suffix is Brazilian Portuguese), which is what lets the fake Steam of the audit answer in the app's language.
- **Coverage:** `pnpm test:coverage` measures what is listed above (the Electron-only wiring and the texts are excluded in `vitest.config.ts`, with the reason). CI fails under the thresholds set there; they sit a little below the current numbers and only go up. The commit hook runs the tests without measuring; the push hook runs `pnpm test:coverage`, so a drop in coverage is stopped before it leaves the machine.
- **100% is not the goal.** Coverage shows where there is no test at all; it does not show whether a test checks anything. What to test follows risk: code that decides something for the user (what is saved, when the app restarts, what is announced) comes first. A branch that can only be reached by breaking the machine is left alone rather than covered with an artificial test. Known and accepted: the rare numeric types of `steam/vdf.ts`, until a game uses them.
- **Console output** of passing tests is hidden (`--silent=passed-only`); a failing test shows everything it printed. `test:watch` hides nothing, since that is where `console.log` is used to debug.
- **Module cache:** a run made by hand reuses transformed modules (`fsModuleCache`, stored in `node_modules/.vitest-cache`). The hooks and the CI set `CI`, which turns the cache off, so nothing is committed or pushed on the strength of a stale cache. If a manual run behaves oddly, delete that folder.

## Commits

- Commit at the end of every requested change, without asking, one commit per change. Local commits only: pushing or sending anything outside depends on an explicit request.
- Conventional Commits in English: `feat: achievement checklist`, `fix: ...`, `chore: ...`, `docs: ...`, `refactor: ...`, `perf: ...`, `style: ...`, `test: ...`. commitlint checks it; header and body lines stay within 100 characters.
- Husky hooks run on every commit: lint-staged (ESLint with auto-fix, then Prettier, on the staged files), then `pnpm typecheck` and `pnpm test` for the whole project, then commitlint on the message. Another hook runs `pnpm test:coverage` before every push. Never skip them with `--no-verify`; fix what they report.
- Purely mechanical commits (mass formatting, import sorting) go into `.git-blame-ignore-revs`.
