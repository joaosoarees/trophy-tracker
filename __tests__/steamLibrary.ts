import { type IRawPlayerAchievement } from '../src/main/steam/SteamClient';

import { type IRoute } from './helpers';

/** One game of a library, as `GetOwnedGames` lists it. */
export const game = (
  appid: number,
  name: string,
  playtime: number,
  last = 0,
) => ({
  appid,
  name,
  playtime_forever: playtime,
  img_icon_url: 'abc',
  rtime_last_played: last,
});

/** The answer of `GetOwnedGames` for a library with these games. */
export const owned = (...games: ReturnType<typeof game>[]): IRoute => ({
  json: { response: { game_count: games.length, games } },
});

/**
 * What a player has in a game with `total` achievements, named `A0`, `A1` and
 * so on, of which the first `unlocked` are unlocked.
 */
export const achieved = (
  unlocked: number,
  total: number,
): IRawPlayerAchievement[] =>
  Array.from({ length: total }, (_, i) => ({
    apiname: `A${i}`,
    achieved: i < unlocked ? 1 : 0,
    unlocktime: 0,
  }));

/** The answer of `GetPlayerAchievements` for that same game. */
export const player = (unlocked: number, total: number): IRoute => ({
  json: {
    playerstats: { success: true, achievements: achieved(unlocked, total) },
  },
});
