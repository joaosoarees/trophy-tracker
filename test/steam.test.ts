import { describe, expect, it } from 'vitest';

import {
  buildGameView,
  guideUrl,
  newlyUnlocked,
} from '../src/main/steam/achievements';
import {
  SteamClient,
  SteamError,
  steamErrorMessage,
  type IRawSchemaAchievement,
} from '../src/main/steam/client';
import { achievementStatMap, parseBinaryVdf } from '../src/main/steam/vdf';
import {
  accountIdToSteamId,
  parseRegValue,
  toLocalPath,
} from '../src/main/steam/windows';
import { en } from '../src/shared/i18n/locales/en';
import { ptBR } from '../src/shared/i18n/locales/pt-BR';

import onimusha from './fixtures/game-achievements-2638890.json';
import nioh from './fixtures/game-achievements-3681010.json';
import {
  clientWith,
  fakeFetch,
  FORBIDDEN_HTML,
  KEY,
  NO_STATS,
  NOT_PUBLIC,
  STEAM_ID,
} from './helpers';

const niohSchema = nioh.response.achievements as IRawSchemaAchievement[];
const creds = { steamId: STEAM_ID, apiKey: KEY };

describe('buildGameView', () => {
  const view = buildGameView({
    appid: 3681010,
    name: 'Nioh 3',
    schema: niohSchema,
    player: [
      { apiname: 'ACH_000', achieved: 0, unlocktime: 0 },
      { apiname: 'ACH_001', achieved: 0, unlocktime: 0 },
      { apiname: 'ACH_002', achieved: 1, unlocktime: 1770000000 },
      { apiname: 'ACH_004', achieved: 1, unlocktime: 1770000100 },
    ],
    stats: { ACH_001_PROGRESS: 31, ACH_002_PROGRESS: 7 },
    statMap: new Map([
      ['ACH_001', 'ACH_001_PROGRESS'],
      ['ACH_002', 'ACH_002_PROGRESS'],
    ]),
    now: 1,
  });
  const byId = (id: string) => view.achievements.find((a) => a.id === id)!;

  it('counts unlocked and total', () => {
    expect(view.total).toBe(64);
    expect(view.unlockedCount).toBe(2);
  });

  it('reveals the name and description of hidden achievements', () => {
    const hidden = view.achievements.filter((a) => a.hidden);
    expect(hidden.length).toBe(25);
    expect(hidden.every((a) => a.name !== '' && a.description !== '')).toBe(
      true,
    );
    expect(byId('ACH_004').description).toBe(
      'Você viajou no tempo pela primeira vez.',
    );
  });

  it('shows the counter of a pending achievement from its stat', () => {
    expect(byId('ACH_001').progress).toEqual({ current: 31, target: 39 });
  });

  it('treats the counter as full when the achievement is already unlocked', () => {
    expect(byId('ACH_002').progress).toEqual({ current: 10, target: 10 });
    expect(byId('ACH_002').unlockedAt).toBe(1770000000);
  });

  it('does not invent a counter when it does not know which stat feeds it', () => {
    const counted = niohSchema.find(
      (s) =>
        s.max_progress_int && !['ACH_001', 'ACH_002'].includes(s.internal_name),
    )!;
    expect(byId(counted.internal_name).progress).toBeNull();
    expect(byId('ACH_000').progress).toBeNull();
  });

  it('includes global rarity and icons', () => {
    expect(byId('ACH_000').rarity).toBe(12.7);
    expect(byId('ACH_000').icon).toBe(
      'https://shared.fastly.steamstatic.com/community_assets/images/apps/3681010/dfd45c98975986d2e2f57ee175729c3f2a38ff2d.jpg',
    );
  });

  it('treats as pending what Steam did not list for the player', () => {
    const empty = buildGameView({
      appid: 2638890,
      name: 'Onimusha: Way of the Sword',
      schema: onimusha.response.achievements,
      player: [],
      stats: {},
      statMap: new Map(),
    });
    expect(empty.total).toBe(52);
    expect(empty.unlockedCount).toBe(0);
    expect(
      empty.achievements
        .filter((a) => a.hidden)
        .every((a) => a.description !== ''),
    ).toBe(true);
  });
});

describe('newlyUnlocked', () => {
  it('lists only what changed to unlocked', () => {
    const make = (ids: string[]) =>
      buildGameView({
        appid: 1,
        name: 'x',
        schema: niohSchema,
        player: ids.map((apiname) => ({ apiname, achieved: 1, unlocktime: 5 })),
        stats: {},
        statMap: new Map(),
      });
    expect(
      newlyUnlocked(make(['ACH_002']), make(['ACH_002', 'ACH_004'])).map(
        (a) => a.id,
      ),
    ).toEqual(['ACH_004']);
    expect(newlyUnlocked(make(['ACH_002']), make(['ACH_002']))).toEqual([]);
  });
});

describe('guideUrl', () => {
  it('builds the searches with the encoded name and the suffix in the user language', () => {
    expect(
      guideUrl('steam', 3681010, 'Nioh 3', 'Você é Nioh', 'como conseguir'),
    ).toBe(
      'https://steamcommunity.com/app/3681010/guides/?searchText=Voc%C3%AA%20%C3%A9%20Nioh',
    );
    expect(
      guideUrl('youtube', 1, 'Nioh 3', 'A & B', 'como conseguir'),
    ).toContain('search_query=Nioh%203%20A%20%26%20B%20como%20conseguir');
    expect(guideUrl('google', 1, 'Nioh 3', 'A', 'how to get')).toContain(
      'q=Nioh%203%20%22A%22%20how%20to%20get',
    );
  });
});

describe('binary VDF', () => {
  const str = (s: string) =>
    Buffer.concat([Buffer.from(s, 'utf8'), Buffer.from([0])]);
  const obj = (key: string, ...children: Buffer[]) =>
    Buffer.concat([Buffer.from([0]), str(key), ...children, Buffer.from([8])]);
  const text = (key: string, value: string) =>
    Buffer.concat([Buffer.from([1]), str(key), str(value)]);
  const int = (key: string, value: number) => {
    const b = Buffer.alloc(4);
    b.writeInt32LE(value);
    return Buffer.concat([Buffer.from([2]), str(key), b]);
  };
  const bit = (n: string, name: string, ...extra: Buffer[]) =>
    obj(n, text('name', name), ...extra);
  const progress = (stat: string) =>
    obj(
      'progress',
      int('min_val', 0),
      int('max_val', 39),
      obj('value', text('operation', 'statvalue'), text('operand1', stat)),
    );

  const schema = Buffer.concat([
    obj(
      '3681010',
      obj(
        'stats',
        obj(
          '3',
          text('type', 'INT'),
          text('name', 'ACH_001_PROGRESS'),
          int('default', 0),
        ),
        obj(
          '1376',
          int('type', 4),
          obj(
            'bits',
            bit('0', 'ACH_000'),
            bit('3', 'ACH_001', progress('ACH_001_PROGRESS')),
          ),
        ),
      ),
      text('gamename', 'Nioh 3'),
    ),
    Buffer.from([8]),
  ]);

  it('reads objects, strings and integers', () => {
    const root = parseBinaryVdf(schema) as any;
    expect(root['3681010'].gamename).toBe('Nioh 3');
    expect(root['3681010'].stats['1376'].bits['3'].progress.max_val).toBe(39);
  });

  it('links each counted achievement to its stat', () => {
    expect([...achievementStatMap(parseBinaryVdf(schema))]).toEqual([
      ['ACH_001', 'ACH_001_PROGRESS'],
    ]);
  });

  it('rejects a truncated file', () => {
    expect(() => parseBinaryVdf(schema.subarray(0, 40))).toThrow();
  });
});

describe('Windows interop', () => {
  it('reads reg.exe values', () => {
    expect(
      parseRegValue(
        '\r\nHKEY_CURRENT_USER\\Software\\Valve\\Steam\r\n    RunningAppID    REG_DWORD    0x28442a\r\n\r\n',
      ),
    ).toBe(2638890);
    expect(
      parseRegValue(
        '\r\nHKEY_CURRENT_USER\\Software\\Valve\\Steam\r\n    SteamPath    REG_SZ    c:/program files (x86)/steam\r\n',
      ),
    ).toBe('c:/program files (x86)/steam');
    expect(
      parseRegValue(
        'ERROR: The system was unable to find the specified registry key or value.',
      ),
    ).toBeNull();
  });

  it('converts the signed-in account to a SteamID64', () => {
    expect(accountIdToSteamId(0xeb738e9)).toBe(STEAM_ID);
  });

  it('translates Windows paths to WSL', () => {
    expect(toLocalPath('c:/program files (x86)/steam', true)).toBe(
      '/mnt/c/program files (x86)/steam',
    );
    expect(toLocalPath('D:\\Steam', true)).toBe('/mnt/d/Steam');
    expect(toLocalPath('D:\\Steam', false)).toBe('D:\\Steam');
  });
});

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

  it('recognises a private profile and a game with no achievements', async () => {
    expect(
      await kind(
        clientWith({ GetPlayerAchievements: NOT_PUBLIC }).getPlayerAchievements(
          creds,
          1,
        ),
      ),
    ).toBe('private');
    expect(
      await kind(
        clientWith({ GetPlayerAchievements: NO_STATS }).getPlayerAchievements(
          creds,
          1,
        ),
      ),
    ).toBe('no-stats');
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
    expect(steamErrorMessage(en, new SteamError('invalid-key'))).toBe(
      'Steam rejected the Web API key.',
    );
    expect(steamErrorMessage(ptBR, new SteamError('invalid-key'))).toBe(
      'A Steam recusou a chave da Web API.',
    );
    expect(steamErrorMessage(ptBR, new SteamError('unknown', 502))).toBe(
      'A Steam respondeu com erro 502.',
    );
    expect(
      steamErrorMessage(en, new SteamError('unknown', 400, 'Bad appid')),
    ).toBe('Bad appid');
  });

  it('recognises a network failure', async () => {
    const client = new SteamClient(async () => {
      throw new TypeError('fetch failed');
    });
    expect(await kind(client.getGameAchievements(1))).toBe('network');
  });
});
