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

- **Opening a game** serves the cached view at once; a view older than 60 s triggers one background refresh. What that refresh finds reaches the interface only while the account it was read for is still in use (`docs/accounts.md`).
- **Game open:** every 60 s it re-reads only the player state (and counters, if the game has them). The achievement list is cached for 24 h. The ↻ button forces everything.
- **A game the library does not list costs one library read, not one per check.** The name of a game comes from the library (`GetOwnedGames`, reused for 10 minutes). When the library on hand does not list the game, it is asked for again once, since the game may have joined it after that answer; an answer that was just read, or was already found not to list the game, is not asked for again until it is 10 minutes old (`Tracker.gameName`). The game is then named `App <appid>`: the achievement list (`GetGameAchievements`) carries no game name, and the app reads none from any other answer.
- **No change, no event:** `Tracker.getGame` returns the same object when nothing changed, and the main process emits `game-updated` only when the object is a different one.
- **Dashboard:** loads on startup, on ↻ (`all`) and when a game closes (`changed`: only games whose playtime changed).
- **One dashboard read at a time.** `Tracker` shares a read only with a request in the same mode, so a second mode would run beside the first: twice the requests, and two counts of progress. The interface asks for one at a time (`dashboardSlice.load`). A read asked for during another one (`changed`, as a game closes; the read in flight took the library, and so the playtime, before that) is remembered and runs when the one in flight ends, in the strongest mode asked; when that one failed it goes with the next read instead, and nothing is asked again by itself. `cached` asked during a read asks nothing more.
- **A dashboard that fails stops asking.** Its games are read four at a time (`Tracker.pool`). Once the read of one fails with an error that fails the dashboard, no other game is started; the reads already in flight end, what they read is saved with what was read before, and only then does the dashboard answer the error, so nothing is asked, saved or announced as progress after it. Asking again (`cached`) reads only the games that were not read. A game with no stats, or one Steam fails with an `unknown` error, does not fail the dashboard (`Tracker.readSummary`).
- **A request to Steam is given up on after 15 seconds** (`REQUEST_TIMEOUT_MS` in `steam/SteamClient.ts`, the only place the number is written; it is the owner's choice and was not measured against Steam). The limit is per request and covers the answer to its end, the text included. A request that ran out of time fails as one that could not reach Steam (`SteamError('network')`): the same message, and nothing is retried that a dropped connection would not retry. No caller gives a request a limit of its own.
- **What the limit means for a read that makes several requests:** each has its own 15 seconds, so a read waits for as long as its requests follow one another. With Steam answering nothing, every read fails at its first request, after one limit: the dashboard fails at the library, and one that already has the library fails when the four games in flight run out together, since no other game is started after a failure. The art of a game is asked for beside its other requests, and its failure is ignored, but the game still waits for it to end.
- **Identical simultaneous requests** share one read per account (`Tracker.once`), so a switch in the middle of a read never files one account's data under another (`docs/accounts.md`).
- `services/RunningGame.ts` uses the registry when there is one, the Web API otherwise. When a call fails it reuses the last answer, so a network failure does not look like the game closing.
- Off Windows, the running game is asked about on the profile of the client's account when the app has it (`RunningGame.ts`), not on the one in use (`docs/accounts.md`).
- When a game closes, `GameWatcher` keeps it as the last one played. It does not ask the library: the cached copy still names the game played before.
- **Periodic checks** live in `GameWatcher`: running game every 10 s, unlocks every 60 s. Where the running game comes from the Web API, that check reaches Steam at most every 30 s.
- **One check of each kind at a time** (`GameWatcher.once`). A check waits on Steam, for up to the 15 seconds of a request, which is longer than the 10 seconds between two looks for the running game. A check whose time comes round while the one before it has not ended is not started: the one in flight answers for it. Run beside it, the second would see what the first is still acting on and do it again: a game that closed would get two last reads and be announced twice. The last read of a game that closed joins the read of that game already in flight. A check begun for an account that was left is not waited for (`docs/accounts.md`).
- **Update check:** once when the app opens, then at most every six hours (an hourly timer asks whether they have passed). A version being downloaded or already downloaded is not looked for again. A window reload does not check.
- **Art and names** are cached on disk; a store failure never takes the screen down.
- When touching this, measure before and after: count HTTP and IPC calls on startup, while idle and when switching tabs.
