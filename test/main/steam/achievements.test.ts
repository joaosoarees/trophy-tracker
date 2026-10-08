import { describe, expect, it } from 'vitest';

import {
  buildGameView,
  guideUrl,
  newlyUnlocked,
} from '@main/steam/achievements';
import { type IRawSchemaAchievement } from '@main/steam/client';
import onimusha from '@test/fixtures/game-achievements-2638890.json';
import nioh from '@test/fixtures/game-achievements-3681010.json';

const niohSchema = nioh.response.achievements as IRawSchemaAchievement[];

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
