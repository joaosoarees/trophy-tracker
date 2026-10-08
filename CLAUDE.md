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
- **Lint:** ESLint 9 flat config in `eslint.config.mjs`: typescript-eslint type-checked rules, React, React Hooks, jsx-a11y and import ordering. `src/renderer/src/components/ui` (generated shadcn/ui) is formatted but not linted. Exceptions for tests, config files and async JSX handlers are written down in the config with the reason.
- **Interfaces start with `I`** (`IAchievement`, `IGameView`, `IStepperProps`); the rule is `@typescript-eslint/naming-convention`. Type aliases (`type X = ...`) have no prefix. The global `Window` augmentation is the only exception.
- **Imports** are grouped (builtin, external, internal `@/`, parent, sibling, index), alphabetised, with a blank line between groups, and type imports are inline (`import { type X }`). `pnpm lint:fix` sorts them.
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

```
src/shared/     types and pure logic used by both sides
  types.ts        model (IAchievement, IGameView, IGameSummary...) and the IPC IApi interface
  checklist.ts    parseChecklist (pasted text → items) and shownProgress (which counter to show)
  view.ts         mergeView: merges reads, reusing what did not change
  validation.ts   SteamID and key formats, used by the form and by the main process
  i18n/           languages: index.ts (registry) and locales/ (one file per language)
src/main/       main process: the only part that talks to Steam and to the disk
  steam/client.ts       HTTP calls to the Web API; turns failures into SteamError
  steam/achievements.ts buildGameView (merges the sources), newlyUnlocked, guideUrl
  steam/vdf.ts          reader for the binary KeyValues of the Steam client cache
  steam/windows.ts      Windows interop
  tracker.ts            orchestration: cache, deduplication, game, dashboard, art
  store.ts              JSON persistence (not to be confused with the interface store)
  onboarding.ts         SteamID, key and privacy checks
  index.ts              window, IPC handlers, periodic checks
src/preload/    exposes `window.api` (contextBridge), typed by `IApi`
src/renderer/src/
  App.tsx, Onboarding.tsx, GameScreen.tsx, Dashboard.tsx
  components/     AchievementCard, Checklist, bits (ProgressBar, Segmented, SearchBox, Empty)
  components/Stepper/, StepHeader, FieldError, ControlledLanguageSelect   multi-step form parts
  components/steps/<Name>Step/   one folder per onboarding step: index.tsx + schema.ts
  components/ui/  shadcn/ui components (generated; do not hand-edit without a reason)
  store/          interface state (Zustand)
  lib/            utils (cn, safe sessionStorage), i18n (useT, useLocale), text (accent-free search),
                  saver (debounced writes), useSessionState (state that survives a reload)
test/           Vitest, with real API responses in test/fixtures
```

Boundary rule: the interface never calls `fetch` against Steam and never touches files; everything goes through `window.api`. To add a call: a method on `IApi` (`shared/types.ts`), a handler in `main/index.ts`, and the name in the list in `preload/index.ts`.

## Data sources

| Data                                                          | Source                                                      | Key? |
| ------------------------------------------------------------- | ----------------------------------------------------------- | ---- |
| Achievement list, hidden descriptions, counter target, rarity | `IPlayerService/GetGameAchievements` (in the app language)  | no   |
| Unlocked or not, and when                                     | `ISteamUserStats/GetPlayerAchievements`                     | yes  |
| Current counter values                                        | `ISteamUserStats/GetUserStatsForGame`                       | yes  |
| Which stat feeds each counter                                 | local file `appcache/stats/UserGameStatsSchema_<appid>.bin` | —    |
| Library and playtime                                          | `IPlayerService/GetOwnedGames`                              | yes  |
| Game art                                                      | `IStoreBrowseService/GetItems` (batched)                    | no   |
| Name and avatar in the onboarding                             | `steamcommunity.com/profiles/<id>/?xml=1`                   | no   |

Things that have already cost time:

- The community profile page rate-limits requests (HTTP 429). That is why the SteamID step only blocks when Steam says the profile does not exist; any other answer becomes "unconfirmed" and lets the user move on.
- The Web API does not say which stat feeds a counter; only the local Steam client file does. Without the file, the achievement shows no counter (never invent a value).
- Steam does not report which achievements belong to DLC (`groupid` is always 0) nor which items are missing in a "collect them all"; the user checklist exists for that.
- New games have no art at a fixed path (`header.jpg` returns 404); the hashed path comes only from the store service.
- A key error comes back as HTML with status 403; a private profile comes back as JSON with 403.

## Languages

- One file per language in `src/shared/i18n/locales/`. `en.ts` is the reference: the `Messages` type comes from it, so a new key starts there and the compiler flags whatever is missing elsewhere. Messages are strings or functions (`left: (n) => ...`) for interpolation and plurals; there is no translation library.
- New language: create the file and register it in `i18n/index.ts` with the name Steam uses (`steam`), the locale for dates and numbers (`locale`) and the store country.
- The language changes **the whole app**: texts, error messages and the notification (the main process translates with `messagesFor(store.getLanguage())`), achievement names and descriptions and game art (requested from Steam in that language), and the suffix of guide searches.
- No user-facing text is hard-coded: in the interface use `const t = useT()`; in the main process, take `Messages` as a parameter. `SteamError` carries only the kind of error; the text comes from `steamErrorMessage(m, e)`.
- The language lives in `settings.json`. Changing it drops the translated cache (games, achievement lists, art); `cache.json` records which language it was read in and is dropped on startup if it does not match.
- In Settings, changing the language saves and **reloads the window**. In the onboarding the change is immediate, with no reload, because there is no Steam data on screen yet.
- The tab, the picked game and the already-seen running game are kept in `sessionStorage` (`useSessionState`) so the reload does not lose them.

## Forms (react-hook-form + zod)

The onboarding is a single multi-step form:

- `Onboarding.tsx` owns the form: `useForm` with `zodResolver`, `FormProvider`, and the overall schema built from one schema per step (`languageStep`, `accountStep`, `apiKeyStep`, `privacyStep`). `DoneStep` has no schema: it is just the submit.
- Each step lives in `components/steps/<Name>Step/` with `index.tsx` and `schema.ts`, reads the form with `useFormContext<OnboardingFormData>()`, and only advances after `form.trigger('<name>Step', { shouldFocus: true })`.
- `Stepper` holds the current step and exposes `previousStep`/`nextStep` through context (`useStepper`); `StepperFooter`, `StepperPreviousButton` and `StepperNextButton` build the footer.
- The check against Steam runs when advancing: on failure, `form.setError('<field>', { message })` shows the error on the field itself.
- Schemas hold the message **key** (`'steamIdFormat'`), not the text; `FieldError` translates it when rendering, so the error follows a language change. Every key used in a schema must exist under `validation` in the locales (there is a test for it).
- A field that is not a plain `<input>` becomes a controlled component with `useController` (e.g. `ControlledLanguageSelect`).
- Field side effects use the `form.watch` subscription (e.g. switching the screen language, invalidating the profile confirmation when the SteamID changes), always with `unsubscribe` on cleanup.
- Privacy has no typed field: the form value is filled in when the check passes, and the schema requires that value to finish.
- The draft (language, SteamID and step) goes to `sessionStorage` to survive a reload. **The Web API key never goes into the draft**; after a reload the form resumes at the key step at most.
- Enter in a field does not submit the whole form: each step treats Enter as its own "advance".

## Read policy (do not fire requests for nothing)

- **Game open:** every 60 s it re-reads only the player state (and counters, if the game has them). The achievement list is cached for 24 h; the ↻ button forces everything.
- **No change, no event:** `Tracker.getGame` returns the same object when nothing changed, and the main process only emits `game-updated` when the object is a different one.
- **Dashboard:** loads on startup, on ↻ (`all`) and when a game closes (`changed`: only games whose playtime changed).
- **Identical simultaneous requests** share one read (`Tracker.once`).
- **Art and names** are cached on disk; a store failure never takes the screen down.

When touching this, measure before and after: count HTTP and IPC calls on startup, while idle and when switching tabs.

## Interface state (Zustand)

A single store in `src/renderer/src/store/`, split into namespaced slices:

```
store/
  Store.ts            the Store type (one field per slice) and the StoreSlice<T> type
  index.ts            create() with the devtools (dev only) and immer middlewares
  connect.ts          wires the store to the main process events
  slices/
    sessionSlice.ts   language, current game and failure counter
    gamesSlice.ts     game views already read, by appid
    userDataSlice.ts  notes, pins and checklists
    dashboardSlice.ts dashboard
```

Conventions:

- Each slice declares `XStore` (data), `XActions` (actions) and `XSlice = XStore & XActions`, and exports `createXSlice: StoreSlice<XSlice>`.
- State is namespaced: `state.games.entries`, `state.dashboard.load`. A slice can read and change another one through the whole-store `get()`/`set()`.
- Actions mutate the Immer draft directly (`prevState.games.entries[appid].loading = true`) and pass a name for the devtools: `set(fn, false, 'games/load')`.
- Components read state and actions together with `useStore(useShallow(state => ({ ... })))`. Default values inside the selector must be stable constants (e.g. `NONE_UNLOCKED`), otherwise the component re-renders every time.
- Do not use `persist`: what must survive closing the app is written by the main process (`main/store.ts`).
- Screen-only state (filter, search, open field) stays in `useState` in the component.
- The Game and Dashboard tabs stay mounted; switching tabs only hides the other one.
- Edits to notes and checklists update the screen right away and are written half a second later (`lib/saver.ts`), with a flush when the window closes.

## Interface

- Tailwind v4 (config in `src/renderer/src/styles.css`, no `tailwind.config`) + shadcn/ui components + Lucide icons. New shadcn component: `pnpm dlx shadcn@latest add <name>`; the command tends to install a wrong `cn` package and import from it: remove it with `pnpm remove cn` and point the import to `@/lib/utils`.
- Dark theme only, with the Steam palette in the tokens in `styles.css` (`--primary` light blue, `--success` green, `--warning` amber).
- The window is narrow (about 520 px, for a second monitor): check that toolbars and buttons fit that width.
- Lightness is the priority: no library with runtime styling.

## Local data

`~/.config/steam-trophy-tracker/`: `config.json` (SteamID and key, permission 600; encrypted only if there is a keyring), `cache.json`, `userdata.json` (notes, pins, checklists), `settings.json` (language, always on top). Never copy the key out of that folder or print it.

## Tests

- Main process and `shared/` logic is tested; the interface is validated by running the app.
- `test/helpers.ts` has the route-based `fakeFetch`; fixtures are real responses (Nioh 3 and Onimusha: Way of the Sword).
- A behaviour change in `tracker`, `client`, `onboarding`, `store` (main) or `shared/` comes with a test.

## Commits

- Commit at the end of every requested change, without asking, one commit per change. Local commits only: pushing or sending anything outside depends on an explicit request.
- Conventional Commits in English: `feat: achievement checklist`, `fix: ...`, `chore: ...`, `docs: ...`, `refactor: ...`, `perf: ...`, `style: ...`, `test: ...`. commitlint checks it; header and body lines stay within 100 characters.
- Husky hooks run on every commit: lint-staged (ESLint with auto-fix, then Prettier, on the staged files), then `pnpm typecheck` and `pnpm test` for the whole project, then commitlint on the message. Never skip them with `--no-verify`; fix what they report.
- Purely mechanical commits (mass formatting, import sorting) go into `.git-blame-ignore-revs`.
