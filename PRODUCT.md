# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

The interface is web technology (React) inside an Electron window, on Windows, macOS and Linux. It has its own design language on every system; it does not imitate each system's native controls.

## Users

Steam players who hunt achievements, most of them going for 100% of a game. They keep the app open beside the game, typically on a second monitor, and look at it in short glances between or during play. It was built first for its author's own use and is meant for any achievement hunter.

Their job: know what is still missing in the game they are playing right now, understand what each missing achievement asks for, and track the parts Steam does not track for them.

## Product Purpose

Trophy Tracker shows, for the game open on Steam, which achievements are missing, what the hidden ones are, how far along the counted ones are, and where to learn how to get each one. It exists because Steam lists pending achievements without saying how to get them, hides the hidden ones, and spreads progress across one page per game.

Success is a player who never has to leave the game to find out what is left, and who can finish a game's achievements without keeping notes somewhere else.

## Positioning

Four things together, each confirmed as essential to what the product is:

- **It follows the running game.** It detects the game open on Steam and switches to it by itself, with the hidden achievements revealed.
- **Real counters and the user's own checklists.** It shows Steam's progress counters and lets the user list what Steam does not report, such as which collectibles are still missing.
- **Local and private.** No account, no server, no telemetry. It talks only to Steam and, for updates, to GitHub. Everything the user writes stays on their computer.
- **A shortcut to guides.** One click searches how to get an achievement on the Steam community guides, YouTube or Google.

## Operating Context

- A narrow window (600 px wide by default, never under 480) placed beside a game, read at a glance.
- The user is mid-game: attention is on the game, and visits to the app are brief.
- Setup happens once: language, SteamID and the user's own Steam Web API key, with a check that the profile's game details are public.
- With no game open, the app shows the last one played; a dashboard lists every played game by how close it is to completion.
- Notes, pins and checklists are written by the user per achievement and kept across sessions.
- A system notification announces an achievement unlocked while playing.

## Capabilities and Constraints

- **Languages:** English (default), Brazilian Portuguese, Spanish and French. The language changes the whole app, including achievement names and art, which come from Steam already translated. Spanish and French labels are the longest and must fit the narrow window.
- **Data comes from the official Steam Web API** with the user's key, plus one file of the local Steam client that links counters to achievements. The app never invents a value: an achievement whose counter cannot be read shows no counter.
- **Steam does not report** which achievements belong to DLC, nor which items are missing in a "collect them all"; the user's checklist exists for that.
- **Running-game detection** is instant on Windows; on macOS and Linux it depends on the Steam profile showing the game being played.
- **Dark theme only.**
- **Terminology:** "achievements" in the interface (the name is Trophy Tracker, but Steam's word is used throughout); "counter" for Steam's numeric progress; "checklist" for the user's own list; "Dashboard" for the list of played games.
- **Updates:** the app updates itself on Windows and on the Linux AppImage, and announces new versions elsewhere. Installers are not code-signed yet.

## Brand Commitments

- **Name:** Trophy Tracker. **Icon:** a trophy on a navy background (`build/icon.svg`, `build/icon.png`).
- **Not affiliated with Valve or Steam**, and says so in the app and the README.
- **Free and open source** under the MIT license, with no paid tier planned.
- **Voice:** plain, direct sentences that say what happened and what to do next; no jargon and no exclamation, except the one moment of finishing a game.

## Evidence on Hand

- Real Steam API responses used as test fixtures (`test/fixtures`: Nioh 3 and Onimusha: Way of the Sword).
- Three published releases (v0.1.0 to v0.3.0) at https://github.com/joaosoarees/trophy-tracker/releases.
- The README's Privacy and Code signing policy sections.

There are no users beyond the author yet: no testimonials, download figures, reviews or press exist, and none may be implied.

## Product Principles

1. **The game comes first.** The app is glanced at, not studied. Anything that costs attention has to earn it.
2. **Never wait, never lie.** Show what is already known at once; never show a value that was not read or keep showing one that was not saved.
3. **The user's data is the user's.** Nothing leaves the computer except the requests to Steam and the update check.
4. **Fill what Steam leaves out, with the user's own hand.** Where Steam gives no data, give the user a simple place to keep it rather than guessing.
5. **Say it in the user's language.** Every text, error and achievement name follows the chosen language.

## Accessibility & Inclusion

- Every screen passes an automated accessibility audit (axe) with zero violations, and that is kept.
- Everything clickable is reachable by keyboard and shows hover, pressed and focus states.
- State is announced to assistive technology, not only drawn.
- Motion is short, small and turned off under the system's reduced-motion preference.
