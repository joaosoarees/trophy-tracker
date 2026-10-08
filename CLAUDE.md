# Steam Achievements

Desktop app (Electron + React + TypeScript) that shows, for the game open on Steam, which achievements are missing, what the hidden ones are, progress counters, user checklists and shortcuts to guides. Personal use; may become a product.

**Language rules:** everything in the repository is written in English: code, comments, test names, docs and commit messages. The interface ships in two languages, **English (default) and Brazilian Portuguese**; Portuguese text belongs only in `src/shared/i18n/locales/pt-BR.ts` and in test data that checks that locale. The user talks to you in Portuguese; answer in Portuguese.

## Commands

```bash
pnpm dev         # app with reload (window through WSLg)
pnpm build       # builds into out/
pnpm start           # runs the build
pnpm test            # Vitest
pnpm typecheck   # tsc on both projects (main process and interface)
pnpm lint        # ESLint (lint:fix to auto-fix)
pnpm format      # Prettier (format:check to only verify)
```

Electron needs `libnss3 libnspr4 libasound2t64` installed on WSL.

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

## Environment: WSL talking to Windows

The project runs on WSL, but the Steam client runs on Windows. The bridge is `src/main/steam/windows.ts`, which calls Windows executables through interop:

- `reg.exe`: running game (`HKCU\Software\Valve\Steam\RunningAppID`), signed-in account (`ActiveProcess\ActiveUser`) and Steam folder (`SteamPath`).
- `rundll32.exe`: opens links in the Windows browser.
- `powershell.exe`: Windows notification (Electron notifications inside WSLg do not show up).

It does not produce an `.exe`; becoming a native Windows app requires Node on Windows.

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
    onboardingChecks.ts    key + SteamID and privacy checks against Steam
  steam/                 client.ts (Web API), achievements.ts (buildGameView, guideUrl),
                         vdf.ts (Steam client cache reader), windows.ts (Windows interop)
  storage/               Store.ts (JSON persistence), createCipher.ts (key encryption)
  system/browser.ts      opening pages in the user's browser

src/preload/           exposes `window.api` (contextBridge), typed by `IApi`

src/renderer/src/      the interface, in two layers
  app/                 everything that is not visual
    services/            classes with static methods; the ONLY code that touches window.api
    store/               Zustand store and its slices
    hooks/               useT, useLocale, useActiveGame
    lib/                 saver (debounced writes), safeSessionStorageGetItem
  ui/                  everything that is drawn
    App.tsx + useAppController.ts   decides between onboarding and the app
    screens/             one folder per screen: Game, Dashboard, Settings, Onboarding
    components/          shared between screens: AppShell, Pressable, IconButton, Hint, NativeSelect,
                         RemoteImage, ProgressBar, Segmented, SearchBox, Empty
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
| Name and avatar in the onboarding                             | `ISteamUser/GetPlayerSummaries`                             | yes  |

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
- **Stepper.** `stepperState.ts` is a pure, tested reducer holding the current step and the furthest one reached. The step names at the top are buttons: any step already reached can be revisited in either direction, steps ahead stay locked. A step that changes something later steps depend on calls `lockFollowingSteps()` (through `useStepper`) so they must be reached again. Changing the language locks nothing.
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
- The periodic checks live in `GameWatcher` (running game every 10 s, unlocks every 60 s).
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
- The window is narrow (about 520 px, for a second monitor): check that toolbars and buttons fit that width.
- Lightness is the priority: no library with runtime styling.

## Accessibility

An automated audit (axe) of every screen reports zero violations; keep it that way.

- **Nothing clickable is a raw element.** Use `Button` (primitive), `IconButton` (icon only), or `Pressable` (the base of hand-made clickables such as tabs and rows). They carry the keyboard focus ring and the disabled state; a raw `<button>` or `<select>` in `ui/` fails the lint. The pointer cursor comes from a global rule in `styles/index.css`.
- **Every clickable has a visible hover**, normally a background tint (`hover:bg-accent/40`), not only a text colour change.
- **Icon-only buttons** use `IconButton`, whose `label` is mandatory: it is both the accessible name and the tooltip. Explain other controls with `Hint`, never with the native `title` (it is slow and does not show on keyboard focus).
- **State is announced, not just drawn:** `aria-pressed` on toggles (Segmented, pin, always on top, hidden only), `aria-current="page"` on the current tab, `aria-expanded` on what opens a section.
- **Selects** go through `NativeSelect`, whose `label` is mandatory.
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
- After changing a screen, run the axe audit against the running app and tab through it with the keyboard.

## Local data

`~/.config/steam-trophy-tracker/`: `config.json` (SteamID and key, permission 600; encrypted only if there is a keyring), `cache.json`, `userdata.json` (notes, pins, checklists), `settings.json` (language, always on top). Never copy the key out of that folder or print it.

## Tests

- Main process and `shared/` logic is tested, as is the pure logic of the screens (`achievementList`, step schemas, `saver`); views and controllers are validated by running the app.
- `test/helpers.ts` has the route-based `fakeFetch`; fixtures are real responses (Nioh 3 and Onimusha: Way of the Sword).
- A behaviour change in a main-process service, `steam/client`, `storage/Store` or `shared/` comes with a test. Services are tested with fakes passed to the constructor (see `test/gameWatcher.test.ts`).

## Commits

- Commit at the end of every requested change, without asking, one commit per change. Local commits only: pushing or sending anything outside depends on an explicit request.
- Conventional Commits in English: `feat: achievement checklist`, `fix: ...`, `chore: ...`, `docs: ...`, `refactor: ...`, `perf: ...`, `style: ...`, `test: ...`. commitlint checks it; header and body lines stay within 100 characters.
- Husky hooks run on every commit: lint-staged (ESLint with auto-fix, then Prettier, on the staged files), then `pnpm typecheck` and `pnpm test` for the whole project, then commitlint on the message. Never skip them with `--no-verify`; fix what they report.
- Purely mechanical commits (mass formatting, import sorting) go into `.git-blame-ignore-revs`.
