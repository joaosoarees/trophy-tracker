import { afterEach, describe, expect, it, vi } from 'vitest';

import { type IApi } from '@shared/types/Api';
import { type IAppState } from '@shared/types/AppState';
import { type CheckResult } from '@shared/types/Check';
import { type IGameSummary, type IGameView } from '@shared/types/Game';
import { makeAchievement } from '@tests/factories/makeAchievement';
import { makeAppState } from '@tests/factories/makeAppState';
import { makeGameSummary } from '@tests/factories/makeGameSummary';
import { makeGameView } from '@tests/factories/makeGameView';
import { OTHER_STEAM_ID } from '@tests/helpers';
import { deferred, makeAppStore } from '@tests/makeAppStore';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

/** The state of the app following the second account. */
function otherAccountState(): IAppState {
  return makeAppState({
    activeSteamId: OTHER_STEAM_ID,
    profile: { steamId: OTHER_STEAM_ID, name: 'other', avatar: '' },
  });
}

/** One turn of the event loop: whatever was ready to run has run. */
const turn = (): Promise<void> =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });

/** Game 10 with these achievements, as a read of it answers. */
const game = (achievements: IGameView['achievements']): IGameView =>
  makeGameView({ appid: 10, achievements });

/**
 * The store wired for the first account, whose dashboard lists `dashboard`,
 * over a main process that answers about a game when the test says so:
 * `asked` holds a game read per request, in the order they were made,
 * `requests` what each one asked for, and `notesAsked` the games whose notes
 * were asked for.
 */
async function setup(dashboard: IGameSummary[] = []) {
  const asked: ReturnType<typeof deferred<CheckResult<IGameView>>>[] = [];
  const requests: { appid: number; isForced: boolean | undefined }[] = [];
  const notesAsked: number[] = [];
  const api: Partial<IApi> = {
    getGame: (appid, isForced) => {
      const answer = deferred<CheckResult<IGameView>>();
      asked.push(answer);
      requests.push({ appid, isForced });
      return answer.promise;
    },
    getUserData: (appid) => {
      notesAsked.push(appid);
      return Promise.resolve({});
    },
    getCurrentAppId: () => Promise.resolve(null),
    getDashboard: () => Promise.resolve({ ok: true, value: dashboard }),
    onStateChanged: () => () => {},
    onGameChanged: () => () => {},
    onGameUpdated: () => () => {},
    onDashboardProgress: () => () => {},
  };
  const made = await makeAppStore({ api });
  made.follow(makeAppState());
  // The dashboard asked for as the store is wired has been listed.
  await turn();
  return { ...made, asked, requests, notesAsked };
}

describe('gamesSlice', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('open', () => {
    it('should ask for the game when it was not read yet', async () => {
      const { sut, requests } = await setup();

      sut.getState().games.open(10);

      expect(requests).toEqual([{ appid: 10, isForced: false }]);
    });

    it('should not ask for the game again when it was already read', async () => {
      const { sut, requests } = await setup();
      sut.getState().games.accept(game([]));

      sut.getState().games.open(10);

      expect(requests).toEqual([]);
    });

    it('should ask for the notes of the game when it is opened', async () => {
      const { sut, notesAsked } = await setup();

      sut.getState().games.open(10);

      expect(notesAsked).toEqual([10]);
    });
  });

  describe('load', () => {
    it('should say the game is being read when the main process has not answered yet', async () => {
      const { sut } = await setup();

      void sut.getState().games.load(10);

      expect(sut.getState().games.entries[10]).toEqual({
        view: null,
        isLoading: true,
        error: null,
        justUnlocked: [],
      });
    });

    it('should ask the main process once when the game is asked for again before the answer', async () => {
      const { sut, requests } = await setup();
      void sut.getState().games.load(10);

      void sut.getState().games.load(10);

      expect(requests).toEqual([{ appid: 10, isForced: false }]);
    });

    it('should ask Steam again when the read is forced', async () => {
      const { sut, requests } = await setup();

      void sut.getState().games.load(10, true);

      expect(requests).toEqual([{ appid: 10, isForced: true }]);
    });

    it('should keep the game on screen when reading it again fails', async () => {
      const { sut, asked } = await setup();
      sut.getState().games.accept(game([makeAchievement()]));
      const loading = sut.getState().games.load(10, true);
      asked[0].resolve({ ok: false, error: 'Steam did not answer.' });

      await loading;

      expect(sut.getState().games.entries[10]).toEqual({
        view: game([makeAchievement()]),
        isLoading: false,
        error: 'Steam did not answer.',
        justUnlocked: [],
      });
    });

    it('should drop the failure when the next read works', async () => {
      const { sut, asked } = await setup();
      const failing = sut.getState().games.load(10);
      asked[0].resolve({ ok: false, error: 'Steam did not answer.' });
      await failing;
      const loading = sut.getState().games.load(10);
      asked[1].resolve({ ok: true, value: game([]) });

      await loading;

      expect(sut.getState().games.entries[10]).toEqual({
        view: game([]),
        isLoading: false,
        error: null,
        justUnlocked: [],
      });
    });

    it('should stop saying the game is being read when the read changed nothing', async () => {
      const { sut, asked } = await setup();
      sut.getState().games.accept(game([makeAchievement()]));
      const loading = sut.getState().games.load(10, true);
      asked[0].resolve({ ok: true, value: game([makeAchievement()]) });

      await loading;

      expect(sut.getState().games.entries[10].isLoading).toBe(false);
    });

    it('should show the game when it is read while its account is still in use', async () => {
      const { sut, asked } = await setup();
      const loading = sut.getState().games.load(10);
      asked[0].resolve({ ok: true, value: makeGameView({ appid: 10 }) });

      await loading;

      expect(sut.getState().games.entries[10]).toEqual({
        view: makeGameView({ appid: 10 }),
        isLoading: false,
        error: null,
        justUnlocked: [],
      });
    });

    it('should show the failure when the read fails while its account is still in use', async () => {
      const { sut, asked } = await setup();
      const loading = sut.getState().games.load(10);
      asked[0].resolve({ ok: false, error: 'Steam did not answer.' });

      await loading;

      expect(sut.getState().games.entries[10]).toEqual({
        view: null,
        isLoading: false,
        error: 'Steam did not answer.',
        justUnlocked: [],
      });
    });

    it('should not show a game to the account in use when it was read for the one that was left', async () => {
      const { sut, asked, follow } = await setup();
      const loading = sut.getState().games.load(10);
      follow(otherAccountState());
      asked[0].resolve({ ok: true, value: makeGameView({ appid: 10 }) });

      await loading;

      expect(sut.getState().games.entries).toEqual({});
    });

    it('should show no failure to the account in use when the read that failed was for the one that was left', async () => {
      const { sut, asked, follow } = await setup();
      const loading = sut.getState().games.load(10);
      follow(otherAccountState());
      asked[0].resolve({ ok: false, error: 'Steam did not answer.' });

      await loading;

      expect(sut.getState().games.entries).toEqual({});
    });

    it('should show the failure when its account was left and followed again before the read failed', async () => {
      const { sut, asked, follow } = await setup();
      const loading = sut.getState().games.load(10);
      follow(otherAccountState());
      follow(makeAppState());
      asked[0].resolve({ ok: false, error: 'Steam did not answer.' });

      await loading;

      expect(sut.getState().games.entries[10]).toEqual({
        view: null,
        isLoading: false,
        error: 'Steam did not answer.',
        justUnlocked: [],
      });
    });
  });

  describe('accept', () => {
    it('should keep the view it had when the new read changed nothing', async () => {
      const { sut } = await setup();
      sut.getState().games.accept(game([makeAchievement()]));
      const before = sut.getState().games.entries[10].view;

      sut.getState().games.accept(game([makeAchievement()]));

      expect(sut.getState().games.entries[10].view).toBe(before);
    });

    it('should keep the achievement that did not change when another one did', async () => {
      const { sut } = await setup();
      sut
        .getState()
        .games.accept(
          game([makeAchievement({ id: 'A' }), makeAchievement({ id: 'B' })]),
        );
      const before = sut.getState().games.entries[10].view?.achievements[0];

      sut
        .getState()
        .games.accept(
          game([
            makeAchievement({ id: 'A' }),
            makeAchievement({ id: 'B', unlocked: true }),
          ]),
        );

      expect(sut.getState().games.entries[10].view?.achievements[0]).toBe(
        before,
      );
    });

    it('should show the achievement as it is now when the new read changed it', async () => {
      const { sut } = await setup();
      sut.getState().games.accept(game([makeAchievement({ id: 'A' })]));

      sut
        .getState()
        .games.accept(
          game([makeAchievement({ id: 'A', unlocked: true, unlockedAt: 5 })]),
        );

      expect(sut.getState().games.entries[10].view).toEqual(
        game([makeAchievement({ id: 'A', unlocked: true, unlockedAt: 5 })]),
      );
    });

    it('should announce nothing when the game is read for the first time', async () => {
      const { sut } = await setup();

      sut
        .getState()
        .games.accept(game([makeAchievement({ id: 'A', unlocked: true })]));

      expect(sut.getState().games.entries[10].justUnlocked).toEqual([]);
    });

    it('should name the achievement when a new read shows it unlocked', async () => {
      const { sut } = await setup();
      sut
        .getState()
        .games.accept(
          game([
            makeAchievement({ id: 'A', name: 'First steps', unlocked: true }),
            makeAchievement({ id: 'B', name: 'Long road' }),
            makeAchievement({ id: 'C', name: 'Still locked' }),
          ]),
        );

      sut
        .getState()
        .games.accept(
          game([
            makeAchievement({ id: 'A', name: 'First steps', unlocked: true }),
            makeAchievement({ id: 'B', name: 'Long road', unlocked: true }),
            makeAchievement({ id: 'C', name: 'Still locked' }),
          ]),
        );

      expect(sut.getState().games.entries[10].justUnlocked).toEqual([
        'Long road',
      ]);
    });

    it('should keep the names already announced when another achievement is unlocked before the notice is dismissed', async () => {
      const { sut } = await setup();
      const read = (unlocked: string[]): IGameView =>
        game(
          ['A', 'B'].map((id) =>
            makeAchievement({ id, unlocked: unlocked.includes(id) }),
          ),
        );
      sut.getState().games.accept(read([]));
      sut.getState().games.accept(read(['A']));

      sut.getState().games.accept(read(['A', 'B']));

      expect(sut.getState().games.entries[10].justUnlocked).toEqual(['A', 'B']);
    });

    it('should give the dashboard row of the game the counts of the new read when it is listed there', async () => {
      const { sut } = await setup([
        makeGameSummary({ appid: 10, unlocked: 0, total: 1 }),
        makeGameSummary({ appid: 20, unlocked: 3, total: 9 }),
      ]);

      sut
        .getState()
        .games.accept(
          game([
            makeAchievement({ id: 'A', unlocked: true }),
            makeAchievement({ id: 'B' }),
          ]),
        );

      expect(sut.getState().dashboard.games).toEqual([
        makeGameSummary({ appid: 10, unlocked: 1, total: 2 }),
        makeGameSummary({ appid: 20, unlocked: 3, total: 9 }),
      ]);
    });

    it('should add no row to the dashboard when the game read is not listed there', async () => {
      const { sut } = await setup([makeGameSummary({ appid: 20 })]);

      sut.getState().games.accept(game([makeAchievement()]));

      expect(sut.getState().dashboard.games).toEqual([
        makeGameSummary({ appid: 20 }),
      ]);
    });
  });

  describe('dismissUnlocked', () => {
    it('should forget the achievements it announced when the notice is dismissed', async () => {
      const { sut } = await setup();
      sut.getState().games.accept(game([makeAchievement()]));
      sut.getState().games.accept(game([makeAchievement({ unlocked: true })]));

      sut.getState().games.dismissUnlocked(10);

      expect(sut.getState().games.entries[10].justUnlocked).toEqual([]);
    });

    it('should file nothing when the notice dismissed is of a game that was never read', async () => {
      const { sut } = await setup();

      sut.getState().games.dismissUnlocked(10);

      expect(sut.getState().games.entries).toEqual({});
    });
  });
});
