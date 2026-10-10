import { describe, expect, it } from 'vitest';

import { makeAchievement } from '@tests/factories/makeAchievement';
import { makeGameSummary } from '@tests/factories/makeGameSummary';
import { makeGameView } from '@tests/factories/makeGameView';
import { game } from '@tests/steamLibrary';

import { type IRawOwnedGame } from '../steam/SteamClient';
import { type ISummaryEntry } from '../storage/Store';

import { Dashboard } from './Dashboard';

/** A game Steam lists with no date of the last session. */
const undated = (appid: number, name: string): IRawOwnedGame => ({
  appid,
  name,
  playtime_forever: 10,
  img_icon_url: 'abc',
});

/** What is kept of a game with ten achievements, read at ten minutes played. */
const entryOf = (props: Partial<ISummaryEntry> = {}): ISummaryEntry => ({
  total: 10,
  unlocked: 4,
  playtime: 10,
  lastUnlockAt: 900,
  ...props,
});

describe('Dashboard', () => {
  describe('played', () => {
    it('should keep the games in the order of the library when some were never opened', () => {
      const library = [
        game(1, 'Opened', 10),
        game(2, 'Never opened', 0),
        game(3, 'Opened for a minute', 1),
      ];

      const played = Dashboard.played(library);

      expect(played).toEqual([
        game(1, 'Opened', 10),
        game(3, 'Opened for a minute', 1),
      ]);
    });

    it('should answer no game when the library is empty', () => {
      const played = Dashboard.played([]);

      expect(played).toEqual([]);
    });
  });

  describe('mostRecentFirst', () => {
    it('should start from the game played last when the dates differ', () => {
      const games = [
        game(1, 'Old', 10, 100),
        game(2, 'Recent', 10, 900),
        game(3, 'Between', 10, 500),
      ];

      const sorted = Dashboard.mostRecentFirst(games);

      expect(sorted.map((g) => g.name)).toEqual(['Recent', 'Between', 'Old']);
    });

    it('should keep the order of the library when games were played at the same time', () => {
      const games = [
        game(1, 'First', 10, 500),
        game(2, 'Second', 10, 500),
        game(3, 'Later', 10, 900),
      ];

      const sorted = Dashboard.mostRecentFirst(games);

      expect(sorted.map((g) => g.name)).toEqual(['Later', 'First', 'Second']);
    });

    it('should put last a game when Steam gives no date for it', () => {
      const games = [
        undated(1, 'Undated'),
        game(2, 'Dated', 10, 100),
        undated(3, 'Also undated'),
      ];

      const sorted = Dashboard.mostRecentFirst(games);

      expect(sorted.map((g) => g.name)).toEqual([
        'Dated',
        'Undated',
        'Also undated',
      ]);
    });

    it('should leave the given list as it was when it sorts', () => {
      const games = [game(1, 'Old', 10, 100), game(2, 'Recent', 10, 900)];

      Dashboard.mostRecentFirst(games);

      expect(games.map((g) => g.name)).toEqual(['Old', 'Recent']);
    });
  });

  describe('isCurrent', () => {
    it.each<{ case: string; cached: ISummaryEntry; isCurrent: boolean }>([
      {
        case: 'a game in progress with the same playtime',
        cached: entryOf(),
        isCurrent: true,
      },
      {
        case: 'a complete game saved with its completion date',
        cached: entryOf({ unlocked: 10 }),
        isCurrent: true,
      },
      {
        case: 'a complete game whose unlocks Steam gave no date for',
        cached: entryOf({ unlocked: 10, lastUnlockAt: 0 }),
        isCurrent: true,
      },
      {
        case: 'a game without achievements',
        cached: entryOf({ total: 0, unlocked: 0, lastUnlockAt: 0 }),
        isCurrent: true,
      },
      {
        case: 'a game played since',
        cached: entryOf({ playtime: 9 }),
        isCurrent: false,
      },
    ])('should answer $isCurrent when it is $case', ({ cached, isCurrent }) => {
      const isStillCurrent = Dashboard.isCurrent(cached, game(1, 'Game', 10));

      expect(isStillCurrent).toBe(isCurrent);
    });
  });

  describe('entry', () => {
    it('should count the achievements and date the last unlock when some are unlocked', () => {
      const list = [
        { apiname: 'A0', achieved: 1, unlocktime: 300 },
        { apiname: 'A1', achieved: 0, unlocktime: 0 },
        { apiname: 'A2', achieved: 1, unlocktime: 900 },
      ];

      const entry = Dashboard.entry(list, 25);

      expect(entry).toEqual({
        total: 3,
        unlocked: 2,
        playtime: 25,
        lastUnlockAt: 900,
      });
    });

    it('should date the last unlock as zero when nothing is unlocked', () => {
      const list = [
        { apiname: 'A0', achieved: 0, unlocktime: 0 },
        { apiname: 'A1', achieved: 0, unlocktime: 0 },
      ];

      const entry = Dashboard.entry(list, 25);

      expect(entry).toEqual({
        total: 2,
        unlocked: 0,
        playtime: 25,
        lastUnlockAt: 0,
      });
    });

    it('should keep only the playtime when the game has no achievements', () => {
      const entry = Dashboard.entry([], 25);

      expect(entry).toEqual({
        total: 0,
        unlocked: 0,
        playtime: 25,
        lastUnlockAt: 0,
      });
    });
  });

  describe('entryOfView', () => {
    it('should take the counts of the view and date the last unlock when some are unlocked', () => {
      const view = makeGameView({
        achievements: [
          makeAchievement({ id: 'A0', unlocked: true, unlockedAt: 900 }),
          makeAchievement({ id: 'A1' }),
          makeAchievement({ id: 'A2', unlocked: true, unlockedAt: 300 }),
        ],
      });

      const entry = Dashboard.entryOfView(view, 25);

      expect(entry).toEqual({
        total: 3,
        unlocked: 2,
        playtime: 25,
        lastUnlockAt: 900,
      });
    });

    it('should date the last unlock as zero when the view has nothing unlocked', () => {
      const view = makeGameView({
        achievements: [makeAchievement({ id: 'A0' })],
      });

      const entry = Dashboard.entryOfView(view, 25);

      expect(entry).toEqual({
        total: 1,
        unlocked: 0,
        playtime: 25,
        lastUnlockAt: 0,
      });
    });
  });

  describe('summary', () => {
    it('should describe the game with its art when the store has it', () => {
      const art = { header: 'header.jpg', capsule: 'capsule.jpg' };

      const summary = Dashboard.summary(
        game(7, 'Almost', 25, 500),
        entryOf({ unlocked: 9 }),
        art,
      );

      expect(summary).toEqual(
        makeGameSummary({
          appid: 7,
          name: 'Almost',
          icon: 'https://media.steampowered.com/steamcommunity/public/images/apps/7/abc.jpg',
          capsule: 'capsule.jpg',
          playtimeMinutes: 25,
          lastPlayed: 500,
          total: 10,
          unlocked: 9,
          completedAt: null,
        }),
      );
    });

    it('should leave the capsule empty when there is no art', () => {
      const summary = Dashboard.summary(
        game(7, 'Game', 10),
        entryOf(),
        undefined,
      );

      expect(summary.capsule).toBe('');
    });

    it('should leave the icon empty when Steam names none', () => {
      const withoutIcon = { ...game(7, 'Game', 10), img_icon_url: '' };

      const summary = Dashboard.summary(withoutIcon, entryOf(), undefined);

      expect(summary.icon).toBe('');
    });

    it('should say the game was last played at zero when Steam gives no date', () => {
      const summary = Dashboard.summary(
        undated(7, 'Game'),
        entryOf(),
        undefined,
      );

      expect(summary.lastPlayed).toBe(0);
    });

    it.each<{ case: string; entry: ISummaryEntry; expected: number | null }>([
      {
        case: 'complete and its last unlock has a date',
        entry: entryOf({ unlocked: 10, lastUnlockAt: 900 }),
        expected: 900,
      },
      {
        case: 'complete and Steam gave no date for its unlocks',
        entry: entryOf({ unlocked: 10, lastUnlockAt: 0 }),
        expected: null,
      },
      {
        case: 'still in progress',
        entry: entryOf({ unlocked: 9, lastUnlockAt: 900 }),
        expected: null,
      },
    ])(
      'should give $expected as the completion date when the game is $case',
      ({ entry, expected }) => {
        const summary = Dashboard.summary(
          game(7, 'Game', 10),
          entry,
          undefined,
        );

        expect(summary.completedAt).toBe(expected);
      },
    );
  });

  describe('closestFirst', () => {
    it('should go from the closest to complete to the furthest when none is complete', () => {
      const games = [
        makeGameSummary({ name: 'Half', unlocked: 5 }),
        makeGameSummary({ name: 'Almost', unlocked: 9 }),
        makeGameSummary({ name: 'Untouched', unlocked: 0 }),
        makeGameSummary({ name: 'Two of three', total: 3, unlocked: 2 }),
      ];

      const sorted = Dashboard.closestFirst(games);

      expect(sorted.map((g) => g.name)).toEqual([
        'Almost',
        'Two of three',
        'Half',
        'Untouched',
      ]);
    });

    it('should put complete games last when some are complete', () => {
      const games = [
        makeGameSummary({ name: 'Complete', unlocked: 10 }),
        makeGameSummary({ name: 'Untouched', unlocked: 0 }),
        makeGameSummary({ name: 'Almost', unlocked: 9 }),
      ];

      const sorted = Dashboard.closestFirst(games);

      expect(sorted.map((g) => g.name)).toEqual([
        'Almost',
        'Untouched',
        'Complete',
      ]);
    });

    it('should put first the game played last when two are as close to complete', () => {
      const games = [
        makeGameSummary({ name: 'Old', unlocked: 5, lastPlayed: 100 }),
        makeGameSummary({ name: 'Recent', unlocked: 5, lastPlayed: 900 }),
        makeGameSummary({ name: 'Old complete', unlocked: 10, lastPlayed: 1 }),
        makeGameSummary({ name: 'New complete', unlocked: 10, lastPlayed: 2 }),
      ];

      const sorted = Dashboard.closestFirst(games);

      expect(sorted.map((g) => g.name)).toEqual([
        'Recent',
        'Old',
        'New complete',
        'Old complete',
      ]);
    });

    it('should leave the given list as it was when it sorts', () => {
      const games = [
        makeGameSummary({ name: 'Half', unlocked: 5 }),
        makeGameSummary({ name: 'Almost', unlocked: 9 }),
      ];

      Dashboard.closestFirst(games);

      expect(games.map((g) => g.name)).toEqual(['Half', 'Almost']);
    });
  });
});
