# Trophy Tracker

Desktop app (Electron + React + TypeScript) that shows, for the game open on Steam, which achievements are missing, what the hidden ones are, progress counters, user checklists and shortcuts to guides. It runs natively on Windows, macOS and Linux, and is developed on WSL.

**Language rules:** everything in the repository is written in English: code, comments, test names, docs and commit messages. The interface ships in four languages, **English (default), Brazilian Portuguese, Spanish and French**; text in another language belongs only in its file under `src/shared/i18n/locales/` (`pt-BR.ts`, `es.ts`, `fr.ts`) and in test data that checks that locale. The user talks to you in Portuguese; answer in Portuguese.

## Commands

```bash
pnpm dev         # app with reload (window through WSLg)
pnpm build       # builds into out/
pnpm start           # runs the build
pnpm test            # Vitest
pnpm typecheck   # tsc on both projects (main process and interface)
pnpm lint        # ESLint (lint:fix to auto-fix)
pnpm format      # Prettier (format:check to only verify)

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
| Notification                    | Electron (PowerShell toast on WSL)                 | Electron                                                    |
| Opening links                   | Electron (`rundll32.exe` on WSL)                   | Electron                                                    |

- `steam/local.ts` builds `ISteamLocal` (registry or files) once; services receive it and never ask which system they are on. `services/runningGame.ts` picks the registry when there is one and the Web API otherwise, reusing the last answer when a call fails so a network hiccup does not look like the game closing.
- `steam/windows.ts` is the Windows side. On WSL it calls the same `.exe` files through interop (`reg.exe`, `rundll32.exe`, `powershell.exe`); WSL is recognised by the kernel name **and** `WSL_DISTRO_NAME`, so a container on a WSL host counts as plain Linux.
- `system/notify.ts` and `system/browser.ts` hide the WSL detour (Electron notifications inside WSLg never show up, and links must open in the Windows browser).
- The Web API only reports the running game when the profile shows it; on macOS and Linux a profile that hides the game status simply never switches games on its own.
- The data folder is `trophy-tracker` on every system (set in `main/index.ts`); `storage/migrateUserData.ts` moves the files of the old `steam-trophy-tracker` folder once.
- A second launch focuses the open window (`requestSingleInstanceLock`).

## Packaging and releases

- **electron-builder**, configured in `electron-builder.yml`: NSIS installer for Windows, dmg for macOS (Intel and Apple Silicon), AppImage and deb for Linux. Everything the app runs is bundled into `out/` by electron-vite, so **every dependency is a devDependency** and no `node_modules` go into the package; a new runtime dependency goes to `devDependencies` too.
- **Not signed yet.** Windows shows the SmartScreen warning, or refuses the installer outright under Smart App Control (see below); macOS uses an ad-hoc signature (`identity: '-'`, without it an Apple Silicon Mac refuses to start the app) and the user has to allow the app in System Settings. Revisit if the app is published for real.
- **`deb.depends` is written out** because the default list misses libraries a minimal system lacks (`libgbm1`); it was found by installing the package in a clean container, which `pnpm test:package` repeats (`scripts/package-test/`).
- **Docker builds and tests, it does not run the app for the user:** `scripts/docker-dist.sh` builds the Linux and Windows installers in a container (the image brings Wine), and the package test installs the deb under a virtual display. macOS installers can only be built on macOS.
- **GitHub Actions:** `ci.yml` checks formatting, lint, types, tests and the build on every push; `release.yml` runs on a `v*.*.*` tag (which must match `version` in `package.json`), builds the installers on the three systems and, when all three succeed, **publishes** the release with the installers and the update metadata (`latest*.yml`, block maps).
- **New versions reach the user in two ways**, decided by `system/autoUpdate.ts`:
  - **Windows and the Linux AppImage update themselves** (`electron-updater`): the new version downloads in the background and Settings offers "Restart to update". Nothing restarts or installs on its own (`autoInstallOnAppQuit` is off).
  - **macOS and a .deb install only get a notice** with a button to the download page: macOS accepts updates only from apps signed with an Apple certificate, and a .deb needs the administrator password. `services/UpdateChecker.ts` asks GitHub for the latest release at most every six hours.
  - `services/AppUpdates.ts` joins the two and falls back to the notice whenever the automatic path fails. "Check for updates" in Settings (`checkNow`) ignores the six-hour wait and gives the automatic path another chance. In both cases the gear icon gets a dot. A failure to check (offline, no release) means "nothing new".
- **Smart App Control blocks unsigned installers** (found the hard way: 0.1.0 and 0.2.0 installed, 0.3.0 was refused by the same machine). With it on, Windows runs an unsigned executable only if Microsoft's reputation service accepts it, which cannot be predicted, and there is no per-app exception. So on Windows, when Smart App Control is enforcing and the running app is unsigned (`isInstallBlockedBySystem` in `system/autoUpdate.ts`), the app does not download or restart: the notice says the system would block the install (`updateStatus: 'blocked'`). The check looks at the signature of the running app, so it stops applying by itself once the installers are signed.
- **Signing plan:** free signing for open source through SignPath Foundation (hence the MIT license and the "Code signing policy" and "Privacy" sections of the README, which their terms require). It needs their approval, and every signed release then needs a manual approval, so releases will stop being fully automatic.
- **What protects the update:** the installers are not signed, so the only guarantee is the hash in `latest*.yml`, published in the same release. Whoever can publish a release controls what users install; that is why the `v*` tags are protected on GitHub (only the owner creates, moves or deletes them) and `main` refuses force-pushes.
- To release: bump `version` in `package.json`, commit, push, then tag `vX.Y.Z` and push the tag. An app can only update itself to a version newer than the one that introduced the updater (0.2.0).

## Production behaviour

- **Errors are logged locally, never sent anywhere:** `system/errorLog.ts` writes to `logs/errors.log` in the data folder (rotated at 512 KB). The main process logs uncaught exceptions and rejections; the interface reports its own through `SystemService.logError` (`app/lib/reportUnhandledErrors.ts` and `ui/components/ErrorBoundary`).
- **A render error does not leave a blank window:** `ErrorBoundary` wraps the app and shows `CrashScreen` with a reload button.
- **Code only needed sometimes is loaded lazily:** the onboarding is loaded with `app/lib/namedLazyLoad.ts` inside `Suspense`.
- The interface bundle is minified (`electron.vite.config.ts`).

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
  validation.ts          SteamID and key formats
  i18n/                  languages: index.ts (registry) and locales/ (one file per language)

src/main/              main process: the only part that talks to Steam and to the disk
  index.ts               composition root: builds each piece once and wires them together
  window.ts              MainWindow: the single window and the events pushed to it
  ipc/registerIpc.ts     answers IApi; handlers only route, the work lives in the services
  services/
    Tracker.ts             reads games and the dashboard: cache, deduplication, art
    SetupService.ts        setup state, language, and the checks that get the app set up
    GameWatcher.ts         follows the running game and announces unlocked achievements
    runningGame.ts         which game is running: registry, or the Web API where there is none
    UpdateChecker.ts       asks GitHub whether a newer version was released
    AppUpdates.ts          self-update where the system allows it, the notice elsewhere
    onboardingChecks.ts    key + SteamID and privacy checks against Steam
  steam/                 client.ts (Web API), achievements.ts (buildGameView, guideUrl),
                         local.ts (ISteamLocal: what the installed Steam client tells),
                         windows.ts (registry and WSL interop), steamFiles.ts and textVdf.ts
                         (Steam folder on macOS and Linux), vdf.ts (binary cache reader)
  storage/               Store.ts (JSON persistence), createCipher.ts (key encryption),
                         migrateUserData.ts (one-off move from the old data folder)
  system/                browser.ts (links), notify.ts (notifications), errorLog.ts (local log),
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
    screens/             one folder per screen: Game, Dashboard, Settings, Onboarding
    components/          shared between screens: AppShell, Pressable, IconButton, Hint, OptionSelect,
                         RemoteImage, ProgressBar, Segmented, SearchBox, Empty, ErrorBoundary, CrashScreen
    primitives/          shadcn/ui components (generated; do not hand-edit without a reason)
    styles/index.css     Tailwind and the theme tokens
    utils/               cn, text (accent-free search), format (dates and numbers)

test/                  Vitest, with real API responses in test/fixtures
```

### Path aliases

- `@app/*` → `src/renderer/src/app/*` and `@ui/*` → `src/renderer/src/ui/*` (interface only)
- `@shared/*` → `src/shared/*` (interface, main process and preload)

Import through the alias, except for files inside the importing file's own folder (`./useGameController`, `./components/GameHeader`). Tests use relative paths.

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
- The language changes **the whole app**: texts, error messages and the notification (the main process translates with `SetupService.messages`), achievement names and descriptions and game art (requested from Steam in that language), and the suffix of guide searches.
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
- **Update check:** one check on startup and then at most every six hours; a version already downloaded is not looked for again.
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
    settingsSlice.ts      app state from the main process, always on top, list order, language change, erase
    navigationSlice.ts    current tab, Pending/Unlocked list, game picked in the dashboard, redoing the setup
    gamesSlice.ts         game views already read, by appid
    userDataSlice.ts      notes, pins and checklists
    dashboardSlice.ts     dashboard
```

Conventions:

- Each slice declares `XStore` (data), `XActions` (actions) and `XSlice = XStore & XActions`, and exports `createXSlice: StoreSlice<XSlice>`.
- State is namespaced: `state.games.entries`, `state.dashboard.load`. A slice can read and change another one through the whole-store `get()`/`set()`.
- Actions mutate the Immer draft directly (`prevState.games.entries[appid].loading = true`) and pass a name for the devtools: `set(fn, false, 'games/load')`.
- Slices reach the main process through `@app/services`, never through `window.api`.
- Controllers read state and actions together with `useStore(useShallow(state => ({ ... })))`. Default values inside the selector must be stable constants (e.g. `NONE_UNLOCKED`), otherwise the component re-renders every time.
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
- `expand-in` on a section that opens inside a card (checklist, note): it grows to its height instead of popping in.
- An animation that moves an element makes it overflow its parent while it runs. The parent must clip it (`overflow-hidden` on `<main>` in `AppShell`), or the window gets a scrollbar for the length of the transition.
- Only entries are animated. Animating exits would need the element to outlive its state, which is what an animation library is for; add one only if that becomes a real need.
- An element shown only on hover must also show on keyboard focus (`focus-visible:opacity-100`).
- After changing a screen, audit it in the running app, element by element and in every state (lists open, dialogs open, sections expanded): pointer cursor, accessible name, reachable by keyboard, and a visible change on hover, on press and on keyboard focus. Forcing the `:hover`, `:active` and `:focus-visible` states through the DevTools protocol and comparing computed styles does this reliably; park the mouse pointer first, or a really hovered element hides a missing hover style. Then run axe.

## Local data

`~/.config/trophy-tracker/` (`%APPDATA%\trophy-tracker` on Windows, `~/Library/Application Support/trophy-tracker` on macOS): `config.json` (SteamID and key, permission 600; encrypted only if there is a keyring), `cache.json`, `userdata.json` (notes, pins, checklists), `settings.json` (language, always on top). Never copy the key out of that folder or print it.

## Tests

- Main process and `shared/` logic is tested, as is the pure logic of the screens (`achievementList`, step schemas, `saver`); views and controllers are validated by running the app.
- `test/helpers.ts` has the route-based `fakeFetch`; fixtures are real responses (Nioh 3 and Onimusha: Way of the Sword).
- A behaviour change in a main-process service, `steam/client`, `storage/Store` or `shared/` comes with a test. Services are tested with fakes passed to the constructor (see `test/gameWatcher.test.ts`).

## Commits

- Commit at the end of every requested change, without asking, one commit per change. Local commits only: pushing or sending anything outside depends on an explicit request.
- Conventional Commits in English: `feat: achievement checklist`, `fix: ...`, `chore: ...`, `docs: ...`, `refactor: ...`, `perf: ...`, `style: ...`, `test: ...`. commitlint checks it; header and body lines stay within 100 characters.
- Husky hooks run on every commit: lint-staged (ESLint with auto-fix, then Prettier, on the staged files), then `pnpm typecheck` and `pnpm test` for the whole project, then commitlint on the message. Never skip them with `--no-verify`; fix what they report.
- Purely mechanical commits (mass formatting, import sorting) go into `.git-blame-ignore-revs`.
