<p align="center">
  <img src="build/icon.png" width="96" alt="" />
</p>

<h1 align="center">Trophy Tracker</h1>

<p align="center">
  See what is left in the Steam game you are playing, without leaving the game.
</p>

<p align="center">
  <a href="https://github.com/joaosoarees/trophy-tracker/releases/latest"><img src="https://img.shields.io/github/v/release/joaosoarees/trophy-tracker?label=release" alt="Latest release" /></a>
  <a href="https://github.com/joaosoarees/trophy-tracker/actions/workflows/ci.yml"><img src="https://github.com/joaosoarees/trophy-tracker/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://codecov.io/gh/joaosoarees/trophy-tracker"><img src="https://codecov.io/gh/joaosoarees/trophy-tracker/graph/badge.svg" alt="Test coverage" /></a>
  <img src="https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-2b3544" alt="Windows, macOS and Linux" />
  <a href="LICENSE"><img src="https://img.shields.io/github/license/joaosoarees/trophy-tracker" alt="MIT license" /></a>
</p>

<p align="center">
  <strong>English</strong> · <a href="README.pt-BR.md">Português</a>
</p>

<p align="center">
  <img src="docs/screenshots/unlock.gif" width="600" alt="The app switches to the game that was started on Steam, shows an achievement as it is unlocked, and then the game finished at 100%." />
</p>

Steam lists the achievements you are missing without saying how to get them, hides the hidden ones, and spreads your progress across one page per game. Trophy Tracker is a narrow window that sits beside the game, on a second monitor, and answers the question an achievement hunter keeps asking: **what is left, and how do I get it?**

It is free, open source, and not affiliated with Valve or Steam.

## What it does

<table>
  <tr>
    <td width="50%" valign="top">
      <h3>It follows the game you open</h3>
      <p>Start a game on Steam and the app switches to it by itself. With no game open, it shows the last one you played. An achievement unlocked while you play shows up on its own, with how many are left.</p>
      <h3>Hidden achievements, revealed</h3>
      <p>Names and descriptions of the achievements Steam hides, how rare each one is, and Steam's own progress counters where a game has them.</p>
      <h3>One click to a guide</h3>
      <p>Each achievement opens a search for how to get it, on the Steam community guides, YouTube or Google.</p>
    </td>
    <td width="50%">
      <img src="docs/screenshots/game.png" alt="The Game screen: a game's header with its progress, and the list of pending achievements, each with its rarity, guide links and the user's tools." />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="docs/screenshots/game-details.png" alt="The details of a game: time played, last played, the rarest achievement and the counted ones." />
    </td>
    <td width="50%" valign="top">
      <h3>What Steam does not track, you do</h3>
      <p>Steam will not tell you which collectibles you are missing. Every achievement can carry your own checklist, a note and a pin, kept on your computer between sessions.</p>
      <h3>Every game, by how close it is</h3>
      <p>A dashboard lists what you have played, sorted by how close each game is to 100%, and a finished game gets the one celebration in the app.</p>
      <p><img src="docs/screenshots/dashboard.png" alt="The dashboard: played games with their progress." /></p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>Several accounts</h3>
      <p>Add more than one Steam account and switch between them in one click; each keeps its own key, notes and checklists. On Windows the app follows whichever account is signed in to Steam.</p>
      <h3>In your language</h3>
      <p>English, Brazilian Portuguese, Spanish and French. The language changes the whole app, including the achievement names Steam sends.</p>
    </td>
    <td width="50%">
      <img src="docs/screenshots/settings.png" alt="Settings: two accounts as cards, the one in use with its masked key." />
    </td>
  </tr>
</table>

## Download

Get the installer for your system from the [latest release](https://github.com/joaosoarees/trophy-tracker/releases/latest):

| System  | File                                                                                       |
| ------- | ------------------------------------------------------------------------------------------ |
| Windows | `Trophy-Tracker-<version>-Windows.exe`                                                     |
| macOS   | `Trophy-Tracker-<version>-macOS-arm64.dmg` (Apple Silicon) or `-macOS-x64.dmg` (Intel)     |
| Linux   | `Trophy-Tracker-<version>-Linux.AppImage` (any distribution) or `-Linux-Debian-Ubuntu.deb` |

On first run the app asks for a language, your SteamID and your own [Steam Web API key](https://steamcommunity.com/dev/apikey), and checks that your profile's game details are public. On Windows and with the Linux AppImage it then keeps itself up to date; on macOS and with the `.deb` it tells you when there is a new version.

**The installers are not signed**, and there is no date for that to change, so the system warns on first run:

- **Windows:** on the SmartScreen warning, choose "More info" and then "Run anyway". If **Smart App Control** is on (Windows Security → App & browser control), Windows may refuse to run the installer altogether, with no way to allow it.
- **macOS:** after the first attempt to open the app, go to System Settings → Privacy & Security and choose "Open Anyway".
- **Linux:** `sudo apt install ./Trophy-Tracker-<version>-Linux-Debian-Ubuntu.deb`, or make the AppImage executable (`chmod +x`) and run it.

What changed in each version is in the [changelog](CHANGELOG.md).

## Privacy

Trophy Tracker has no account, no server and no telemetry. It talks only to:

- **Steam** (`api.steampowered.com` and Steam's image servers), with the Web API key and SteamID you provide, to read your games and achievements;
- **GitHub** (`api.github.com` and `github.com`), to look for a newer version and, on Windows and the Linux AppImage, to download it.

Your keys, notes and checklists are stored only on your computer, in `%APPDATA%\trophy-tracker` (Windows), `~/Library/Application Support/trophy-tracker` (macOS) or `~/.config/trophy-tracker` (Linux). A saved key is never shown again, only its last four characters. Errors are written to a local log file and are never sent anywhere.

## How it is built

Electron, React and TypeScript, with the care a small tool rarely gets:

- **Tested where it decides something.** 430 tests cover the logic that reads Steam, keeps your data and updates the app. They run on Windows, macOS and Linux on every push, and the badge above says how much of that logic they cover.
- **The interface is audited by a script, not by memory.** `pnpm audit:ui` drives the built app against a stand-in for Steam, once per language: it goes through the setup, every screen and the flows no single picture shows (a game starting, an achievement unlocked, Steam going off the air), checking accessibility with axe, keyboard focus, hover and overflow. The pictures on this page come from the same stand-in.
- **A catalogue of components.** `pnpm storybook` shows each building block alone, in every state, in the four languages and at the two widths the window is built for.
- **Your files cannot be lost to a crash.** Each one is written whole before it replaces the previous, and a file that cannot be read is kept aside, never overwritten.
- **Releases build themselves.** A version tag makes GitHub Actions build and test the installers on the three systems and publish them with their notes.
- **A written design system** ([DESIGN.md](DESIGN.md)) and the reasons behind the choices that are not obvious ([docs/DECISIONS.md](docs/DECISIONS.md)).

## Development

```bash
corepack enable   # once; provides the pnpm version pinned in package.json
pnpm install
pnpm dev          # the app, with reload
```

The project only installs with pnpm. On WSL or a minimal Linux, Electron also needs `sudo apt install libnss3 libnspr4 libasound2t64`.

```bash
pnpm test && pnpm lint && pnpm typecheck
pnpm audit:ui      # the interface audit
pnpm storybook     # the catalogue of components
pnpm dist          # installers for the system you are on, into dist/
pnpm screenshots   # the pictures of this page
```

How the code is organised and the rules it follows are in [CLAUDE.md](CLAUDE.md); how releases and the audit work, in [docs/](docs).

## License

[MIT](LICENSE)
