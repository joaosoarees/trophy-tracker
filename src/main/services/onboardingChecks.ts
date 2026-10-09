import type { Messages } from '@shared/i18n';
import { type CheckResult } from '@shared/types/Check';
import { type IProfile } from '@shared/types/Profile';
import { API_KEY_PATTERN, isSteamId } from '@shared/validation';

import {
  type SteamClient,
  SteamError,
  steamErrorMessage,
} from '../steam/client';

const fail = (error: string): { ok: false; error: string } => ({
  ok: false,
  error,
});
const message = (m: Messages, e: unknown): string =>
  e instanceof SteamError ? steamErrorMessage(m, e) : m.errors.unexpected;

/**
 * The key is valid if Steam accepts an authenticated call, and the SteamID if
 * that call finds its profile. Both are checked together because the key alone
 * does not say whose it is.
 */
export async function checkApiKey(
  m: Messages,
  client: SteamClient,
  steamId: string,
  apiKey: string,
): Promise<CheckResult<IProfile>> {
  const id = steamId.trim();
  const key = apiKey.trim();
  if (!isSteamId(id)) return fail(m.validation.steamIdFormat);
  if (!API_KEY_PATTERN.test(key)) return fail(m.validation.apiKeyFormat);
  try {
    const p = await client.getPlayerSummary({ steamId: id, apiKey: key });
    return {
      ok: true,
      value: { steamId: p.steamid, name: p.personaname, avatar: p.avatarfull },
    };
  } catch (e) {
    return fail(message(m, e));
  }
}

/** The library and the achievements must be visible to the Web API. */
export async function checkPrivacy(
  m: Messages,
  client: SteamClient,
  steamId: string,
  apiKey: string,
): Promise<CheckResult<{ gamesWithPlaytime: number }>> {
  const creds = { steamId: steamId.trim(), apiKey: apiKey.trim() };
  try {
    const games = await client.getOwnedGames(creds);
    if (games === null) return fail(m.check.privacyBlocked);
    const played = games
      .filter((g) => g.playtime_forever > 0)
      .sort((a, b) => (b.rtime_last_played ?? 0) - (a.rtime_last_played ?? 0));

    // A game with no achievements proves nothing; try the most recent ones until one answers.
    for (const game of played.slice(0, 5)) {
      try {
        await client.getPlayerAchievements(creds, game.appid);
        break;
      } catch (e) {
        if (e instanceof SteamError && e.kind === 'no-stats') continue;
        if (e instanceof SteamError && e.kind === 'private')
          return fail(m.check.privacyBlocked);
        throw e;
      }
    }
    return { ok: true, value: { gamesWithPlaytime: played.length } };
  } catch (e) {
    return fail(message(m, e));
  }
}
