# Trophy Tracker

Desktop app (Electron + React + TypeScript) that shows, for the game open on Steam, the missing achievements, the hidden ones, progress counters, user checklists and shortcuts to guides. It runs natively on Windows, macOS and Linux, and is developed on WSL.

- **The repository is in English:** code, comments, test names, docs and commit messages.
- **The interface ships in four languages:** English (default), Brazilian Portuguese, Spanish and French. Text in another language belongs only in its file under `src/shared/i18n/locales/` (`pt-BR.ts`, `es.ts`, `fr.ts`), in test data that checks that locale, and in `README.pt-BR.md`.
- **A change to one README goes into both** (`README.md`, `README.pt-BR.md`).
- The user talks to you in Portuguese; answer in Portuguese.
- **Never copy a Steam Web API key out of the data folder or print it** (`docs/local-data.md` says where it is kept).
- **The fake Steam is reachable only when the app is not packaged.** The gate is in `src/main/index.ts`; the user's key is sent to whatever address the client is given, so never widen it (`docs/audit.md`).
- **The app raises no system notification.** What was unlocked, and how many are left, goes in the notice at the top of the list.
- This file holds the rules for any change; the files in the table below hold the rules of one area; `docs/DECISIONS.md` holds the reasons. Read the entry before undoing a choice, and add an entry when a choice is made that someone could reasonably want to undo.

## Before changing an area, read its rules

The rules in these files are as binding as the ones here. Read the file before the first edit in its area; a change that crosses areas reads each.

| Before changing                                                                                                                                                                                                                                                                 | Read                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Anything under `src/renderer/src/ui/`: a screen (a new full-window one included), a component, the styles, an animation, a loading state, an image. Any text the user reads, a message, a language (`src/shared/i18n/`)                                                         | `docs/interface.md`                                                                  |
| Anything the interface shows: the change is not done until it was audited in the running app. Also `scripts/audit-ui.mjs` and `scripts/fake-steam.mjs`                                                                                                                          | `docs/audit.md`                                                                      |
| The store (`app/store/`), where a piece of state lives, a write from the interface (optimistic UI), what a screen or a list item redraws (a new prop on either included)                                                                                                        | `docs/store.md`                                                                      |
| The setup form (`ui/screens/Onboarding/`), or any other form                                                                                                                                                                                                                    | `docs/onboarding-form.md`                                                            |
| A component in `ui/components` (new, or with a new state), a story, `.storybook/`                                                                                                                                                                                               | `docs/storybook.md`                                                                  |
| Accounts: adding, removing, switching, following the Steam client's account, a key and its status, the account cards (`SetupService`, `AccountChecks`, `KeyStatus`, `Accounts`, `AccountFollower`, `GameWatcher`), and the account a read belongs to (`Tracker`, `RunningGame`) | `docs/accounts.md`                                                                   |
| What is read from Steam, from where and how often: `SteamClient`, `Tracker`, `GameWatcher`, `RunningGame`, `steam/Achievements.ts`, `steam/SteamFiles.ts`, `steam/BinaryVdf.ts`, the update check, images from Steam                                                            | `docs/steam-data.md`                                                                 |
| `storage/Store.ts`, a file in the data folder, the format version of a file, a migration                                                                                                                                                                                        | `docs/local-data.md`                                                                 |
| Per-system code (`main/steam/`, `main/system/`, `storage/SecureCipher.ts`) or anything that would test `process.platform`; WSL; the window frame and the tab bar; error logging, the crash screen, lazy loading, the bundle size                                                | `docs/platforms.md`                                                                  |
| `electron-builder.yml`, `electron.vite.config.ts` (what goes into the package), the workflows, `scripts/publish-release.sh`, `scripts/docker-dist.sh`, `scripts/test-linux-package.sh`, `scripts/package-test/`, anything about updates, releasing a version                    | `docs/releases.md`                                                                   |
| `src/main/index.ts` and `MainWindow.ts`: what is wired when the app starts (the window and its size, the timers, the single instance, the data folder, what is written before quitting, the fake Steam gate)                                                                    | `docs/platforms.md`, `docs/local-data.md`, `docs/steam-data.md`, `docs/interface.md` |

## Commands

| Command                                       | What it does                                                                |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| `pnpm dev`                                    | App with reload (window through WSLg)                                       |
| `pnpm build`                                  | Builds into `out/`                                                          |
| `pnpm start`                                  | Runs the build                                                              |
| `pnpm test`                                   | Vitest, once (`test:coverage` also measures coverage, as CI)                |
| `pnpm test:watch`                             | Re-runs the tests affected by each saved file                               |
| `pnpm test:verbose`                           | Lists every test by name, grouped by file                                   |
| `pnpm typecheck`                              | `tsc` on the three projects (main process, interface, interface tests)      |
| `pnpm lint`                                   | ESLint, then knip (`lint:fix` auto-fixes)                                   |
| `pnpm format`                                 | Prettier (`format:check` only verifies)                                     |
| `pnpm screenshots`                            | Retakes the README pictures (`docs/screenshots/`) on demo data              |
| `pnpm audit:ui`                               | Builds the app, runs it against a fake Steam, audits every screen and flow  |
| `pnpm storybook`                              | Component catalogue on http://localhost:6006                                |
| `pnpm build-storybook`                        | Builds the catalogue into `storybook-static/`                               |
| `pnpm dist:linux`                             | AppImage and .deb into `dist/`                                              |
| `pnpm dist:win`, `pnpm dist:mac`, `pnpm dist` | The same for Windows, macOS and the current system                          |
| `pnpm dist:docker`                            | Linux and Windows installers built in a container; needs Docker             |
| `pnpm test:package`                           | Installs the .deb in a clean container, checks the app starts; needs Docker |

- Electron needs `libnss3 libnspr4 libasound2t64` installed on WSL.
- **pnpm only.** Never run `npm install` or commit a `package-lock.json`. Any other manager is refused on install (`devEngines.packageManager`, `preinstall`).
- The pnpm version is pinned in `packageManager` and provided by Corepack (`corepack enable`, once).
- Use `pnpm add`, `pnpm add -D`, `pnpm remove`, and `pnpm dlx` instead of `npx`.
- Dependency install scripts are blocked unless allowed in `pnpm-workspace.yaml` (`allowBuilds`). The file names three packages: `esbuild` is allowed (`true`); `unrs-resolver` and `electron-winstaller` are refused (`false`). Electron needs no entry: it downloads its binary on first run.
- A package must be listed in `package.json` to be imported (strict `node_modules`).
- A package imported by `src/` goes into `dependencies`, tooling into `devDependencies`.

## Code standards

Enforced by tooling; do not work around it.

- **Formatting:** Prettier with `{ "singleQuote": true }` (single quotes, semicolons, 80 columns, trailing commas). `.editorconfig` covers indentation and line endings.
- **Lint:** ESLint 9 flat config in `eslint.config.mjs` (typescript-eslint type-checked, React, React Hooks, jsx-a11y, import ordering). Its exceptions (tests, config files, async JSX handlers) are in the config with their reason.
- `src/renderer/src/ui/primitives` (generated shadcn/ui) is formatted but not linted.
- **File names:** a file holding a class, a component or only types is named after it, capitalised (`Tracker.ts`, `AccountCard.tsx`, `SteamLocal.ts`). A file of functions or a hook starts in lower case (`checklist.ts`, `useT.ts`). Entry points are `index.ts(x)` and `main.tsx`.
- **The main process is written in classes:**
  - with state or dependencies → a class that receives them in the constructor (`AccountFollower`);
  - stateless helpers → static methods of a class named for their subject (`TextVdf.parse`), not loose functions;
  - may not exist on this system → a static `create` that answers `null` (`AutoUpdater.create`, `SecureCipher.create`).
- `shared/` and the interface keep plain functions and hooks.
- **A boolean is named `is…`, `has…`, `can…` or `should…`**, whether a variable, a parameter, a property or a prop (ESLint). The exceptions, listed with their reasons at the top of `eslint.config.mjs`:
  - names written to the user's files or sent by Steam: `hidden`, `unlocked`, `done`, `pinned`, `alwaysOnTop`, `rememberWindow`;
  - the native attribute a prop stands for: `open`, `checked`, `disabled`, `readOnly`;
  - `ok`, and a setter's `value`.
- **Interfaces start with `I`** (`IAchievement`, `IStepperProps`; ESLint). Type aliases have no prefix. The global `Window` augmentation is the only exception.
- **Nothing unused stays:** a change removes what it leaves unused. `knip` (in `pnpm lint`, the commit hook and CI) fails on an unused file, export or dependency; its exceptions are in `knip.jsonc`, each with its reason.
- **Imports** are grouped (builtin, external, internal `@app`/`@ui`/`@shared`, parent, sibling, index), alphabetised, with a blank line between groups; type imports are inline (`import { type X }`). `pnpm lint:fix` sorts them.
- **Function-typed members** use property syntax (`onClick: () => void`), not method syntax.
- **No untyped JSON:** Steam responses are typed where they are read (`Envelope<T>`, `PlayerStats<T>` in `steam/SteamClient.ts`).
- **TypeScript projects:** three, and `pnpm typecheck` runs all of them. A browser API in the main process, or a Node API in the interface, is a compile error.
  - `tsconfig.node.json`: main, preload, shared, their specs, `__tests__/` and the config files; no DOM. Extends `tsconfig.base.json`.
  - `tsconfig.web.json`: the interface, shared, the Storybook preview and the three factories the stories use; no Node types. Extends `tsconfig.base.json`.
  - `tsconfig.webtest.json`: the specs under `src/renderer` and `__tests__/makeAppStore.ts`; browser types plus Node. Extends `tsconfig.web.json`.
- **Version pins.** Revisit both when the plugins catch up.

  | Package    | Stays on | Because                                              |
  | ---------- | -------- | ---------------------------------------------------- |
  | TypeScript | 6.0      | typescript-eslint does not support 7 yet             |
  | ESLint     | 9        | the React and jsx-a11y plugins do not support 10 yet |

## Architecture

```
src/shared/          the contract between the two sides: types and pure logic
  types/               one file per entity: Account, Achievement, AppInfo, AppState, Check, Game, Guide,
                       Preferences, Profile, UserData; Api.ts holds IApi (everything the interface can ask)
  ipcEvents.ts         names of the events the main process pushes to the interface
  i18n/                index.ts (registry) and locales/ (one file per language)
  *.ts                 pure logic: checklist, achievementSort, dashboardSort, view (mergeView),
                       version, updateFlow, validation (SteamID and key formats)
src/main/            main process: the only part that talks to Steam and to the disk
  index.ts             composition root: builds each piece once and wires them together
  MainWindow.ts        the single window and the events pushed to it
  ipc/Ipc.ts           answers IApi; handlers only route, the work lives in the services
  services/            Tracker (reads games and the dashboard: cache, deduplication, art),
                       Dashboard (the steps of the dashboard that need neither Steam nor the disk),
                       SetupService (setup state, language and accounts),
                       AccountChecks (the checks a SteamID and its key pass before the app takes them),
                       KeyStatus (what Steam last said about each account's key, and what a failure means),
                       Accounts (every change of the account in use, and what the watcher forgets for it),
                       AccountFollower, GameWatcher, RunningGame, UpdateChecker, AppUpdates
  steam/               SteamClient (Web API), Achievements (buildGameView, guideUrl), SteamLocal
                       (ISteamLocal), RegistrySteam, FileSteam, Windows, SteamFiles, TextVdf, BinaryVdf
  storage/             Store (JSON persistence), SecureCipher (key encryption)
  system/              Browser, ErrorLog, LocalFolder, WindowBounds, WindowFrame, AutoUpdater, Releases
src/preload/         exposes `window.api` (contextBridge), typed by `IApi`
src/renderer/src/    the interface
  app/                 everything that is not visual
    services/            classes with static methods; the ONLY code that touches window.api
    store/               Zustand store and its slices
    hooks/               useT, useLocale, useActiveGame
    lib/                 saver (debounced writes), safeSessionStorageGetItem, namedLazyLoad,
                         reportUnhandledErrors
  ui/                  everything that is drawn
    App.tsx + useAppController.ts   decides between onboarding and the app
    screens/             one folder per screen: Game, Dashboard, Settings, Onboarding, Update
    components/          shared between screens (`ls` for the list). Named by the rules: AppShell, WindowBar,
                         ErrorBoundary, CrashScreen, Pressable, IconButton, Hint, OptionSelect, RemoteImage,
                         Collapsible, AccountCard, MaskedKey, KeyField, Segmented, Switch
    primitives/          shadcn/ui components (generated; do not hand-edit without a reason)
    styles/index.css     Tailwind and the theme tokens
    utils/               cn, text (accent-free search), format (dates and numbers),
                         toggle (the classes of a toggle that is on)
  stories/             Storybook stories
__tests__/           what specs share
  helpers.ts           fakeFetch, makeTempDir, the ids, keys and Steam answers specs reuse
  InMemoryStore.ts     the fake of `Store` the specs of the services run over
  fakeSteamClient.ts   the fake of `SteamClient` for the same specs: answers values, writes down what was asked
  steamLibrary.ts      a library as Steam describes it: game, achieved; owned and player are their HTTP answers
  makeAppStore.ts      a fresh interface store over a fake main process
  factories/           makeAchievement, makeAppInfo, makeAppState, makeGameSummary, makeGameView, makeStatSchema
  fixtures/            real API responses
```

### Path aliases

| Alias       | Points to                | Available in                        |
| ----------- | ------------------------ | ----------------------------------- |
| `@app/*`    | `src/renderer/src/app/*` | interface                           |
| `@ui/*`     | `src/renderer/src/ui/*`  | interface                           |
| `@shared/*` | `src/shared/*`           | interface, main process and preload |
| `@tests/*`  | `__tests__/*`            | specs and stories (see Tests)       |

- Import through the alias, except for files inside the importing file's own folder (`./useGameController`, `./components/GameHeader`).
- A spec imports the unit beside it relatively (see Tests).

### Layers and who may call whom

```
ui (screens, components) → app/store and app/hooks → app/services → window.api → main/ipc → main/services → steam / storage
```

- A screen or component never calls `window.api` (lint). It reads the store, calls a store action, or, for a one-off request such as opening a link or an onboarding check, calls a service.
- Interface services hold no state: they are typed doors to the main process. State lives in the store.
- A store slice reaches the main process through `@app/services`, never through `window.api` (`docs/store.md`).
- In the main process, `Ipc` holds no logic, and services receive what they depend on through the constructor (see `index.ts`), so they are testable without Electron.
- **To add a call**, four places: a method on `IApi` (`shared/types/Api.ts`), a handler in `main/ipc/Ipc.ts`, the name in the list in `preload/index.ts`, and a method on the matching class in `app/services`.

## Tests

- **What is tested:** main-process and `shared/` logic, the pure logic of the screens (`achievementList`, `gameList`, `gameDetails`, `format`, step schemas, `stepperState`, `accountFormState`, `saver`) and the store: the slices that hold logic (`navigationSlice`, `updatesSlice`, `settingsSlice`, `userDataSlice`, `gamesSlice`, `dashboardSlice`, `sessionSlice`) and what wires them to the main process for an account (`connect`). Views and controllers are validated by running the app.
- **A behaviour change in a main-process service, `steam/SteamClient`, `storage/Store` or `shared/` comes with a test.**
- **One spec per unit, beside it:** `src/main/services/Tracker.ts` is tested by `src/main/services/Tracker.spec.ts`. A new unit gets its own spec; do not append to a neighbour's. A spec that covers a folder's `index.ts` is `index.spec.ts`. `Store` has a second one, `Store.contract.spec.ts` (see the fake of the store, below).
- `__tests__/` holds only what specs share: helpers, fakes, factories and fixtures.
- **Imports in a spec:** the unit and its neighbours relatively (`./Tracker`, `../storage/Store`); `@shared/*`, `@app/*` and `@ui/*` as in the code; `@tests/*` for helpers, factories and fixtures.
- **One behaviour per test**, written as arrange, act, assert, with a blank line between the three. A test that needs a second scenario is two tests.
- **The act is a statement of its own that keeps the result** (`const info = await sut.getAppInfo();`), never a call inside `expect(...)`.
- **The name is `should <result> when <condition>`** (`'should report a later release when GitHub has one'`).
- **The instance under test is `sut`**, built by a `setup()` function that each test calls, so no test sees another's state. `setup()` returns `sut` and what the test needs to drive its collaborators.
- **Assert what was promised:** exact values, the whole object when the object is the result, and the message of an error or a refusal, not only that it failed.
- **`it.each` for the same check over several inputs**, with the case in the name (`'should say which version of the format %s is in when it writes it'`).
- **A temp folder comes from `makeTempDir()`**, which removes it when the test ends. The real `Store` over such a folder is for the specs whose subject is what is written to disk: `Store.spec.ts`, `Store.contract.spec.ts`, and the two tests of `KeyStatus.spec.ts` that read the time `config.json` was saved. Never call `mkdtempSync` in a spec.
- **Factories in `__tests__/factories/`** (`makeAchievement`, `makeGameView`, `makeGameSummary`, `makeAppInfo`, `makeAppState`, `makeStatSchema`): each returns a valid object and takes only what the test is about. Do not rebuild these objects by hand in a test file. A file may wrap a factory when all its tests share a default (`rarity: 50`).
- **Fakes, not mocks.** A service receives through the constructor a fake of the part of each collaborator it uses, the part its class names with a `Pick<…>` type (`Tracker`, `SetupService`, `AccountChecks`, `KeyStatus`, `RunningGame`, `AccountFollower`), as well as a fake updater or an injected clock. Tests assert on results, not on which method was called. No mocking library.
- **A fake of a store keeps state in memory** (the account in use, the saved credentials), so a test reads back what the service did. It is written in the spec that uses it; one that two specs need goes under `__tests__/`, named for what it is.
- **`InMemoryStore` (`__tests__/InMemoryStore.ts`) is the fake of `Store`** for `Tracker.spec.ts`, `SetupService.spec.ts`, `AccountChecks.spec.ts`, `KeyStatus.spec.ts` and `Accounts.spec.ts`. It implements only the methods `Tracker`, `SetupService`, `AccountChecks` and `KeyStatus` call, and keeps the accounts, the one in use, the language and what was read from Steam.
- **`src/main/storage/Store.contract.spec.ts` keeps it equal to the real one:** it runs the same assertions over `Store` on a temp folder and over `InMemoryStore`. When a service comes to rely on something else in the store, add the method to the fake and the behaviour to that spec. A difference it finds is fixed in the fake, never by loosening the assertion.
- **`fakeSteamClient` (`__tests__/fakeSteamClient.ts`) is the fake of `SteamClient`** for the same specs. It is given what Steam answers as the values `SteamClient` returns, a failure being the `SteamError` the real client throws, and writes down every request in `asked`. What a player has in a game may be answered as a promise, which the test settles when Steam is to answer. A request the test gave no answer for throws. What `SteamClient` sends, and how it reads an answer, is tested in `SteamClient.spec.ts`.
- `vi.fn` is fine for a callback whose calls are the result: name it `<name>Mock` and assert arguments and count together (`toHaveBeenCalledExactlyOnceWith`).
- `fakeFetch` (`__tests__/helpers.ts`) is for the specs whose subject is what is asked of Steam or GitHub: `SteamClient.spec.ts`, `UpdateChecker.spec.ts`, and the one test of `SetupService.spec.ts` that sees a change of language reach a real client. It throws on a request no route answers.
- `__tests__/steamLibrary.ts` builds a library as Steam describes it: `game` and `achieved` are the values a fake client answers, `owned` and `player` the HTTP answers that carry them. Use it instead of writing those by hand.
- **Code that calls the system takes it as a dependency, defaulting to the real thing.** `Windows` takes the command runner in its constructor, `FileSteam` the disk, `RegistrySteam` the registry, and `SecureCipher.create` Electron's storage (`index.ts` passes the real one). New code that runs a command, reads the disk or uses an Electron API follows the same shape, so it can be tested on any machine.
- **Store slices are tested against a fake main process.** `makeAppStore()` (`__tests__/makeAppStore.ts`) builds a fresh store with a fake `window.api` and `sessionStorage`; a call the test did not provide throws. Its `follow(appState)` puts the store on an account through the real `connectStore`, and `fireWindowEvent` tells the store's window listeners of an event (`beforeunload`). These tests have their own TypeScript project (`tsconfig.webtest.json`), because the store uses browser types.
- **`sonner` is the one module that is mocked**, to see what was announced to the user.
- **Fixtures are real responses** (`__tests__/fixtures`: Nioh 3 and Onimusha: Way of the Sword). The achievement lists exist in the four languages (`.en`, `.es`, `.fr`; the file without a suffix is Brazilian Portuguese); the audit's fake Steam needs them to answer in the app's language.
- **Coverage:** `pnpm test:coverage` measures what is listed above; the Electron-only wiring and the texts are excluded in `vitest.config.ts`, with the reason.
- `ci.yml` runs format, lint, types, tests with coverage and the build on Linux, and the tests again on Windows and macOS. A test must not assume a path separator or permission bits.
- CI fails under the thresholds set in `vitest.config.ts`. They sit a little below the current numbers and only go up.
- The commit hook runs the tests without measuring; the push hook runs `pnpm test:coverage`.
- On a pull request, Codecov goes red only when the changed lines are under 90% covered or the whole drops more than half a point (`codecov.yml`).
- **100% is not the goal.** Coverage shows where there is no test at all, not whether a test checks anything. What to test follows risk: code that decides something for the user (what is saved, when the app restarts, what is announced) comes first.
- A branch that can only be reached by breaking the machine is left alone rather than covered with an artificial test.
- Known and accepted gap: the rare numeric types of `steam/BinaryVdf.ts`, until a game uses them.
- **Console output** of passing tests is hidden (`--silent=passed-only`); a failing test shows everything it printed. `test:watch` hides nothing: debug with `console.log` there.
- **Module cache:** a run made by hand reuses transformed modules (`fsModuleCache`, stored in `node_modules/.vitest-cache`). The hooks and CI set `CI`, which turns the cache off. If a manual run behaves oddly, delete that folder.

## Commits

- **Every change is made on its own branch and reaches `main` through a pull request.** Never commit on `main` and never push it.
- **The flow:** branch from an up-to-date `main`, commit there (one commit per change, without asking), push the branch and open the pull request with `gh pr create`. The owner merges.
- **Nothing is pushed, tagged or published without an explicit request.** A `v*.*.*` tag publishes a release by itself (`release.yml`), and installed apps update from it.
- A release tag still needs its own explicit request. The steps of a release are in `docs/releases.md`.
- **Conventional Commits in English:** `feat: achievement checklist`, `fix: ...`, `chore: ...`, `docs: ...`, `refactor: ...`, `perf: ...`, `style: ...`, `test: ...`. commitlint checks it; header and body lines stay within 100 characters.
- **Never skip the Husky hooks with `--no-verify`;** fix what they report.
- On every commit: lint-staged (ESLint with auto-fix, then Prettier, on the staged files), `knip`, then `pnpm typecheck` and `pnpm test` for the whole project, then commitlint on the message.
- On every push: `pnpm test:coverage`.
- Purely mechanical commits (mass formatting, import sorting) go into `.git-blame-ignore-revs`.
