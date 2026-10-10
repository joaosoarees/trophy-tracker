import { describe, expect, it } from 'vitest';

import { SteamClient, SteamError } from '@main/steam/SteamClient';
import { en } from '@shared/i18n/locales/en';
import { ptBR } from '@shared/i18n/locales/pt-BR';
import nioh from '@test/fixtures/game-achievements-3681010.json';
import {
  clientWith,
  fakeFetch,
  FORBIDDEN_HTML,
  KEY,
  NO_STATS,
  NOT_PUBLIC,
  STEAM_ID,
} from '@test/helpers';

const creds = { steamId: STEAM_ID, apiKey: KEY };

describe('SteamClient', () => {
  const kind = async (p: Promise<unknown>) => {
    const e = await p.catch((err) => err);
    expect(e).toBeInstanceOf(SteamError);
    return (e as SteamError).kind;
  };

  it('recognises a rejected key', async () => {
    expect(
      await kind(
        clientWith({ GetPlayerSummaries: FORBIDDEN_HTML }).getPlayerSummary(
          creds,
        ),
      ),
    ).toBe('invalid-key');
  });

  it.each([
    { what: 'a private profile', route: NOT_PUBLIC, expected: 'private' },
    {
      what: 'a game with no achievements',
      route: NO_STATS,
      expected: 'no-stats',
    },
  ])('recognises $what', async ({ route, expected }) => {
    const client = clientWith({ GetPlayerAchievements: route });

    expect(await kind(client.getPlayerAchievements(creds, 1))).toBe(expected);
  });

  it('recognises a SteamID with no profile', async () => {
    const client = clientWith({
      GetPlayerSummaries: { json: { response: { players: [] } } },
    });
    expect(await kind(client.getPlayerSummary(creds))).toBe('not-found');
  });

  it('tells an empty library from an invisible one', async () => {
    expect(
      await clientWith({
        GetOwnedGames: { json: { response: {} } },
      }).getOwnedGames(creds),
    ).toBeNull();
    expect(
      await clientWith({
        GetOwnedGames: { json: { response: { game_count: 0 } } },
      }).getOwnedGames(creds),
    ).toEqual([]);
  });

  it('asks for the achievements with no key and in the user language', async () => {
    const asked: (string | null)[] = [];
    const fetchImpl = fakeFetch({
      GetGameAchievements: (url) => {
        asked.push(url.searchParams.get('language'));
        expect(url.searchParams.has('key')).toBe(false);
        return { json: nioh };
      },
    });
    const client = new SteamClient(fetchImpl);
    expect(await client.getGameAchievements(3681010)).toHaveLength(64);
    client.language = 'pt-BR';
    await client.getGameAchievements(3681010);
    expect(asked).toEqual(['english', 'brazilian']);
  });

  it('translates each kind of error to the requested language', () => {
    expect(new SteamError('invalid-key').describe(en)).toBe(
      'Steam rejected the Web API key.',
    );
    expect(new SteamError('invalid-key').describe(ptBR)).toBe(
      'A Steam recusou a chave da Web API.',
    );
    expect(new SteamError('unknown', 502).describe(ptBR)).toBe(
      'A Steam respondeu com erro 502.',
    );
    expect(new SteamError('unknown', 400, 'Bad appid').describe(en)).toBe(
      'Bad appid',
    );
  });

  it('recognises a network failure', async () => {
    const client = new SteamClient(async () => {
      throw new TypeError('fetch failed');
    });
    expect(await kind(client.getGameAchievements(1))).toBe('network');
  });

  it('asks the address it was given instead of Steam', async () => {
    const fetchImpl = fakeFetch({
      GetPlayerSummaries: {
        json: { response: { players: [{ steamid: STEAM_ID }] } },
      },
    });
    const client = new SteamClient(fetchImpl, 'en', 'http://127.0.0.1:9999');

    await client.getPlayerSummary(creds);

    expect(fetchImpl.calls[0]).toMatch(
      /^http:\/\/127\.0\.0\.1:9999\/ISteamUser\/GetPlayerSummaries/,
    );
  });
});
