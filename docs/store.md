# The interface store

The rules below are binding; `CLAUDE.md` sends you here before you add a slice or an action, decide where a piece of state lives, add a write from the interface, or change what a screen or a list item redraws.

## Rules

### Interface state

One Zustand store in `app/store/`, split into namespaced slices.

- Actions mutate the Immer draft and name themselves for the devtools: `set(fn, false, 'games/load')`.
- Controllers select with `useStore(useShallow(...))`. A default value inside a selector must be a stable constant, or the component redraws every time.
- **No `persist`.** What survives closing the app is written by the main process.
- **Where state lives depends on how long it should last:** only while a screen is mounted → `useState`; across a window reload → `navigationSlice` (mirrored in `sessionStorage`); across restarts → a preference saved by the main process.
- Store slices reach the main process through `@app/services`, never through `window.api`. Who calls whom is in Layers, in `CLAUDE.md`.
- `connectStore` wires the store for the account in use; what was read from Steam for one account is dropped when another is followed.
- **An answer is taken only in the stay on the account it was asked in.** No answer from the main process names its account, and a request made under one account may answer after another took over, or after that account was left and followed again (A, B, A), when the same read has been asked a second time. A slice action that awaits a read (`games.load`, `dashboard.load`, `session.loadCurrent`, `userData.load`) calls `sameAccount(get)` (`app/store/sameAccount.ts`) before it asks and drops the answer when the function says the stay ended, touching nothing, not even its loading flag: that flag belongs to the read asked since. Dropping is safe: `connectStore` asks again each time it wires the store. A new read follows the same shape.
- **A stay is the SteamID in use and a count of how many times `connectStore` wired the store** (`nextStay`, called before it asks anything). The SteamID alone cannot tell two stays on the same account apart; the count alone would take an answer between the change of account and the store being wired again. The count is kept in `sameAccount.ts`, not in the store: no screen reads it. A guard that only asks which account is in use (the rollback of a note that was not saved, the undo of a checklist item) compares the SteamID itself, since it acts on what the store holds at that moment, not on an answer.

### Optimistic UI

The screen never waits for something it can already show, and never keeps showing something that was not saved.

- **Writes are optimistic.** A new action that writes: remember the previous value, apply to the store, save, and in the `catch` put back what is actually saved and tell the user with a toast (`sonner`, message `errors.changeNotSaved`). `settings.toggleAlwaysOnTop` is the model for a single call.
- **A call about the setup that rejects is not optimistic, and the store then asks what is held.** `settings.switchAccount`, `settings.removeAccount` and `settings.removeStepAccount` change nothing before the main process answers. When the call rejects, the user is told in a toast (`explainFailedCall`, `errors.unexpected`) and the store takes what `getState` answers: the main process changes what it holds before it writes it, so a write the disk refused leaves it past the change (the account gone, the other one in use), and the screen must show what it holds. When `getState` fails too, the store keeps what it has. `settings.changeLanguage` cannot take the change without the reload that goes with it, so it goes the other way: it asks the main process for the previous language again, which puts it back whether or not that is written, and does not reload.
- User data goes through `app/lib/saver.ts`, which batches the writes, remembers the last saved value per key and skips the rollback when a newer edit is waiting.
- **A user-data write names its account.** `userData.update` takes the SteamID in use as the edit is made; it is part of the saver's key and goes with the write (`UserDataService.setUserData`), so an edit flushed after the account changed is still saved where it was made. A save that fails after its account was left tells the user and leaves the screen, which shows another account, as it is.
- **An undo is resolved in the store, at the click.** The toast that offers it outlives the list it was shown on (a collapsed card, a search, another list, game or account), so it holds no list and no component state: it names where the item came from (account, game, achievement) and `userData.restoreChecklistItem` puts it back into the list the store holds then; `restoreChecklistItem` in `shared/checklist.ts` says where it goes and when it is already back. An undo whose account is no longer in use, or whose game was not read again, does nothing: its list is not at hand, and writing would replace the saved one. **An undo that can no longer apply is not offered:** the store shows the toast itself (`userData.offerChecklistUndo`) and takes every one still up off the screen as the account is left (`userData.withdrawUndos`, called by `connectStore` as it unwires), which is the one case where the list is not at hand. A click takes the toast away whatever it restored (sonner does that for an action button), so an undo of an item that was typed again does not stay either.
- **No `pending` state on items:** saves are local and take milliseconds. Revisit if a write ever goes to a remote server.
- **Reads are optimistic.** `Tracker.getGameStaleFirst` answers with the last known view, however old, and refreshes it in the background; the interface gets a `game-updated` event only if something changed. A game that was opened before never shows a loading state.
- **A game that was read brings its dashboard row up to date** (`games.accept`): the counts and the completion date, without reading the dashboard again. The date follows `shared/completion.ts`, the rule the main process lists the dashboard by, over the unlock dates the view carries, so the next read of the dashboard answers the same one. A row that is no longer complete (the game gained achievements) loses its date. Never date a completion any other way in the interface.
- **Skeletons are for first loads only:** `GameSkeleton` the first time a game is opened, skeleton rows the first time the dashboard loads.
- **Remote images always go through `ui/components/RemoteImage`**, never a bare `<img>` with a network URL: fixed-size box, skeleton while loading, fallback icon on failure, each instance tracking its own load.

### What redraws

- **Idle redraws nothing**, on any tab. A timer, a poll or an event that changes nothing must stay that way.
- **The screens are memoised** (`Game`, `Dashboard`, `Settings`), because `AppShell` redraws for its own reasons. `AchievementCard` and `GameRow` are memoised too, with handlers that keep their identity (`useCallback`, or a store action passed as is).
- When a list item or a screen gets a new prop, check it does not get a new identity on every render (an inline function, an object built in the selector): that silently turns the memo off.
- **Do not memoise further.** Measured and left alone: a letter typed in a note redraws the Game screen around the list and that one card (about 1 ms); switching accounts costs about 45 ms of script.
- Measure on the built app with a React commit hook, counting as React DevTools does. Reference: switching tabs redraws the shell, about 45 components, not the 80 achievement cards behind it.
- **The React Compiler is not used.** Measured on 2026-10-10 and not adopted; the numbers, and how to measure again, are in "The React Compiler: measured, not adopted" below. Do not turn it on without repeating that measurement.

## How the store is organised

A single store in `src/renderer/src/app/store/`, split into namespaced slices:

```
store/
  Store.ts              the Store type (one field per slice) and the StoreSlice<T> type
  index.ts              create() with the devtools (dev only) and immer middlewares
  connect.ts            wires the store to the main process events once the app is set up
  sameAccount.ts        whether a read's answer arrives in the stay on the account it was asked in
  slices/
    sessionSlice.ts       language and current game
    settingsSlice.ts      app state from the main process, always on top, preferences, data folder,
                          list order, language change, switching and removing accounts
    navigationSlice.ts    current tab, Pending/Unlocked list, game picked in the dashboard, adding an account
    gamesSlice.ts         game views already read, by appid
    userDataSlice.ts      notes, pins and checklists
    dashboardSlice.ts     dashboard
    updatesSlice.ts       new versions: the check as the app opens, download progress, the restart
```

Conventions:

- Each slice declares `XStore` (data), `XActions` (actions) and `XSlice = XStore & XActions`, and exports `createXSlice: StoreSlice<XSlice>`.
- State is namespaced: `state.games.entries`, `state.dashboard.load`. A slice can read and change another one through the whole-store `get()`/`set()`.
- A draft mutation reads `prevState.games.entries[appid].loading = true`.
- `NONE_UNLOCKED` is an example of a stable default for a selector.
- **A rule that makes one slice follow another is written in the action, not in an effect.** `session.setCurrent` tells `navigation.followRunningGame` which game runs, so a game opened on Steam brings the app to it in the same update, with a slice test. An effect that copies one slice into another costs a second commit and has no test.
- **A preference the main process acts on** (remembering the window) is an `IPreferences` field: add it to `shared/types/Preferences.ts` with its default, and `Store.getPreferences` / `setPreference` and `settings.setPreference` carry it with no further wiring. It gets a `Switch` row in Settings.
- What must survive closing the app is written by `main/storage/Store.ts`. The navigation slice keeps the tab and the picked game in `sessionStorage` only so they survive the window reload of a language change.
- What each lifetime holds today:
  - only while the screen is mounted (search text, an open field) → `useState` in the controller;
  - across games and the reload of a language change (current tab, Pending/Unlocked list and hidden-only filter of a game, In progress/Complete list of the dashboard, picked game) → `navigationSlice`, mirrored in `sessionStorage`;
  - across restarts, because it is a preference (order of each list, always on top, language) → `settingsSlice`, saved by the main process in `settings.json`.
- There is no router: `navigationSlice` holds the tab and `AppShell` draws it. The Game and Dashboard tabs stay mounted; switching tabs only hides the other one.
- Edits to notes and checklists update the screen right away and are written half a second later (`app/lib/saver.ts`), with a flush when the window closes.
- `connectStore` also drops what was read when the app leaves the configured state, and the game picked in the dashboard goes with it; language and settings are kept.

## The React Compiler: measured, not adopted

Measured on 2026-10-10 with React 19.3.0 and `babel-plugin-react-compiler` 1.0.0, added to the Babel plugins of `@vitejs/plugin-react` in the renderer config. The manual memoisation was left as it is in both builds.

**The rule set beforehand:** adopt only if (1) at least one scenario spends 20% less time in React, clearly outside the variation between runs, (2) no scenario gets worse beyond that variation, and (3) every project check passes with the compiler on. **Result: (1) held, (2) did not, (3) held. Not adopted**; the dependency and the build configuration were removed again.

### What was measured

The built app (never the dev server), driven as `pnpm audit:ui` drives it, against the fake Steam and in a data folder of its own. Time is the sum of `actualDuration` reported by a `<Profiler>` around the app, over the profiling build of `react-dom`; commits are the calls of its `onRender`. Both builds carried the profiler, so the absolute times are a little above the shipped app's.

Two libraries:

- **the fixtures' size**: the audit's library, with Nioh 3 on the Game screen (64 achievements, 44 cards in the pending list) and 2 rows on the dashboard;
- **large**: a game of 384 achievements (300 pending cards) and a dashboard of 302 games (253 rows in the list shown).

Each number is one pass of a scenario in a freshly started app, after one pass of every scenario in that same app that is thrown away. 11 starts per build and size, the two builds alternating, the first start of each thrown away: 10 runs. Milliseconds of React time for the whole scenario: median (lowest to highest), then commits.

| Scenario, fixtures' size                              | Without the compiler | With the compiler    | Difference of the medians |
| ----------------------------------------------------- | -------------------- | -------------------- | ------------------------- |
| 1. Achievement search: 6 letters, then cleared        | 26.7 (25.3–31.0), 10 | 38.8 (19.9–41.5), 10 | +12.1 ms, +45%            |
| 2a. Note: 10 letters                                  | 8.5 (7.9–10.4), 10   | 1.4 (0.9–1.8), 10    | −7.1 ms, −83%             |
| 2b. Checklist: 3 items checked                        | 5.0 (3.9–5.8), 9     | 2.6 (2.3–3.1), 9     | −2.3 ms, −47%             |
| 3a. Dashboard read again after a game closes          | 2.3 (2.0–2.6), 3     | 0.7 (0.5–0.8), 3     | −1.6 ms, −69%             |
| 3b. Dashboard search: 5 letters, then cleared         | 3.1 (2.6–4.0), 9     | 1.6 (1.2–2.5), 9     | −1.5 ms, −50%             |
| 4. Idle for 60 s, Game screen and dashboard (10 each) | 0 commits            | 0 commits            | none                      |

| Scenario, large                                       | Without the compiler       | With the compiler          | Difference of the medians    |
| ----------------------------------------------------- | -------------------------- | -------------------------- | ---------------------------- |
| 1. Achievement search: 6 letters, then cleared        | 185.2 (148.7–227.1), 11–13 | 180.2 (145.7–188.6), 11–13 | −4.9 ms, −3%: no difference  |
| 2a. Note: 10 letters                                  | 10.3 (9.8–12.5), 10        | 4.0 (3.7–6.9), 10          | −6.4 ms, −62%                |
| 2b. Checklist: 3 items checked                        | 5.0 (4.6–6.6), 9           | 3.5 (3.3–4.0), 9           | −1.5 ms, −29%                |
| 3a. Dashboard read again after a game closes          | 12.1 (6.7–14.7), 3         | 1.5 (1.0–2.1), 3           | −10.6 ms, −88%               |
| 3b. Dashboard search: 6 letters, then cleared         | 13.2 (9.7–17.2), 10        | 14.9 (9.1–17.1), 10        | +1.6 ms, +12%: no difference |
| 4. Idle for 60 s, Game screen and dashboard (10 each) | 0 commits                  | 0 commits                  | none                         |

- **The gains are real and too small to feel.** A letter in a note goes from about 0.85 ms to about 0.15 ms; the largest gain in absolute terms is 10.6 ms, once, when a game closes with a dashboard of 300 games on screen. Nothing here was slow before.
- **What got worse:** at the fixtures' size, the commit that draws the 44 cards again when the search is cleared took about 25 ms instead of about 14 ms in 7 of 11 starts with the compiler, and never without it. The whole set was run a second time and gave the same: 7 of 11 starts, median 39.9 ms (25.7–42.1) against 27.6 ms (26.0–32.4). The letters themselves were faster with the compiler (about 0.2 ms against 0.6 ms each).
- **The cause was not found.** Eight searches in a row in an app where nothing else had been done did not show it (pass by pass the two builds were alike), so it depends on what was done before: a note and a checklist on a card, a game played and closed. The large library did not show it either, its own spread (about 80 ms) being wider than the effect.
- **Idle redraws nothing in either build**, with the fake Steam being asked every one to three seconds and no game running.
- **Size and build time:** the renderer's JavaScript goes from 681,746 to 737,816 bytes (+8.2%), gzipped from 211,923 to 231,153 (+9.1%); `pnpm build` from about 3.8 s to about 5.1 s (6 builds each, alternating).
- **What the compiler left alone** (four hooks and components; it compiled 110, reported by its logger and by the `react-hooks` rules of `eslint-plugin-react-hooks` 7 once they are turned on): `useOnboardingController` (`form.watch` of react-hook-form, an incompatible library), `ControlledLanguageSelect` (`field.ref` read during render), and `useAccountStepController` and `useAccountDetailsController` (`try`/`finally` without `catch`, which it does not handle yet).
- **The checks with the compiler on** (also in Storybook's Vite config): `pnpm typecheck`, `pnpm lint`, `pnpm test:coverage`, `pnpm build`, `pnpm build-storybook` and `pnpm audit:ui` in the four languages all passed. No difference in behaviour was seen; the audit's captures were not compared by eye.

### Measuring again

Nothing of the measurement is kept in the repository: it needs a second way to build the app. To repeat it:

1. **A profiled build.** In the renderer config of `electron.vite.config.ts`, behind an environment variable that is off by default, alias `react-dom/client` to a module that calls `createRoot` of `react-dom/profiling` and wraps what is rendered in `<Profiler id="app" onRender>`, pushing each `actualDuration` to an array on `window`. `src/` is not touched. With the variable off, the files in `out/` must have the same SHA-256 as before the change; they did.
2. **The compiler** behind a second variable: `react({ babel: { plugins: [['babel-plugin-react-compiler', { logger }]] } })`. The logger's `CompileError` events name what is left alone.
3. **One folder per build**, each built with `electron-vite build --outDir <folder>/out` beside a copy of `package.json`, so the two can be started in turn with `electron .` from the folder.
4. **A script on the audit's mechanism** (`launch`, the fake Steam, `TROPHY_TRACKER_FAKE_STEAM`): go through the setup, wait until React has drawn nothing for a second, read the length of the array, run the scenario with real key events (one letter every 60 ms), wait for quiet again, and sum what was pushed since.
5. **The large library** is the fake Steam's with one more field: a game that repeats a fixture's list six times under new internal names, and 300 games taking 5 to 59 achievements of a fixture. Add a minute of playtime before the game closes, or the dashboard has nothing to read again.
