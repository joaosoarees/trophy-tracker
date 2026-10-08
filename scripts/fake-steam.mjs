// A stand-in for Steam's Web API, for `pnpm audit:ui`. It answers the calls
// the app makes, in the shape Steam answers them, from the real responses
// kept in test/fixtures, and lets the audit change what "Steam" says: unlock
// an achievement, reject the key, hide the profile, or go off the air.
//
// The app only talks to it in development, when started with
// TROPHY_TRACKER_FAKE_STEAM set to this server's address (see main/index.ts).
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const schemaOf = (appid) =>
  JSON.parse(
    readFileSync(
      new URL(
        `../test/fixtures/game-achievements-${appid}.json`,
        import.meta.url,
      ),
      'utf8',
    ),
  ).response.achievements;

const DAY = 86_400;
/** A fixed "now", so dates on screen are the same on every run. */
const NOW = 1_790_000_000;

/**
 * The library of the account being audited. Two real games, with their real
 * achievements, plus two edge cases a library always has.
 */
function library() {
  const nioh = schemaOf(3681010);
  return [
    {
      appid: 3681010,
      name: 'Nioh 3',
      playtime: 2407,
      lastPlayed: NOW - DAY,
      schema: nioh,
      // Far from done, with hidden and counted achievements still pending.
      unlocked: 20,
    },
    {
      appid: 2638890,
      name: 'Onimusha: Way of the Sword',
      playtime: 1530,
      lastPlayed: NOW - 3 * DAY,
      schema: schemaOf(2638890),
      // Two short of done: the audit unlocks them to reach 100%.
      unlocked: 50,
    },
    {
      appid: 999001,
      name: 'A Short Game Already Finished',
      playtime: 95,
      lastPlayed: NOW - 40 * DAY,
      schema: nioh.slice(0, 5),
      unlocked: 5,
    },
    {
      appid: 999002,
      name: 'A Game With No Achievements',
      playtime: 610,
      lastPlayed: NOW - 60 * DAY,
      schema: [],
      unlocked: 0,
    },
  ];
}

const FORBIDDEN_HTML =
  '<html><head><title>Forbidden</title></head><body><h1>Forbidden</h1>Access is denied.</body></html>';

export async function startFakeSteam() {
  const games = library();
  const state = {
    /** `ok`, `bad-key` (Steam rejects the key), `private` (profile hidden) or `down` (no answer at all). */
    mode: 'ok',
    /** AppID "being played", as the profile reports it; `null` for none. */
    running: null,
    requests: [],
  };
  const game = (appid) => games.find((g) => g.appid === Number(appid));

  const answer = (url) => {
    const query = url.searchParams;
    const path = url.pathname;
    const withKey = query.has('key');

    if (path.startsWith('/github/')) return [404, { message: 'Not Found' }];
    if (state.mode === 'bad-key' && withKey) return [403, FORBIDDEN_HTML];

    if (path.includes('GetPlayerSummaries')) {
      return [
        200,
        {
          response: {
            players: [
              {
                steamid: query.get('steamids'),
                personaname: 'Audit Hunter',
                avatarfull: '',
                ...(state.running ? { gameid: String(state.running) } : {}),
              },
            ],
          },
        },
      ];
    }
    if (path.includes('GetOwnedGames')) {
      if (state.mode === 'private') return [200, { response: {} }];
      return [
        200,
        {
          response: {
            game_count: games.length,
            games: games.map((g) => ({
              appid: g.appid,
              name: g.name,
              playtime_forever: g.playtime,
              img_icon_url: '',
              rtime_last_played: g.lastPlayed,
            })),
          },
        },
      ];
    }
    if (path.includes('GetGameAchievements')) {
      const found = game(query.get('appid'));
      return [200, { response: found ? { achievements: found.schema } : {} }];
    }
    if (path.includes('GetPlayerAchievements')) {
      if (state.mode === 'private') {
        return [
          403,
          { playerstats: { error: 'Profile is not public', success: false } },
        ];
      }
      const found = game(query.get('appid'));
      if (!found || found.schema.length === 0) {
        return [
          400,
          {
            playerstats: {
              error: 'Requested app has no stats',
              success: false,
            },
          },
        ];
      }
      return [
        200,
        {
          playerstats: {
            success: true,
            achievements: found.schema.map((achievement, index) => ({
              apiname: achievement.internal_name,
              achieved: index < found.unlocked ? 1 : 0,
              // One a day, ending a few days ago.
              unlocktime:
                index < found.unlocked
                  ? NOW - (found.schema.length - index) * DAY
                  : 0,
            })),
          },
        },
      ];
    }
    if (path.includes('GetUserStatsForGame')) {
      return [200, { playerstats: { stats: [] } }];
    }
    if (path.includes('IStoreBrowseService/GetItems')) {
      return [200, { response: { store_items: [] } }];
    }
    return [404, { error: `the fake Steam does not know ${path}` }];
  };

  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://fake-steam');
    state.requests.push(url.pathname);
    if (state.mode === 'down') {
      // No answer at all, as when Steam cannot be reached.
      request.socket.destroy();
      return;
    }
    const [status, body] = answer(url);
    response.writeHead(status, {
      'content-type':
        typeof body === 'string' ? 'text/html' : 'application/json',
    });
    response.end(typeof body === 'string' ? body : JSON.stringify(body));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  return {
    url: `http://127.0.0.1:${server.address().port}`,
    state,
    games,
    /** Unlocks the next pending achievement of a game and answers its name. */
    unlockNext(appid) {
      const found = game(appid);
      const achievement = found.schema[found.unlocked];
      found.unlocked += 1;
      return achievement.localized_name;
    },
    stop: () => new Promise((resolve) => server.close(resolve)),
  };
}
