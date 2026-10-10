# Steam data: sources and read policy

The rules below are binding; `CLAUDE.md` sends you here before you change what is read from Steam, where it is read from, or how often (`steam/SteamClient.ts`, `services/Tracker.ts`, `services/GameWatcher.ts`, `services/RunningGame.ts`, the update check).

How a read reaches the screen (the last known view first, skeletons on first loads) is in `docs/store.md`, under Optimistic UI.

## Rules

### Data sources

| Data                                                          | Source                                                      | Key? |
| ------------------------------------------------------------- | ----------------------------------------------------------- | ---- |
| Achievement list, hidden descriptions, counter target, rarity | `IPlayerService/GetGameAchievements` (in the app language)  | no   |
| Unlocked or not, and when                                     | `ISteamUserStats/GetPlayerAchievements`                     | yes  |
| Current counter values                                        | `ISteamUserStats/GetUserStatsForGame`                       | yes  |
| Which stat feeds each counter                                 | local file `appcache/stats/UserGameStatsSchema_<appid>.bin` | —    |
| Library and playtime                                          | `IPlayerService/GetOwnedGames`                              | yes  |
| Game art                                                      | `IStoreBrowseService/GetItems` (batched)                    | no   |
| Name and avatar in the onboarding; running game off Windows   | `ISteamUser/GetPlayerSummaries`                             | yes  |

- **Do not use the public community profile page** (`steamcommunity.com/profiles/<id>/?xml=1`): it rate-limits (HTTP 429). A SteamID is confirmed together with the key, through the official API.
- Only the local Steam client file says which stat feeds a counter. Without it the achievement shows no counter: never invent a value.
- Steam does not report which achievements belong to DLC (`groupid` is always 0), nor which items are missing in a "collect them all". The user checklist exists for that.
- Game art has no fixed path (`header.jpg` returns 404 for new games); the hashed path comes only from the store service.
- Achievement icons must come from `shared.fastly.steamstatic.com/community_assets/images`. The older `steamcommunity/public/images` hosts return 404 for newer (DLC) achievements.
- A key error comes back as HTML with status 403; a private profile comes back as JSON with 403.

### Read policy

Do not fire requests for nothing.

- **Opening a game** serves the cached view at once; a view older than 60 s triggers one background refresh.
- **Game open:** every 60 s it re-reads only the player state (and counters, if the game has them). The achievement list is cached for 24 h. The ↻ button forces everything.
- **No change, no event:** `Tracker.getGame` returns the same object when nothing changed, and the main process emits `game-updated` only when the object is a different one.
- **Dashboard:** loads on startup, on ↻ (`all`) and when a game closes (`changed`: only games whose playtime changed).
- **A dashboard that fails stops asking.** Its games are read four at a time (`Tracker.pool`). Once the read of one fails with an error that fails the dashboard, no other game is started; the reads already in flight end, what they read is saved with what was read before, and only then does the dashboard answer the error, so nothing is asked, saved or announced as progress after it. Asking again (`cached`) reads only the games that were not read. A game with no stats, or one Steam fails with an `unknown` error, does not fail the dashboard (`Tracker.readSummary`).
- **Identical simultaneous requests** share one read per account (`Tracker.once`), so a switch in the middle of a read never files one account's data under another (`docs/accounts.md`).
- `services/RunningGame.ts` uses the registry when there is one, the Web API otherwise. When a call fails it reuses the last answer, so a network failure does not look like the game closing.
- Off Windows, the running game is asked about on the profile of the client's account when the app has it (`RunningGame.ts`), not on the one in use (`docs/accounts.md`).
- When a game closes, `GameWatcher` keeps it as the last one played. It does not ask the library: the cached copy still names the game played before.
- **Periodic checks** live in `GameWatcher`: running game every 10 s, unlocks every 60 s. Where the running game comes from the Web API, that check reaches Steam at most every 30 s.
- **Update check:** once when the app opens, then at most every six hours (an hourly timer asks whether they have passed). A version being downloaded or already downloaded is not looked for again. A window reload does not check.
- **Art and names** are cached on disk; a store failure never takes the screen down.
- When touching this, measure before and after: count HTTP and IPC calls on startup, while idle and when switching tabs.
