# Trophy Tracker

Desktop app (Electron + React) that shows, for the game open on Steam, which achievements are missing, what the hidden ones are, progress counters, your own checklists and shortcuts to guides. Available in English and Brazilian Portuguese, for Windows, macOS and Linux.

Not affiliated with Valve or Steam.

## Install

Download the installer for your system from the [latest release](https://github.com/joaosoarees/trophy-tracker/releases/latest):

| System  | File                                                               |
| ------- | ------------------------------------------------------------------ |
| Windows | `Trophy-Tracker-Setup-<version>.exe`                               |
| macOS   | `Trophy-Tracker-<version>-arm64.dmg` (Apple Silicon) or `-x64.dmg` |
| Linux   | `Trophy-Tracker-<version>-amd64.deb` or `-x86_64.AppImage`         |

The installers are not signed with a paid certificate yet, so the system warns on first run:

- **Windows:** on the SmartScreen warning, choose "More info" and then "Run anyway".
- **macOS:** after the first attempt to open the app, go to System Settings → Privacy & Security and choose "Open Anyway".
- **Linux:** `sudo apt install ./Trophy-Tracker-<version>-amd64.deb`, or make the AppImage executable (`chmod +x`) and run it.

On first run the app asks for a language, your SteamID and a Web API key (https://steamcommunity.com/dev/apikey), and checks your profile privacy. When a newer version is released, the Settings screen says so and links to the download.

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

macOS installers can only be built on macOS. Pushing a `v<version>` tag makes GitHub Actions build the installers for the three systems and gather them in a draft release, which is then published by hand.
