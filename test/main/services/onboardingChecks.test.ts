import { describe, expect, it } from 'vitest';

import { checkApiKey, checkPrivacy } from '@main/services/onboardingChecks';
import { SteamClient } from '@main/steam/client';
import { en } from '@shared/i18n/locales/en';
import { ptBR } from '@shared/i18n/locales/pt-BR';
import {
  clientWith,
  fakeFetch,
  FORBIDDEN_HTML,
  KEY,
  NO_STATS,
  NOT_PUBLIC,
  STEAM_ID,
  type IRoute,
} from '@test/helpers';

const game = (appid: number, name: string, playtime: number, last = 0) => ({
  appid,
  name,
  playtime_forever: playtime,
  img_icon_url: 'abc',
  rtime_last_played: last,
});
const owned = (...games: ReturnType<typeof game>[]): IRoute => ({
  json: { response: { game_count: games.length, games } },
});
const player = (unlocked: number, total: number): IRoute => ({
  json: {
    playerstats: {
      success: true,
      achievements: Array.from({ length: total }, (_, i) => ({
        apiname: `A${i}`,
        achieved: i < unlocked ? 1 : 0,
        unlocktime: 0,
      })),
    },
  },
});

describe('onboarding: key', () => {
  it('rejects a bad format', async () => {
    expect(
      (await checkApiKey(ptBR, clientWith({}), STEAM_ID, 'short')).ok,
    ).toBe(false);
  });

  it('rejects a badly formed SteamID before asking Steam', async () => {
    const f = fakeFetch({});
    expect(await checkApiKey(en, new SteamClient(f), '12345', KEY)).toEqual({
      ok: false,
      error: 'A SteamID is a 17-digit number that starts with 7656.',
    });
    expect(f.calls).toHaveLength(0);
  });

  it('reports a SteamID that has no profile', async () => {
    const client = clientWith({
      GetPlayerSummaries: { json: { response: { players: [] } } },
    });
    expect(await checkApiKey(en, client, STEAM_ID, KEY)).toEqual({
      ok: false,
      error: 'No Steam profile was found with that SteamID.',
    });
  });

  it('rejects a key Steam does not accept', async () => {
    const r = await checkApiKey(
      ptBR,
      clientWith({ GetPlayerSummaries: FORBIDDEN_HTML }),
      STEAM_ID,
      KEY,
    );
    expect(r).toEqual({
      ok: false,
      error: 'A Steam recusou a chave da Web API.',
    });
  });

  it('answers in the requested language', async () => {
    const r = await checkApiKey(
      en,
      clientWith({ GetPlayerSummaries: FORBIDDEN_HTML }),
      STEAM_ID,
      KEY,
    );
    expect(r).toEqual({ ok: false, error: 'Steam rejected the Web API key.' });
  });

  it('accepts a valid key', async () => {
    const client = clientWith({
      GetPlayerSummaries: {
        json: {
          response: {
            players: [
              { steamid: STEAM_ID, personaname: 'player', avatarfull: 'x' },
            ],
          },
        },
      },
    });
    expect((await checkApiKey(ptBR, client, STEAM_ID, KEY)).ok).toBe(true);
  });
});

describe('onboarding: privacy', () => {
  it('rejects when the library is not visible', async () => {
    expect(
      (
        await checkPrivacy(
          ptBR,
          clientWith({ GetOwnedGames: { json: { response: {} } } }),
          STEAM_ID,
          KEY,
        )
      ).ok,
    ).toBe(false);
  });

  it('rejects when the achievements are not visible', async () => {
    const client = clientWith({
      GetOwnedGames: owned(game(1, 'A', 10)),
      GetPlayerAchievements: NOT_PUBLIC,
    });
    expect((await checkPrivacy(ptBR, client, STEAM_ID, KEY)).ok).toBe(false);
  });

  it('skips games with no achievements and counts the played ones', async () => {
    const client = clientWith({
      GetOwnedGames: owned(
        game(1, 'No achievements', 10, 200),
        game(2, 'With', 10, 100),
        game(3, 'Never opened', 0),
      ),
      'appid=1': NO_STATS,
      'appid=2': player(1, 2),
    });
    expect(await checkPrivacy(ptBR, client, STEAM_ID, KEY)).toEqual({
      ok: true,
      value: { gamesWithPlaytime: 2 },
    });
  });
});
