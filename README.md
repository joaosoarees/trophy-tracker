# Steam Achievements

Desktop app (Electron + React) that shows, for the game open on Steam, which achievements are missing, what the hidden ones are, progress counters, your own checklists and shortcuts to guides. Available in English and Brazilian Portuguese. It runs on WSL (window through WSLg) and talks to the Steam client on Windows.

## Setup

```bash
sudo apt install libnss3 libnspr4 libasound2t64   # libraries Electron needs
corepack enable   # once; provides the pnpm version pinned in package.json
pnpm install
```

The project only installs with pnpm; `npm install` and `yarn` are refused.

## Usage

```bash
pnpm dev     # development, with reload
pnpm build && pnpm start
pnpm test
pnpm lint && pnpm typecheck
```

On first run the app asks for a language, your SteamID and a Web API key (https://steamcommunity.com/dev/apikey), and checks your profile privacy. The configuration lives in `~/.config/steam-trophy-tracker/`.
