import { describe, expect, it } from 'vitest';

import { type IAchievement } from '@shared/types/Achievement';
import { type IGameView } from '@shared/types/Game';
import onimusha from '@tests/fixtures/game-achievements-2638890.json';
import nioh from '@tests/fixtures/game-achievements-3681010.json';

import { Achievements, type IGameSources } from './Achievements';
import {
  type IRawPlayerAchievement,
  type IRawSchemaAchievement,
} from './SteamClient';

const ICONS =
  'https://shared.fastly.steamstatic.com/community_assets/images/apps/3681010';

/**
 * Nioh 3 for a player who unlocked `ACH_002` and `ACH_004`, with the stats
 * that feed the counters of `ACH_001` and `ACH_002` known.
 */
function niohSources(): IGameSources {
  return {
    appid: 3681010,
    name: 'Nioh 3',
    schema: nioh.response.achievements,
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
  };
}

/** Onimusha: Way of the Sword with nothing listed for the player. */
function onimushaSources(): IGameSources {
  return {
    appid: 2638890,
    name: 'Onimusha: Way of the Sword',
    schema: onimusha.response.achievements,
    player: [],
    stats: {},
    statMap: new Map(),
    now: 1,
  };
}

/**
 * A game with one achievement, `ACH`, as Steam lists it, and what Steam says
 * the player has in it. The counter, when the test gives it a target, is fed
 * by the stat `ACH_STAT`.
 */
function oneAchievementSources(
  listed: Partial<IRawSchemaAchievement> = {},
  mine: Partial<IRawPlayerAchievement> = {},
  stats: Record<string, number> = {},
): IGameSources {
  return {
    appid: 7,
    name: 'Game',
    schema: [
      {
        internal_name: 'ACH',
        localized_name: 'Achievement',
        localized_desc: 'Do it.',
        icon: 'icon.jpg',
        icon_gray: 'gray.jpg',
        hidden: false,
        player_percent_unlocked: '50.0',
        ...listed,
      },
    ],
    player: [{ apiname: 'ACH', achieved: 0, unlocktime: 0, ...mine }],
    stats,
    statMap: new Map([['ACH', 'ACH_STAT']]),
    now: 1,
  };
}

const achievementOf = (view: IGameView, id: string): IAchievement => {
  const achievement = view.achievements.find((a) => a.id === id);
  if (!achievement) throw new Error(`The view has no achievement ${id}`);
  return achievement;
};

const GAMES = [
  { game: 'Nioh 3', sources: niohSources, total: 64, hidden: 25 },
  { game: 'Onimusha', sources: onimushaSources, total: 52, hidden: 16 },
];

describe('Achievements', () => {
  describe('buildGameView', () => {
    it.each(GAMES)(
      'should count the $total achievements of $game',
      ({ sources, total }) => {
        const view = Achievements.buildGameView(sources());

        expect(view.total).toBe(total);
      },
    );

    it.each(GAMES)(
      'should keep the $hidden hidden achievements of $game marked as hidden',
      ({ sources, hidden }) => {
        const view = Achievements.buildGameView(sources());

        expect(view.achievements.filter((a) => a.hidden)).toHaveLength(hidden);
      },
    );

    it.each(GAMES)(
      'should leave no hidden achievement of $game without name or description',
      ({ sources }) => {
        const view = Achievements.buildGameView(sources());

        const untold = view.achievements.filter(
          (a) => a.hidden && (a.name === '' || a.description === ''),
        );
        expect(untold).toEqual([]);
      },
    );

    it('should reveal the name and the description when the achievement is hidden', () => {
      const view = Achievements.buildGameView(niohSources());

      const { name, description } = achievementOf(view, 'ACH_004');
      expect(name).toBe('Errante do Tempo');
      expect(description).toBe('Você viajou no tempo pela primeira vez.');
    });

    it('should count the achievements the player unlocked', () => {
      const view = Achievements.buildGameView(niohSources());

      expect(view.unlockedCount).toBe(2);
    });

    it('should count nothing as unlocked when Steam listed nothing for the player', () => {
      const view = Achievements.buildGameView(onimushaSources());

      expect(view.unlockedCount).toBe(0);
    });

    it('should keep when the achievement was unlocked', () => {
      const view = Achievements.buildGameView(niohSources());

      expect(achievementOf(view, 'ACH_002').unlockedAt).toBe(1770000000);
    });

    it('should show the counter from its stat when the achievement is pending', () => {
      const view = Achievements.buildGameView(niohSources());

      expect(achievementOf(view, 'ACH_001').progress).toEqual({
        current: 31,
        target: 39,
      });
    });

    it('should show the counter as full when the achievement is unlocked', () => {
      const view = Achievements.buildGameView(niohSources());

      expect(achievementOf(view, 'ACH_002').progress).toEqual({
        current: 10,
        target: 10,
      });
    });

    it('should show no counter when it does not know which stat feeds it', () => {
      const view = Achievements.buildGameView(niohSources());

      expect(achievementOf(view, 'ACH_003').progress).toBeNull();
    });

    it('should show no counter when the achievement has none', () => {
      const view = Achievements.buildGameView(niohSources());

      expect(achievementOf(view, 'ACH_000').progress).toBeNull();
    });

    it('should include the global rarity as a number', () => {
      const view = Achievements.buildGameView(niohSources());

      expect(achievementOf(view, 'ACH_000').rarity).toBe(12.7);
    });

    it('should include the address of the icon', () => {
      const view = Achievements.buildGameView(niohSources());

      expect(achievementOf(view, 'ACH_000').icon).toBe(
        `${ICONS}/dfd45c98975986d2e2f57ee175729c3f2a38ff2d.jpg`,
      );
    });

    it('should include the address of the grey icon', () => {
      const view = Achievements.buildGameView(niohSources());

      expect(achievementOf(view, 'ACH_000').iconGray).toBe(
        `${ICONS}/6e8bc359fa978c42faea0d99beb4aa3287891367.jpg`,
      );
    });
  });

  describe('buildGameView, when Steam leaves something out', () => {
    it('should name the achievement after its internal name when Steam gives it no name', () => {
      const sources = oneAchievementSources({ localized_name: '' });

      const view = Achievements.buildGameView(sources);

      expect(achievementOf(view, 'ACH').name).toBe('ACH');
    });

    it.each([
      { field: 'icon', listed: { icon: '' } },
      { field: 'iconGray', listed: { icon_gray: '' } },
    ] as const)(
      'should leave the address of $field empty when Steam names no file for it',
      ({ field, listed }) => {
        const sources = oneAchievementSources(listed);

        const view = Achievements.buildGameView(sources);

        expect(achievementOf(view, 'ACH')[field]).toBe('');
      },
    );

    it.each([
      { what: 'no rarity', rarity: undefined },
      { what: 'a rarity that is not a number', rarity: 'n/a' },
    ])('should have no rarity when Steam reports $what', ({ rarity }) => {
      const sources = oneAchievementSources({
        player_percent_unlocked: rarity,
      });

      const view = Achievements.buildGameView(sources);

      expect(achievementOf(view, 'ACH').rarity).toBeNull();
    });

    it('should not date the unlock when Steam gives no time for it', () => {
      const sources = oneAchievementSources({}, { achieved: 1, unlocktime: 0 });

      const view = Achievements.buildGameView(sources);

      expect(achievementOf(view, 'ACH').unlockedAt).toBeNull();
    });

    it('should not date an achievement that is locked when Steam still sends a time for it', () => {
      const sources = oneAchievementSources({}, { achieved: 0, unlocktime: 9 });

      const view = Achievements.buildGameView(sources);

      expect(achievementOf(view, 'ACH').unlockedAt).toBeNull();
    });

    it('should stop the counter at its target when the stat went past it', () => {
      const sources = oneAchievementSources(
        { max_progress_int: 10 },
        {},
        { ACH_STAT: 14 },
      );

      const view = Achievements.buildGameView(sources);

      expect(achievementOf(view, 'ACH').progress).toEqual({
        current: 10,
        target: 10,
      });
    });

    it('should show no counter when the stat that feeds it has no value yet', () => {
      const sources = oneAchievementSources({ max_progress_int: 10 });

      const view = Achievements.buildGameView(sources);

      expect(achievementOf(view, 'ACH').progress).toBeNull();
    });
  });

  describe('guideUrl', () => {
    it.each([
      {
        site: 'steam' as const,
        achievement: 'Você é Nioh',
        howTo: 'como conseguir',
        url: 'https://steamcommunity.com/app/3681010/guides/?searchText=Voc%C3%AA%20%C3%A9%20Nioh',
      },
      {
        site: 'youtube' as const,
        achievement: 'A & B',
        howTo: 'como conseguir',
        url: 'https://www.youtube.com/results?search_query=Nioh%203%20A%20%26%20B%20como%20conseguir',
      },
      {
        site: 'google' as const,
        achievement: 'A',
        howTo: 'how to get',
        url: 'https://www.google.com/search?q=Nioh%203%20%22A%22%20how%20to%20get',
      },
    ])(
      'should build the encoded search of $site for "$achievement"',
      ({ site, achievement, howTo, url }) => {
        const guideUrl = Achievements.guideUrl(
          site,
          3681010,
          'Nioh 3',
          achievement,
          howTo,
        );

        expect(guideUrl).toBe(url);
      },
    );
  });
});
