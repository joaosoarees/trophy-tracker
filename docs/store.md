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

### Optimistic UI

The screen never waits for something it can already show, and never keeps showing something that was not saved.

- **Writes are optimistic.** A new action that writes: remember the previous value, apply to the store, save, and in the `catch` put back what is actually saved and tell the user with a toast (`sonner`, message `errors.changeNotSaved`). `settings.toggleAlwaysOnTop` is the model for a single call.
- User data goes through `app/lib/saver.ts`, which batches the writes, remembers the last saved value per key and skips the rollback when a newer edit is waiting.
- **No `pending` state on items:** saves are local and take milliseconds. Revisit if a write ever goes to a remote server.
- **Reads are optimistic.** `Tracker.getGameStaleFirst` answers with the last known view, however old, and refreshes it in the background; the interface gets a `game-updated` event only if something changed. A game that was opened before never shows a loading state.
- **Skeletons are for first loads only:** `GameSkeleton` the first time a game is opened, skeleton rows the first time the dashboard loads.
- **Remote images always go through `ui/components/RemoteImage`**, never a bare `<img>` with a network URL: fixed-size box, skeleton while loading, fallback icon on failure, each instance tracking its own load.

### What redraws

- **Idle redraws nothing**, on any tab. A timer, a poll or an event that changes nothing must stay that way.
- **The screens are memoised** (`Game`, `Dashboard`, `Settings`), because `AppShell` redraws for its own reasons. `AchievementCard` and `GameRow` are memoised too, with handlers that keep their identity (`useCallback`, or a store action passed as is).
- When a list item or a screen gets a new prop, check it does not get a new identity on every render (an inline function, an object built in the selector): that silently turns the memo off.
- **Do not memoise further.** Measured and left alone: a letter typed in a note redraws the Game screen around the list and that one card (about 1 ms); switching accounts costs about 45 ms of script.
- Measure on the built app with a React commit hook, counting as React DevTools does. Reference: switching tabs redraws the shell, about 45 components, not the 80 achievement cards behind it.

## How the store is organised

A single store in `src/renderer/src/app/store/`, split into namespaced slices:

```
store/
  Store.ts              the Store type (one field per slice) and the StoreSlice<T> type
  index.ts              create() with the devtools (dev only) and immer middlewares
  connect.ts            wires the store to the main process events once the app is set up
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
- **A preference the main process acts on** (remembering the window) is an `IPreferences` field: add it to `shared/types/Preferences.ts` with its default, and `Store.getPreferences` / `setPreference` and `settings.setPreference` carry it with no further wiring. It gets a `Switch` row in Settings.
- What must survive closing the app is written by `main/storage/Store.ts`. The navigation slice keeps the tab and the picked game in `sessionStorage` only so they survive the window reload of a language change.
- What each lifetime holds today:
  - only while the screen is mounted (search text, an open field) → `useState` in the controller;
  - across games and the reload of a language change (current tab, Pending/Unlocked list and hidden-only filter of a game, In progress/Complete list of the dashboard, picked game) → `navigationSlice`, mirrored in `sessionStorage`;
  - across restarts, because it is a preference (order of each list, always on top, language) → `settingsSlice`, saved by the main process in `settings.json`.
- There is no router: `navigationSlice` holds the tab and `AppShell` draws it. The Game and Dashboard tabs stay mounted; switching tabs only hides the other one.
- Edits to notes and checklists update the screen right away and are written half a second later (`app/lib/saver.ts`), with a flush when the window closes.
- `connectStore` also drops what was read when the app leaves the configured state, and the game picked in the dashboard goes with it; language and settings are kept.
