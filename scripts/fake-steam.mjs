// A stand-in for Steam, for `pnpm audit:ui`. It answers the Web API calls the
// app makes, in the shape Steam answers them and in the language asked for,
// from the real responses kept in test/fixtures, and lets the audit change
// what "Steam" says: unlock an achievement, start a game, reject the key,
// hide the profile, or go off the air. It also writes the two files of a
// Steam client's folder that the app reads.
//
// The app only talks to it in development, when started with
// TROPHY_TRACKER_FAKE_STEAM set to this server's address (see main/index.ts).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';

/** The file of each language Steam can be asked for (`language=`). */
const FIXTURE_SUFFIX = {
  english: '.en',
  brazilian: '',
  spanish: '.es',
  french: '.fr',
};

const schemaOf = (appid, language) =>
  JSON.parse(
    readFileSync(
      new URL(
        `../test/fixtures/game-achievements-${appid}${FIXTURE_SUFFIX[language] ?? '.en'}.json`,
        import.meta.url,
      ),
      'utf8',
    ),
  ).response.achievements;

const DAY = 86_400;
/** A fixed "now", so dates on screen are the same on every run. */
const NOW = 1_790_000_000;

/**
 * The library of the account being audited: two real games, with their real
 * achievements and store art, plus two cases every library has.
 */
const LIBRARY = [
  {
    appid: 3681010,
    name: 'Nioh 3',
    playtime: 2407,
    lastPlayed: NOW - DAY,
    source: 3681010,
    // Far from done, with hidden and counted achievements still pending.
    unlocked: 20,
    art: {
      asset_url_format: 'steam/apps/3681010/${FILENAME}?t=1772090941',
      header: 'a21264e9fd476dcb2901c2432b598107d024c5a8/header.jpg',
      small_capsule:
        '19b0758706fefb5c06a6183365fd62dafe2bf914/capsule_231x87.jpg',
    },
  },
  {
    appid: 2638890,
    name: 'Onimusha: Way of the Sword',
    playtime: 1530,
    lastPlayed: NOW - 3 * DAY,
    source: 2638890,
    // Two short of done: the audit unlocks them to reach 100%.
    unlocked: 50,
    art: {
      asset_url_format: 'steam/apps/2638890/${FILENAME}?t=1790383151',
      header: 'ce31174fea86d0bafa21b26e853dcd0b7326e36f/header.jpg',
      small_capsule:
        '4aa8bcfcb20173a0250f03ee15473abece15f6b0/capsule_231x87.jpg',
    },
  },
  {
    appid: 999001,
    name: 'A Short Game Already Finished',
    playtime: 95,
    lastPlayed: NOW - 40 * DAY,
    // The first five achievements of a real game.
    source: 3681010,
    take: 5,
    unlocked: 5,
  },
  {
    appid: 999002,
    name: 'A Game With No Achievements',
    playtime: 610,
    lastPlayed: NOW - 60 * DAY,
    source: null,
    unlocked: 0,
  },
];

const achievementsOf = (game, language = 'english') =>
  game.source === null
    ? []
    : schemaOf(game.source, language).slice(0, game.take);

/** The stat that feeds a counted achievement, as the client's file names it. */
const statOf = (achievement) => `STAT_${achievement.internal_name}`;

// The binary KeyValues format of the client's appcache/stats files.
const text = (value) =>
  Buffer.concat([Buffer.from(value, 'utf8'), Buffer.from([0])]);
const object = (key, ...children) =>
  Buffer.concat([Buffer.from([0]), text(key), ...children, Buffer.from([8])]);
const string = (key, value) =>
  Buffer.concat([Buffer.from([1]), text(key), text(value)]);

/**
 * Writes what the app reads from a Steam client's folder: who is signed in,
 * and which stat feeds each counted achievement of each game.
 */
export function writeFakeSteamFolder(home, steamId) {
  const steam = join(home, '.local', 'share', 'Steam');
  mkdirSync(join(steam, 'config'), { recursive: true });
  mkdirSync(join(steam, 'appcache', 'stats'), { recursive: true });
  writeFileSync(
    join(steam, 'config', 'loginusers.vdf'),
    `"users"\n{\n\t"${steamId}"\n\t{\n\t\t"MostRecent"\t\t"1"\n\t}\n}\n`,
  );

  for (const game of LIBRARY) {
    const counted = achievementsOf(game).filter(
      (achievement) => achievement.max_progress_int > 0,
    );
    if (counted.length === 0) continue;
    const bits = counted.map((achievement, index) =>
      object(
        String(index),
        string('name', achievement.internal_name),
        object(
          'progress',
          object(
            'value',
            string('operation', 'statvalue'),
            string('operand1', statOf(achievement)),
          ),
        ),
      ),
    );
    writeFileSync(
      join(steam, 'appcache', 'stats', `UserGameStatsSchema_${game.appid}.bin`),
      Buffer.concat([
        object(
          String(game.appid),
          object('stats', object('1', object('bits', ...bits))),
        ),
        Buffer.from([8]),
      ]),
    );
  }
}

const FORBIDDEN_HTML =
  '<html><head><title>Forbidden</title></head><body><h1>Forbidden</h1>Access is denied.</body></html>';

/**
 * A second account of the same person, for what happens between two: it has
 * played one of the same games, and is much further from finishing it.
 */
export const SECOND_STEAM_ID = '76561198000000043';

export async function startFakeSteam() {
  const games = LIBRARY.map((game) => ({ ...game }));
  const secondGames = [
    { ...LIBRARY[1], playtime: 310, lastPlayed: NOW - 2 * DAY, unlocked: 10 },
  ];
  /** The library of whoever is asked about; anyone but the second account is the first. */
  const libraryOf = (steamId) =>
    steamId === SECOND_STEAM_ID ? secondGames : games;
  const state = {
    /** `ok`, `bad-key` (Steam rejects the key), `private` (profile hidden) or `down` (no answer at all). */
    mode: 'ok',
    /** AppID "being played", as the profile reports it; `null` for none. */
    running: null,
  };
  const game = (appid) => games.find((g) => g.appid === Number(appid));

  const answer = (url) => {
    const query = url.searchParams;
    const path = url.pathname;

    if (path.startsWith('/github/')) return [404, { message: 'Not Found' }];
    if (state.mode === 'bad-key' && query.has('key')) {
      return [403, FORBIDDEN_HTML];
    }

    const owned = libraryOf(query.get('steamid'));
    const ownedGame = (appid) => owned.find((g) => g.appid === Number(appid));

    if (path.includes('GetPlayerSummaries')) {
      const isSecond = query.get('steamids') === SECOND_STEAM_ID;
      return [
        200,
        {
          response: {
            players: [
              {
                steamid: query.get('steamids'),
                personaname: isSecond ? 'Second Hunter' : 'Audit Hunter',
                avatarfull: '',
                // Only the first account plays during the audit.
                ...(state.running && !isSecond
                  ? { gameid: String(state.running) }
                  : {}),
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
            game_count: owned.length,
            games: owned.map((g) => ({
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
      const achievements = found
        ? achievementsOf(found, query.get('language'))
        : [];
      return [
        200,
        { response: achievements.length > 0 ? { achievements } : {} },
      ];
    }
    if (path.includes('GetPlayerAchievements')) {
      if (state.mode === 'private') {
        return [
          403,
          { playerstats: { error: 'Profile is not public', success: false } },
        ];
      }
      const found = ownedGame(query.get('appid'));
      const achievements = found ? achievementsOf(found) : [];
      if (achievements.length === 0) {
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
            achievements: achievements.map((achievement, index) => ({
              apiname: achievement.internal_name,
              achieved: index < found.unlocked ? 1 : 0,
              // One a day, ending a few days ago.
              unlocktime:
                index < found.unlocked
                  ? NOW - (achievements.length - index) * DAY
                  : 0,
            })),
          },
        },
      ];
    }
    if (path.includes('GetUserStatsForGame')) {
      const found = ownedGame(query.get('appid'));
      const achievements = found ? achievementsOf(found) : [];
      return [
        200,
        {
          playerstats: {
            // Done where the achievement is unlocked; elsewhere, somewhere
            // between a fifth and four fifths of the way.
            stats: achievements
              .map((achievement, index) => ({ achievement, index }))
              .filter(({ achievement }) => achievement.max_progress_int > 0)
              .map(({ achievement, index }) => ({
                name: statOf(achievement),
                value:
                  index < found.unlocked
                    ? achievement.max_progress_int
                    : Math.floor(
                        (achievement.max_progress_int * ((index % 4) + 1)) / 5,
                      ),
              })),
          },
        },
      ];
    }
    if (path.includes('IStoreBrowseService/GetItems')) {
      return [
        200,
        {
          response: {
            store_items: games
              .filter((g) => g.art)
              .map((g) => ({ appid: g.appid, assets: g.art })),
          },
        },
      ];
    }
    return [404, { error: `the fake Steam does not know ${path}` }];
  };

  const server = createServer((request, response) => {
    if (state.mode === 'down') {
      // No answer at all, as when Steam cannot be reached.
      request.socket.destroy();
      return;
    }
    const [status, body] = answer(new URL(request.url, 'http://fake-steam'));
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
    /** The achievement names of a game, in a language as Steam names it. */
    names: (appid, language) =>
      achievementsOf(game(appid), language).map(
        (achievement) => achievement.localized_name,
      ),
    /** The game starts: the profile shows it, and it becomes the last one played. */
    play(appid) {
      state.running = appid;
      game(appid).lastPlayed = NOW;
    },
    /** The game closes. */
    quit() {
      state.running = null;
    },
    /** Unlocks the next pending achievement of a game and answers its English name. */
    unlockNext(appid) {
      const found = game(appid);
      const achievement = achievementsOf(found)[found.unlocked];
      found.unlocked += 1;
      return achievement.localized_name;
    },
    stop: () => new Promise((resolve) => server.close(resolve)),
  };
}
