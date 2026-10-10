# Platforms and production behaviour

The rules below are binding; `CLAUDE.md` sends you here before you change per-system code (`main/steam/`, `main/system/`, `storage/SecureCipher.ts`), the window frame or the tab bar, error logging, the crash screen, lazy loading or the interface bundle.

## Rules

### Platforms

The same code runs on Windows, macOS, Linux and, for development, WSL.

| What                            | Windows (and WSL)                                  | macOS and Linux                                             |
| ------------------------------- | -------------------------------------------------- | ----------------------------------------------------------- |
| Running game                    | registry, `HKCU\Software\Valve\Steam\RunningAppID` | Web API: `gameid` in `GetPlayerSummaries`, asked every 30 s |
| Signed-in account               | registry, `ActiveProcess\ActiveUser`               | `config/loginusers.vdf` in the Steam folder (`MostRecent`)  |
| Steam folder (counter stat map) | registry, `SteamPath`                              | the known install paths, first one that exists              |
| Opening links                   | Electron (`rundll32.exe` on WSL)                   | Electron                                                    |

- **Per-system code lives only in** `main/steam/` (`RegistrySteam.ts`, `FileSteam.ts`, `Windows.ts`, `SteamFiles.ts`), `main/system/` and `storage/SecureCipher.ts`. Services, IPC handlers and the interface never test `process.platform`.
- `ISteamLocal` (`steam/SteamLocal.ts`) is what the installed Steam client tells. `index.ts` builds it once, as a `RegistrySteam` (Windows) or a `FileSteam` (macOS and Linux); services receive it and never ask which system they are on.
- **The signed-in account: `null` is "nobody", a failed read rejects.** `Windows.getActiveSteamId` answers `null` when the registry says zero or has no such value (`reg.exe` ran and ended with code 1) and rejects when the command could not be started or was killed for taking too long. `FileSteam.getActiveSteamId` answers `null` when Steam is not installed or `loginusers.vdf` marks no account and rejects when the file cannot be read. Every caller decides what a failure means for it: the follower keeps what it last saw, `RunningGame` asks about the account in use, the setup form is offered no SteamID. The other registry reads (running game, Steam folder, Smart App Control) still answer `null` either way.
- `services/RunningGame.ts` uses the registry when there is one, the Web API otherwise. When a call fails it reuses the last answer, so a network failure does not look like the game closing.
- When a game closes, `GameWatcher` keeps it as the last one played. It does not ask the library: the cached copy still names the game played before.
- `steam/Windows.ts` is the Windows side. On WSL it calls the same `.exe` files through interop (`reg.exe`, `rundll32.exe`, `powershell.exe`).
- WSL is recognised by the kernel name **and** `WSL_DISTRO_NAME`: a container on a WSL host counts as plain Linux.
- On WSL, links open in the Windows browser (`system/Browser.ts`).
- **The app raises no system notification.** What was unlocked, and how many are left, goes in the notice at the top of the list.
- Accepted gap: the Web API reports the running game only when the profile shows it. On macOS and Linux a profile that hides the game status never switches games on its own.
- The data folder is `trophy-tracker` on every system (set in `main/index.ts`).
- A second launch focuses the open window (`requestSingleInstanceLock`).
- **Windows and macOS have no title bar** (`system/WindowFrame.ts`): the system draws only its own buttons, over the app's tab bar. Linux keeps the system's title bar.
- The interface never asks which system it is on. CSS learns where the buttons are from `env(titlebar-area-*)`, through the `window-drag`, `window-buttons-inset`, `window-bar` and `h-below-window-bar` utilities in `ui/styles/index.css`; the fallbacks leave Linux unchanged.
- The tab bar drags the window. A screen without it (onboarding, update, crash) starts with `ui/components/WindowBar`.
- Whatever is added to the tab bar must fit beside the system's buttons at 480 px in French, the tightest case (138 px of buttons on Windows).

### Production behaviour

- **Errors are logged locally, never sent anywhere:** `system/ErrorLog.ts` writes to `logs/errors.log` in the data folder (rotated at 512 KB).
- The main process logs uncaught exceptions and rejections, a failed automatic update (`AppUpdates`), an unexpected error of a read from Steam (`KeyStatus`) and a write the disk refused to something the app did by itself (a key status, the client's account being followed). What it keeps of an error is `ErrorLog.detailOf`. A service takes the log as a dependency (`logError`) and never writes to the console. The interface reports its own through `SystemService.logError` (`app/lib/reportUnhandledErrors.ts`, `ui/components/ErrorBoundary`).
- **A render error never leaves a blank window:** `ErrorBoundary` wraps the app and shows `CrashScreen` with a reload button.
- **Code only needed sometimes is loaded lazily:** the onboarding is loaded with `app/lib/namedLazyLoad.ts` inside `Suspense`.
- The interface bundle is minified (`electron.vite.config.ts`). Its main file is about 510 kB; the size warning is set to 800 kB, because the file is read from disk, not downloaded, and roughly half of it is `react-dom`. If it shows, find out what grew before raising the limit.
- **Every language is bundled** (about 5 kB each). Loading only the one in use would make reading messages asynchronous everywhere; revisit at around ten languages.
