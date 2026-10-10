# The interface store

How the Zustand store of the interface is organised and wired to the main process. The rules that follow from this are in `CLAUDE.md`; read this before adding a slice, an action, or state that has to outlive a screen.

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
- `connectStore` wires the store for the account in use and, when that account changes or the app leaves the configured state, drops what was read from Steam for it (and the game picked in the dashboard); language and settings are kept.
