import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { createRunningGameSource } from '../src/main/services/runningGame';
import { SteamClient } from '../src/main/steam/client';
import { type ISteamLocal } from '../src/main/steam/local';
import {
  mostRecentSteamId,
  steamDirCandidates,
} from '../src/main/steam/steamFiles';
import { parseTextVdf } from '../src/main/steam/textVdf';
import { Store } from '../src/main/storage/Store';

import { fakeFetch, KEY, STEAM_ID } from './helpers';

const LOGIN_USERS = `"users"
{
	"76561190000000001"
	{
		"AccountName"		"old \\"quoted\\" account"
		"PersonaName"		"Old"
		"MostRecent"		"0"
	}
	"${STEAM_ID}"
	{
		"AccountName"		"current"
		"MostRecent"		"1"
		"Timestamp"		"1790000000"
	}
}
`;

describe('parseTextVdf', () => {
  it('reads nested blocks, pairs and escaped quotes', () => {
    const parsed = parseTextVdf(LOGIN_USERS) as Record<string, any>;
    expect(Object.keys(parsed.users)).toEqual(['76561190000000001', STEAM_ID]);
    expect(parsed.users['76561190000000001'].AccountName).toBe(
      'old "quoted" account',
    );
    expect(parsed.users[STEAM_ID].Timestamp).toBe('1790000000');
  });

  it('survives an empty or truncated file', () => {
    expect(parseTextVdf('')).toEqual({});
    expect(parseTextVdf('"users" { "765" { "MostRecent" "1"')).toEqual({
      users: { '765': { MostRecent: '1' } },
    });
  });
});

describe('mostRecentSteamId', () => {
  it('picks the account marked as most recent', () => {
    expect(mostRecentSteamId(LOGIN_USERS)).toBe(STEAM_ID);
  });

  it('falls back to the first account when none is marked', () => {
    expect(mostRecentSteamId(LOGIN_USERS.replace('"MostRecent"		"1"', ''))).toBe(
      '76561190000000001',
    );
  });

  it('returns nothing for a file with no accounts', () => {
    expect(mostRecentSteamId('"users" { }')).toBeNull();
    expect(mostRecentSteamId('not a vdf at all')).toBeNull();
  });
});

describe('steamDirCandidates', () => {
  it('knows where the client lives on each system', () => {
    expect(steamDirCandidates('darwin', '/Users/me')).toEqual([
      '/Users/me/Library/Application Support/Steam',
    ]);
    const linux = steamDirCandidates('linux', '/home/me');
    expect(linux[0]).toBe('/home/me/.local/share/Steam');
    expect(linux).toContain('/home/me/.steam/steam');
    expect(linux.some((dir) => dir.includes('com.valvesoftware.Steam'))).toBe(
      true,
    );
    expect(steamDirCandidates('freebsd', '/home/me')).toEqual([]);
  });
});

describe('createRunningGameSource', () => {
  const localWithoutTracking: ISteamLocal = {
    tracksRunningGame: false,
    getRunningAppId: () => Promise.resolve(null),
    getActiveSteamId: () => Promise.resolve(null),
    readStatMap: () => Promise.resolve(new Map()),
  };

  function setup(summary: () => object) {
    const store = new Store(mkdtempSync(join(tmpdir(), 'tt-')));
    const fetchImpl = fakeFetch({
      GetPlayerSummaries: () => summary(),
    });
    let now = 0;
    const source = createRunningGameSource({
      local: localWithoutTracking,
      client: new SteamClient(fetchImpl),
      store,
      now: () => now,
    });
    const configure = () =>
      store.setCredentials(
        { steamId: STEAM_ID, apiKey: KEY },
        { steamId: STEAM_ID, name: 'joao', avatar: '' },
      );
    return {
      source,
      fetchImpl,
      configure,
      advance: (ms: number) => (now += ms),
    };
  }
  const playing = (gameid?: string) => ({
    json: {
      response: {
        players: [
          { steamid: STEAM_ID, personaname: 'j', avatarfull: '', gameid },
        ],
      },
    },
  });

  it('uses the registry where the system has one, without calling the API', async () => {
    const getRunningAppId = vi.fn(() => Promise.resolve(42));
    const { fetchImpl } = setup(() => playing('1'));
    const source = createRunningGameSource({
      local: {
        ...localWithoutTracking,
        tracksRunningGame: true,
        getRunningAppId,
      },
      client: new SteamClient(fetchImpl),
      store: new Store(mkdtempSync(join(tmpdir(), 'tt-'))),
    });
    expect(await source()).toBe(42);
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it('asks the API for the game in the profile, once every half minute', async () => {
    let game: string | undefined = '105600';
    const { source, fetchImpl, configure, advance } = setup(() =>
      playing(game),
    );
    expect(await source()).toBeNull();
    expect(fetchImpl.calls).toHaveLength(0);

    configure();
    expect(await source()).toBe(105600);
    game = undefined;
    advance(10_000);
    expect(await source()).toBe(105600);
    expect(fetchImpl.calls).toHaveLength(1);

    advance(25_000);
    expect(await source()).toBeNull();
    expect(fetchImpl.calls).toHaveLength(2);
  });

  it('keeps the last answer when the API fails', async () => {
    let fail = false;
    const { source, configure, advance } = setup(() =>
      fail ? { status: 500, text: 'down' } : playing('105600'),
    );
    configure();
    expect(await source()).toBe(105600);

    fail = true;
    advance(31_000);
    expect(await source()).toBe(105600);
  });
});
