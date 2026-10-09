# Trophy Tracker

Desktop app (Electron + React) that shows, for the game open on Steam, which achievements are missing, what the hidden ones are, progress counters, your own checklists and shortcuts to guides. Available in English, Brazilian Portuguese, Spanish and French, for Windows, macOS and Linux.

Not affiliated with Valve or Steam.

## Install

Download the installer for your system from the [latest release](https://github.com/joaosoarees/trophy-tracker/releases/latest):

| System  | File                                                                                       |
| ------- | ------------------------------------------------------------------------------------------ |
| Windows | `Trophy-Tracker-<version>-Windows.exe`                                                     |
| macOS   | `Trophy-Tracker-<version>-macOS-arm64.dmg` (Apple Silicon) or `-macOS-x64.dmg` (Intel)     |
| Linux   | `Trophy-Tracker-<version>-Linux.AppImage` (any distribution) or `-Linux-Debian-Ubuntu.deb` |

The installers are not signed with a paid certificate yet, so the system warns on first run:

- **Windows:** on the SmartScreen warning, choose "More info" and then "Run anyway". If **Smart App Control** is on (Windows Security → App & browser control), Windows may refuse to run the installer altogether, with no way to allow it: an unsigned installer only runs there when Microsoft's reputation service happens to accept it. Signing the installers is being arranged.
- **macOS:** after the first attempt to open the app, go to System Settings → Privacy & Security and choose "Open Anyway".
- **Linux:** `sudo apt install ./Trophy-Tracker-<version>-Linux-Debian-Ubuntu.deb`, or make the AppImage executable (`chmod +x`) and run it.

On first run the app asks for a language, your SteamID and a Web API key (https://steamcommunity.com/dev/apikey), and checks your profile privacy. The app looks for a newer version as it opens. On Windows and with the Linux AppImage it downloads the version, showing the progress, and restarts into it; a version found while the app is in use downloads in the background and the app asks before restarting. On macOS and with the `.deb`, the app says a version is available and links to the download (on macOS, straight to the disk image for that Mac).

Your data stays on your computer, in `%APPDATA%\trophy-tracker` (Windows), `~/Library/Application Support/trophy-tracker` (macOS) or `~/.config/trophy-tracker` (Linux).

## Development

```bash
corepack enable   # once; provides the pnpm version pinned in package.json
pnpm install
```

The project only installs with pnpm; `npm install` and `yarn` are refused. On WSL or a minimal Linux, Electron also needs `sudo apt install libnss3 libnspr4 libasound2t64`.

```bash
pnpm dev     # development, with reload
pnpm build && pnpm start
pnpm test
pnpm lint && pnpm typecheck
```

## Building the installers

```bash
pnpm dist          # installers for the system you are on, into dist/
pnpm dist:docker   # Linux and Windows installers, built inside a container
pnpm test:package  # installs the .deb in a clean container and checks that the app starts
```

macOS installers can only be built on macOS. Pushing a `v<version>` tag makes GitHub Actions build the installers for the three systems and publish them as a release.

## Privacy

Trophy Tracker has no server and collects nothing. It talks only to:

- **Steam** (`api.steampowered.com` and Steam's image servers), with the Web API key and SteamID you provide, to read your games and achievements;
- **GitHub** (`api.github.com` and `github.com`), to look for a newer version and, on Windows and the Linux AppImage, to download it.

Your key, notes and checklists are stored only on your computer. Errors are written to a local log file and are never sent anywhere.

## Code signing policy

The installers are built from this repository by GitHub Actions (`.github/workflows/release.yml`), from a version tag that only the maintainer can create.

- **Author, reviewer and approver:** [Joao Soares](https://github.com/joaosoarees), the only person with write access to the repository.
- Changes from anyone else arrive as pull requests and are reviewed before they are merged.

The installers are not signed yet.

## License

[MIT](LICENSE)
