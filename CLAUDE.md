# Trophy Tracker

Desktop app (Electron + React + TypeScript) that shows, for the game open on Steam, which achievements are missing, what the hidden ones are, progress counters, user checklists and shortcuts to guides. It runs natively on Windows, macOS and Linux, and is developed on WSL.

**Language rules:** everything in the repository is written in English: code, comments, test names, docs and commit messages. The interface ships in four languages, **English (default), Brazilian Portuguese, Spanish and French**; text in another language belongs only in its file under `src/shared/i18n/locales/` (`pt-BR.ts`, `es.ts`, `fr.ts`), in test data that checks that locale, and in `README.pt-BR.md`, the Portuguese copy of the README: **a change to one README goes into both**. The user talks to you in Portuguese; answer in Portuguese.

This file holds the rules. The reasons behind the choices that are not obvious, and what was tried before, are in `docs/DECISIONS.md`: read the entry before undoing one, and add an entry when a choice is made that someone could reasonably want to undo. The longer accounts of how a part works are in `docs/` (`releases.md`, `audit.md`, `onboarding-form.md`, `store.md`, `storybook.md`); each section here says when to read which.

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
pnpm screenshots # retakes the pictures of the README (docs/screenshots/), from the app on demonstration data
pnpm audit:ui    # builds the app, runs it against a fake Steam and audits every screen and flow
pnpm storybook   # the catalogue of components, on http://localhost:6006 (build-storybook builds it into storybook-static/)

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
- The data folder is `trophy-tracker` on every system (set in `main/index.ts`).
- A second launch focuses the open window (`requestSingleInstanceLock`).
- **Windows and macOS have no title bar** (`system/windowFrame.ts`): the system draws only its own buttons, over the app's tab bar, so snapping and the maximise menu keep working. The interface never asks which system it is on: CSS learns where the buttons are from `env(titlebar-area-*)` (the `window-drag`, `window-buttons-inset`, `window-bar` and `h-below-window-bar` utilities in `ui/styles/index.css`), and the fallbacks leave Linux, which keeps the system's title bar, as it was. The tab bar drags the window; a screen without it (onboarding, update, crash) starts with `ui/components/WindowBar`, the strip the window is dragged by. Whatever is added to the tab bar must fit beside the system's buttons at 480 px in French, the tightest case (138 px of buttons on Windows).

## Packaging and releases

How it all works, and why, is in `docs/releases.md`: **read it before touching** `electron-builder.yml`, the workflows, `scripts/publish-release.sh` or anything about updates. The rules:

- **Nothing is pushed, tagged or published without an explicit request.** A `v*.*.*` tag publishes a release by itself (`release.yml`), and installed apps update from it.
- To release: write the version's section in `CHANGELOG.md` (what changed for whoever uses the app, not what changed in the code; the release shows it, and a version with no section is not published), bump `version` in `package.json`, commit, push, wait for CI, then tag `vX.Y.Z` (it must match `version`) and push the tag.
- **No `node_modules` go into the package**: everything is bundled into `out/`. A package imported by `src/` goes into `dependencies`, tooling into `devDependencies`.
- **Installer names say the system** and are set in three places that change together: `electron-builder.yml`, `scripts/publish-release.sh` and `downloadUrl` in `services/releases.ts`.
- **The app never restarts by itself while in use**: only as it opens, before anything was shown; otherwise it asks. An install that failed is never tried automatically again (`updateAttempt`).
- **Installers are not signed yet.** Windows with Smart App Control refuses them, so there the app does not download (`updateStatus: 'blocked'`); macOS only gets a notice with the download.
- `ci.yml` runs format, lint, types, tests with coverage and the build on Linux, and the tests again on Windows and macOS. A test must not assume a path separator or permission bits.

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
  types/                 one file per entity: Achievement, Game, Profile, Account, Check, AppState,
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
    SetupService.ts        setup state, language, the accounts and the checks that get one in
    accountFollower.ts     keeps the app on the account signed in to the Steam client
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
  system/                browser.ts (links), errorLog.ts (local log), dataFolder.ts, windowBounds.ts,
                         windowFrame.ts (title bar or only the system's buttons, per system),
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
                         UpdateReadyDialog, DetailList (DetailGroup and DetailRow), Switch, Collapsible, WindowBar,
                         AccountCard (and AddAccountCard), AccountStatus, MaskedKey, KeyField, ConfirmDialog, Notice
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

## Accounts

The app keeps several Steam accounts and follows one at a time. An account is a SteamID, the name and avatar Steam gave for it, and its own Web API key.

- **Everything read or written is per account.** `storage/Store.ts` keeps, by SteamID: the key (`config.json`), the library, game views and summaries (`cache.json`), and the notes, pins and checklists (`userdata.json`). Achievement lists and art describe the game, not the player, and are shared.
- **A read belongs to the account it started for.** `Tracker` hands each result to the store with the SteamID it was read with, and shares in-flight reads per account, so a switch in the middle of a read never files one account's data under another. A result for an account that was removed lands nowhere.
- **The key never reaches the interface.** `IAccount` carries its last four characters (`keyEnding`) and nothing else; `ui/components/MaskedKey` is the only way a saved key is shown. There is no reveal and no copy. A key goes in through `KeyField` and is forgotten by the interface as soon as it is saved.
- **Status of a key** (`AccountStatus`): `valid`, `rejected`, `rateLimited`. Steam answers a revoked key and a mistyped one the same way (403 as HTML), so there is one "rejected". `SetupService.attempt` records what each read says about the key in use and tells the interface (`state-changed`) only when it is news. **A rejected key no longer sends the user back to the setup:** the app stays open with what it had, `AppShell` shows `KeyTroubleNotice` over the Game and the Dashboard, and "Replace key" in Settings fixes it. The onboarding only shows when there is no account at all.
- **Switching** (`settings.switchAccount`) flushes pending note edits first, since they belong to the account being left. `useAppController` runs `connectStore` again for each account: what was read for one goes off the screen and the other is loaded, instantly when it has a cache.
- **The app follows the account signed in to Steam** where the client says who that is without being asked (the registry, so Windows and WSL): `services/accountFollower.ts` switches when the client's account changes, and once as the app opens, and a toast says so. It acts on a change only, so an account picked by hand is not taken back. On macOS and Linux the switch is manual.
- **One card per account.** Settings lists the accounts as `AccountCard`s: the one in use has the accent border and opens, inside the card, its masked key with "Replace key" and "Remove account" (`Settings/components/AccountDetails`); any other card is one button that switches to it. Nothing about an account is drawn outside its card.
- **A card keeps its shape when the account in use changes.** `AccountCard` is drawn the same way in use or not; what makes another account clickable is a button laid under the card's content. The same goes for anything whose state flips between "is a button" and "is not": change what is inside, not the element.
- **Adding and removing.** The dashed card at the end of the list opens the onboarding with only its account and final steps (`navigation.isAddingAccount`), the form already open; the account just added becomes the one in use. A SteamID that is already saved is refused. Removing an account deletes its key, its cache and its notes, and the dialog says so by name; removing the last one leads back to the onboarding.
- **In the setup, everything about accounts happens in the account step.** An account Steam accepts is saved at once and joins a list of cards above the form, which closes into "Add another account", and the step's forward button enters the app: there is no step after it. The first setup ends on the account signed in to Steam, or the first added. An account added in that visit can be taken out again in one click; an older one cannot, because it may have notes and Settings asks first.

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

The setup (`ui/screens/Onboarding/`) is one form in two steps: Language, then Account. How it is built is in `docs/onboarding-form.md`: **read it before changing the form.** The rules:

- The controller owns the form (`useForm` with `zodResolver`); each step reads it with `useFormContext` and only advances after validating its own fields.
- Schemas hold the message **key**, not the text, so an error follows a language change. Every key used in a schema exists under `validation` in the locales (there is a test).
- **Everything about accounts happens in the account step.** An account Steam accepts is saved at once and leaves the form for the list above it, and the step ends the setup. A step that asks nothing and decides nothing is not a step: a summary was removed for that.
- **The Web API key lives only in its field while it is typed**: it is not kept in `sessionStorage` or anywhere else, and a saved key is never put back on screen.
- The `Stepper`'s state is local to the component (`useReducer`), on purpose: do not move it to the store.
- Enter in a field is that step's own "advance", never the submit of the whole form.

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

## What redraws

Measured on the built app with a React commit hook (the way React DevTools counts: a subtree whose first child is the same object was skipped):

- **Idle redraws nothing**, on any tab. A timer, a poll or an event that changes nothing must stay that way.
- **The screens are memoised** (`Game`, `Dashboard`, `Settings`), because `AppShell` redraws for its own reasons (the tab, a toggle in the bar): switching tabs redraws the shell, about 45 components, not the 80 achievement cards behind it. `AchievementCard` and `GameRow` are memoised too, with handlers that keep their identity (`useCallback`, or a store action passed as is).
- **Costs that were measured and left alone:** a letter typed in a note redraws the Game screen around the list and that one card, about 1 ms; switching accounts loads another account's game and dashboard, about 45 ms of script. Memoising further would add code for nothing anyone can see.
- When a list item or a screen gets a new prop, check it does not get a new identity on every render (an inline function, an object built in the selector): that silently turns the memo off.

## Interface state (Zustand)

One store in `app/store/`, split into namespaced slices; how it is organised is in `docs/store.md`: **read it before adding a slice or deciding where a piece of state lives.** The rules:

- Slices reach the main process through `@app/services`, never through `window.api`; screens read the store or call an action.
- Actions mutate the Immer draft and name themselves for the devtools: `set(fn, false, 'games/load')`.
- Controllers select with `useStore(useShallow(...))`; a default value inside a selector must be a stable constant, or the component redraws every time.
- **No `persist`.** What survives closing the app is written by the main process. Where state lives depends on how long it should last: only while a screen is mounted → `useState`; across a window reload → `navigationSlice` (mirrored in `sessionStorage`); across restarts → a preference saved by the main process.
- A write is optimistic: apply, save, and on failure put back what is saved and tell the user.
- `connectStore` wires the store for the account in use; what was read from Steam for one account is dropped when another is followed.

## Interface

- Tailwind v4 (config in `src/renderer/src/ui/styles/index.css`, no `tailwind.config`) + shadcn/ui components + Lucide icons. New shadcn component: `pnpm dlx shadcn@latest add <name>` (it lands in `ui/primitives`); the command tends to install a wrong `cn` package and import from it: remove it with `pnpm remove cn` and point the import to `@ui/utils/cn`.
- Dark theme only, with the Steam palette in the tokens in `ui/styles/index.css` (`--primary` light blue, `--success` green, `--warning` amber).
- The window is narrow (600 px wide, for a second monitor, and never under 480): check that toolbars and buttons fit that width **in every language**. Spanish and French labels are the longest; the Game toolbar is the tightest row. A row that cannot fit wraps, with the sort select taking the whole second row.
- Lightness is the priority: no library with runtime styling.

## Storybook

`pnpm storybook` opens the catalogue of the interface's building blocks, each one alone and in every state. How it is set up and how a story is written is in `docs/storybook.md`: **read it before writing a story.** The rules:

- **A new component in `ui/components`, or a new state of one, comes with its story**, in `src/renderer/src/stories/` (apart from the components), one state per story.
- A component with real guidance gets a hand-written `.mdx` page whose text comes from `DESIGN.md`, and `tags: ['!autodocs']` on its meta so there is one page, not two.
- Data comes from the test factories; there is no main process (a stand-in answers with nothing).
- Lint and `pnpm typecheck` cover the stories, and CI builds the catalogue. **Storybook does not replace `pnpm audit:ui`**: a story shows a component alone, the audit shows the app.

## Accessibility

An automated audit (axe) of every screen reports zero violations; keep it that way.

### A feature is not done until it was audited in the running app

Tests passing is not the end of a change that touches the interface. What the audit covers and how it works is in `docs/audit.md`. The steps, every time:

1. **Run `pnpm audit:ui`**: it builds the app and drives it for real against a fake Steam, once per language. `AUDIT_LANGUAGES=fr pnpm audit:ui` runs one language while working; the full run is what counts.
2. **Add the new thing to the script** when the audit cannot reach it: a new screen, a section that has to be opened, a state behind a click. A control that opens something is audited in both directions; a shortcut to an item is audited with every filter that could hide it turned on.
3. **Look at it under the pointer**: `captureHover` saves a capture with the hover forced. The checks say a hover changes something, not what it looks like.
4. **Prove a new check can fail**: undo what it guards, see it fail, restore.
5. **Look at the captures** in `.audit-ui/`, every one the change could have touched. A capture of the wrong screen is the only sign the script went astray.
6. **Check by eye what no script measures**: separators (one between two things, none at the end of a group), alignment with the page margin, spacing between groups, text cut or wrapped in Spanish and French, anything said twice.
7. **Say in the report what was audited and what was not**, including what was not opened by hand (dialogs, toasts, the pressed state, real avatars).

The audit runs on a developer's machine only: it is not in CI nor in the hooks. The fake Steam is reachable only when the app is not packaged.

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

`~/.config/trophy-tracker/` (`%APPDATA%\trophy-tracker` on Windows, `~/Library/Application Support/trophy-tracker` on macOS): `config.json` (the accounts, each with its SteamID and key, permission 600; keys encrypted only if there is a keyring), `cache.json` (per account, plus what is common to all), `userdata.json` (notes, pins, checklists, per account), `settings.json` (language, always on top, list orders, the window's size and position). Never copy the key out of that folder or print it.

- **A file is never lost to a bad write or a bad read** (`storage/Store.ts`). Writing goes to a temporary name and is then put in place, so a crash in the middle leaves the previous file. A file that cannot be parsed, or that says it is in a later version of the format than this app knows (`FILE_VERSION`), is copied to `<name>.damaged.bak` or `<name>.v<N>.bak` before the app starts from nothing, and the error log says so. Treating such a file as empty would let the next write erase it for good.
- **Every file carries the version of its format** (`FILE_VERSION`), and a file in any other version is not read: `config.json` and `userdata.json` are copied aside (`<name>.v<N>.bak`) and the app starts from nothing; an older `cache.json` is simply dropped, since Steam gives it all back. `settings.json` never changed shape and is read whatever it says.
- **Migrations: only for a format a published version wrote, and with their way out written beside them.** Code that converts old data is worth writing when installed copies of the app have that data. It is not for a format that only ever existed on the developer's machine. When one is written, the comment says when it can go ("remove once nothing below version X is in use"), and it goes then. There is none today: the folder move from the app's first name and the reading of the single-account files (0.1.0 to 0.6.0) were removed while the owner was the only user.
- **The cache is written a second after it changes, once** (`cacheDelay`), and when the app closes (`Store.flush` on `before-quit`): reading a library changes it once per game, and each write is the whole file. Tests build the store with no delay.

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

- **Every change is made on its own branch and reaches `main` through a pull request.** Never commit on `main` and never push it. Branch from an up-to-date `main`, commit there (one commit per change, without asking), push the branch and open the pull request with `gh pr create`; the owner merges. A release tag still needs its own explicit request.
- Conventional Commits in English: `feat: achievement checklist`, `fix: ...`, `chore: ...`, `docs: ...`, `refactor: ...`, `perf: ...`, `style: ...`, `test: ...`. commitlint checks it; header and body lines stay within 100 characters.
- Husky hooks run on every commit: lint-staged (ESLint with auto-fix, then Prettier, on the staged files), then `pnpm typecheck` and `pnpm test` for the whole project, then commitlint on the message. Another hook runs `pnpm test:coverage` before every push. Never skip them with `--no-verify`; fix what they report.
- Purely mechanical commits (mass formatting, import sorting) go into `.git-blame-ignore-revs`.
