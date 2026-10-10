import { describe, expect, it, vi } from 'vitest';

import { type IGameView } from '@shared/types/Game';
import { makeGameSummary } from '@tests/factories/makeGameSummary';
import {
  fakeSteamClient,
  type ISteamAnswers,
  type SteamRequest,
} from '@tests/fakeSteamClient';
import nioh from '@tests/fixtures/game-achievements-3681010.json';
import { KEY, OTHER_KEY, OTHER_STEAM_ID, STEAM_ID } from '@tests/helpers';
import { InMemoryStore } from '@tests/InMemoryStore';
import { achieved, game } from '@tests/steamLibrary';

import {
  type ICredentials,
  type IRawPlayerAchievement,
  type IStoreArt,
  SteamError,
  type SteamErrorKind,
} from '../steam/SteamClient';

import { Tracker } from './Tracker';

const NIOH = 3681010;
const profile = { steamId: STEAM_ID, name: 'player', avatar: '' };

/** Steam failing a request the way the real client reports it. */
const failing = (kind: SteamErrorKind, status?: number) => (): never => {
  throw new SteamError(kind, status);
};

/** A game whose achievement list is empty. */
const noAchievementList = (): [] => [];
const storeDown = failing('unknown', 500);

/** What the player has in Nioh 3: the first `count` achievements of the list. */
const niohUnlocked = (count: number): IRawPlayerAchievement[] =>
  nioh.response.achievements.slice(0, count).map((a) => ({
    apiname: a.internal_name,
    achieved: 1,
    unlocktime: 9,
  }));

const ART_OF_GAME_1: IStoreArt = {
  header:
    'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1/abc/header.jpg?t=9',
  capsule:
    'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1/def/capsule_231x87.jpg?t=9',
};

/** The store, which only has art for the game 1. */
const storeArtOfGame1 = (appids: number[]): Map<number, IStoreArt> =>
  new Map(
    appids
      .filter((appid) => appid === 1)
      .map((appid) => [appid, { ...ART_OF_GAME_1 }]),
  );

/**
 * What the player has in each game, by appid. Being asked about a game that
 * is not listed is a request the test did not provide for.
 */
const perGame =
  (games: Record<number, () => IRawPlayerAchievement[]>) =>
  (appid: number): IRawPlayerAchievement[] => {
    const answer = games[appid];
    if (!answer) throw new Error(`nothing answers for the game ${appid}`);
    return answer();
  };

/** How many times Steam was asked through the client's method `name`. */
const requestsTo = (
  client: { asked: SteamRequest[] },
  name: SteamRequest['method'],
): number => client.asked.filter(({ method }) => method === name).length;

/** For a test that is not about what the refresh behind the scenes says. */
const unheard = {
  onFresh: (): void => undefined,
  onError: (): void => undefined,
};

/**
 * A tracker for `STEAM_ID`, the account in use, over a store in memory and a
 * Steam that answers what it is given.
 */
function setup(answers: ISteamAnswers, statMap = new Map<string, string>()) {
  const store = new InMemoryStore();
  store.setCredentials({ steamId: STEAM_ID, apiKey: KEY }, profile);
  const client = fakeSteamClient(answers);
  let now = 1_000_000;
  const sut = new Tracker({
    store,
    client,
    readStatMap: () => Promise.resolve(statMap),
    now: () => now,
  });
  const advance = (ms: number): void => {
    now += ms;
  };
  return { sut, client, store, advance };
}

/** An answer of Steam that arrives when the test says so. */
function held<T>() {
  let resolve!: (value: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Whether a request was made with the key of `STEAM_ID`. */
const isMine = ({ steamId }: ICredentials): boolean => steamId === STEAM_ID;

/**
 * The same tracker in an app that also has `OTHER_STEAM_ID`, with `STEAM_ID`
 * still the one in use. `keptFor` answers what the store keeps for an account
 * about a game, whichever account is in use.
 */
function setupSecondAccount(answers: ISteamAnswers) {
  const made = setup(answers);
  const { store } = made;
  store.setCredentials(
    { steamId: OTHER_STEAM_ID, apiKey: OTHER_KEY },
    { steamId: OTHER_STEAM_ID, name: 'other', avatar: '' },
  );
  store.setActiveAccount(STEAM_ID);
  const keptFor = (steamId: string, appid: number) => {
    const inUse = store.getActiveSteamId();
    store.setActiveAccount(steamId);
    const kept = {
      library: store.getLibrary()?.games ?? null,
      game: store.getGame(appid),
      summary: store.getSummary(appid),
    };
    if (inUse) store.setActiveAccount(inUse);
    return kept;
  };
  return { ...made, keptFor };
}

/** A library with the game 7, which has no achievements. */
const setupGame7 = () =>
  setup({
    owned: () => [game(7, 'Game', 5)],
    achievements: noAchievementList,
    player: () => achieved(0, 0),
  });

/**
 * A library with Nioh 3 and one achievement unlocked. `unlock` changes how
 * many of them Steam says are unlocked from then on.
 */
function setupNioh() {
  let unlocked = 1;
  const made = setup({
    owned: () => [game(NIOH, 'Nioh 3', 500)],
    achievements: () => nioh.response.achievements,
    player: () => niohUnlocked(unlocked),
  });
  const unlock = (count: number): void => {
    unlocked = count;
  };
  return { ...made, unlock };
}

/** A library with the games 1 and 2, the first with `playtime` minutes. */
function setupTwoGames() {
  let playtime = 10;
  const made = setup({
    owned: () => [game(1, 'A', playtime), game(2, 'B', 20)],
    player: () => achieved(1, 4),
  });
  const play = (minutes: number): void => {
    playtime = minutes;
  };
  return { ...made, play };
}

/** A library with a complete game, 1, and one still in progress, 2. */
const setupCompleteGame = () =>
  setup({
    owned: () => [game(1, 'Done', 10), game(2, 'Ongoing', 10)],
    player: perGame({
      1: () => [
        { apiname: 'A', achieved: 1, unlocktime: 500 },
        { apiname: 'B', achieved: 1, unlocktime: 900 },
      ],
      2: () => achieved(1, 4),
    }),
  });

/** One turn of the event loop: whatever was ready to run has run. */
const turn = (): Promise<void> =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });

const DOZEN = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * A library with the games 1 to 12, none read yet, over a Steam that answers
 * about a game only when the test lets it, so the reads of the dashboard
 * overlap as they do on a network. `events` lists, in order, each progress
 * announced and how each dashboard ended.
 */
function setupDozenGames() {
  const waiting = new Map<
    number,
    {
      resolve: (list: IRawPlayerAchievement[]) => void;
      reject: (e: SteamError) => void;
    }
  >();
  const made = setup({
    owned: () => DOZEN.map((appid) => game(appid, `Game ${appid}`, 10)),
    player: (appid) =>
      new Promise<IRawPlayerAchievement[]>((resolve, reject) => {
        waiting.set(appid, { resolve, reject });
      }),
  });
  const events: string[] = [];

  /**
   * Asks for the dashboard and waits until Steam is being asked about the
   * games it starts with. `ended` resolves when the dashboard answered, or failed.
   */
  const start = async (): Promise<{ ended: Promise<void> }> => {
    const ended = made.sut
      .getDashboard('cached', (done, total) => {
        events.push(`${done}/${total}`);
      })
      .then(
        (list) => {
          events.push(`answered ${list.length} games`);
        },
        (e: unknown) => {
          events.push(
            `failed: ${e instanceof SteamError ? e.kind : String(e)}`,
          );
        },
      );
    // The library was answered and the four first requests were made.
    await turn();
    return { ended };
  };

  /** Steam answers every game it is still asked about, until it is asked about no other. */
  const answerTheRest = async (): Promise<void> => {
    for (;;) {
      await turn();
      if (waiting.size === 0) return;
      for (const [appid, { resolve }] of [...waiting]) {
        waiting.delete(appid);
        resolve(achieved(1, 4));
      }
    }
  };

  /**
   * Steam fails the request about one game while the others are in flight,
   * then answers the rest; resolves once the dashboard ended and nothing is
   * left running.
   */
  const failGame = async (
    appid: number,
    kind: SteamErrorKind,
    ended: Promise<void>,
  ): Promise<void> => {
    waiting.get(appid)?.reject(new SteamError(kind));
    waiting.delete(appid);
    await answerTheRest();
    await ended;
  };

  /** The games Steam was asked about, in order. */
  const gamesAsked = (): number[] =>
    made.client.asked.flatMap((request) =>
      request.method === 'getPlayerAchievements' ? [request.appid] : [],
    );
  /** The games the store holds a summary of. */
  const gamesSaved = (): number[] =>
    DOZEN.filter((appid) => made.store.getSummary(appid) !== null);

  return {
    ...made,
    events,
    start,
    answerTheRest,
    failGame,
    gamesAsked,
    gamesSaved,
  };
}

describe('Tracker', () => {
  describe('getGame', () => {
    it('should build the game view with counters taken from the stats', async () => {
      const { sut } = setup(
        {
          owned: () => [game(NIOH, 'Nioh 3', 500)],
          achievements: () => nioh.response.achievements,
          player: () => [{ apiname: 'ACH_002', achieved: 1, unlocktime: 9 }],
          stats: () => ({ ACH_001_PROGRESS: 12 }),
        },
        new Map([['ACH_001', 'ACH_001_PROGRESS']]),
      );

      const view = await sut.getGame(NIOH);

      expect(view.name).toBe('Nioh 3');
      expect(view.unlockedCount).toBe(1);
      expect(
        view.achievements.find((a) => a.id === 'ACH_001')?.progress,
      ).toEqual({ current: 12, target: 39 });
    });

    it('should keep the list when the counters fail', async () => {
      const { sut } = setup(
        {
          owned: () => [game(NIOH, 'Nioh 3', 500)],
          achievements: () => nioh.response.achievements,
          player: () => [],
          stats: failing('unknown', 500),
        },
        new Map([['ACH_001', 'ACH_001_PROGRESS']]),
      );

      const view = await sut.getGame(NIOH);

      expect(view.total).toBe(64);
      expect(
        view.achievements.find((a) => a.id === 'ACH_001')?.progress,
      ).toBeNull();
    });

    it('should answer from the cache when the game was read under a minute ago', async () => {
      const { sut, client } = setupGame7();
      await sut.getGame(7);

      await sut.getGame(7);

      expect(requestsTo(client, 'getPlayerAchievements')).toBe(1);
    });

    it('should read the game again when the cache is over a minute old', async () => {
      const { sut, client, advance } = setupGame7();
      await sut.getGame(7);
      advance(61_000);

      await sut.getGame(7);

      expect(requestsTo(client, 'getPlayerAchievements')).toBe(2);
    });

    it('should read the player state again when forced', async () => {
      const { sut, client } = setupGame7();
      await sut.getGame(7);

      await sut.getGame(7, true);

      expect(requestsTo(client, 'getPlayerAchievements')).toBe(2);
    });

    it('should read the achievement list again when forced', async () => {
      const { sut, client } = setupNioh();
      await sut.getGame(NIOH);

      await sut.getGame(NIOH, true);

      expect(requestsTo(client, 'getGameAchievements')).toBe(2);
    });

    it('should answer the same object when the periodic check finds nothing new', async () => {
      const { sut, advance } = setupNioh();
      const first = await sut.getGame(NIOH);
      advance(60_000);

      const second = await sut.getGame(NIOH, 'poll');

      expect(second).toBe(first);
    });

    it('should read only the player state on the periodic check', async () => {
      const { sut, client, advance } = setupNioh();
      await sut.getGame(NIOH);
      advance(60_000);

      await sut.getGame(NIOH, 'poll');

      expect(requestsTo(client, 'getPlayerAchievements')).toBe(2);
      expect(requestsTo(client, 'getGameAchievements')).toBe(1);
    });

    it('should answer a new object that keeps the unchanged achievements when one was unlocked', async () => {
      const { sut, advance, unlock } = setupNioh();
      const first = await sut.getGame(NIOH);
      unlock(2);
      advance(60_000);

      const second = await sut.getGame(NIOH, 'poll');

      expect(second).not.toBe(first);
      expect(second.unlockedCount).toBe(2);
      expect(second.achievements[5]).toBe(first.achievements[5]);
    });

    it('should say Steam answered when the game was read', async () => {
      const { sut } = setupGame7();
      const onAnswerMock = vi.fn<() => void>();

      await sut.getGame(7, false, onAnswerMock);

      expect(onAnswerMock).toHaveBeenCalledExactlyOnceWith();
    });

    it('should not say Steam answered when the game comes from the cache', async () => {
      const { sut } = setupGame7();
      const onAnswerMock = vi.fn<() => void>();
      await sut.getGame(7);

      await sut.getGame(7, false, onAnswerMock);

      expect(onAnswerMock).not.toHaveBeenCalled();
    });

    it('should say Steam answered to each request when they share one read', async () => {
      const { sut, client } = setupGame7();
      const onFirstAnswerMock = vi.fn<() => void>();
      const onSecondAnswerMock = vi.fn<() => void>();

      await Promise.all([
        sut.getGame(7, false, onFirstAnswerMock),
        sut.getGame(7, false, onSecondAnswerMock),
      ]);

      expect(requestsTo(client, 'getPlayerAchievements')).toBe(1);
      expect(onFirstAnswerMock).toHaveBeenCalledExactlyOnceWith();
      expect(onSecondAnswerMock).toHaveBeenCalledExactlyOnceWith();
    });

    it('should share one read between identical simultaneous requests', async () => {
      const { sut, client } = setup({
        owned: () => [game(1, 'A', 10), game(2, 'B', 10)],
        achievements: noAchievementList,
        player: () => achieved(1, 4),
      });

      const [a, b] = await Promise.all([sut.getGame(1), sut.getGame(1)]);

      expect(a).toBe(b);
      expect(requestsTo(client, 'getPlayerAchievements')).toBe(1);
      expect(requestsTo(client, 'getOwnedGames')).toBe(1);
    });

    it('should file a game under the account it was read for when another is in use by the time Steam answers', async () => {
      const answer = held<IRawPlayerAchievement[]>();
      const { sut, store, keptFor } = setupSecondAccount({
        owned: () => [game(NIOH, 'Nioh 3', 500)],
        achievements: () => nioh.response.achievements,
        player: () => answer.promise,
      });
      const reading = sut.getGame(NIOH);
      await turn();
      store.setActiveAccount(OTHER_STEAM_ID);
      answer.resolve(niohUnlocked(1));

      const view = await reading;

      expect({
        mine: keptFor(STEAM_ID, NIOH).game,
        theirs: keptFor(OTHER_STEAM_ID, NIOH).game,
      }).toEqual({ mine: view, theirs: null });
    });

    it('should give the summary of a game the playtime of the account it was read for when another is in use by the time Steam answers', async () => {
      const answer = held<IRawPlayerAchievement[]>();
      const { sut, store, keptFor } = setupSecondAccount({
        owned: (credentials) => [
          game(NIOH, 'Nioh 3', isMine(credentials) ? 500 : 99),
        ],
        achievements: () => nioh.response.achievements,
        player: () => answer.promise,
      });
      store.setActiveAccount(OTHER_STEAM_ID);
      await sut.library();
      store.setActiveAccount(STEAM_ID);
      const reading = sut.getGame(NIOH);
      await turn();
      store.setActiveAccount(OTHER_STEAM_ID);
      answer.resolve(niohUnlocked(1));

      await reading;

      expect({
        mine: keptFor(STEAM_ID, NIOH).summary,
        theirs: keptFor(OTHER_STEAM_ID, NIOH).summary,
      }).toEqual({
        mine: { total: 64, unlocked: 1, playtime: 500, lastUnlockAt: 9 },
        theirs: null,
      });
    });

    it('should ask only for the library of the account a game is read for when another is in use by then', async () => {
      const { sut, store, client } = setupSecondAccount({
        owned: (credentials) =>
          isMine(credentials) ? [] : [game(7, 'Game of the other', 5)],
        achievements: noAchievementList,
        player: () => achieved(0, 0),
      });
      const reading = sut.getGame(7);
      store.setActiveAccount(OTHER_STEAM_ID);

      await reading;

      expect(
        client.asked.flatMap((request) =>
          request.method === 'getOwnedGames'
            ? [request.credentials.steamId]
            : [],
        ),
      ).toEqual([STEAM_ID, STEAM_ID]);
    });

    it('should attach the header the store has for the game', async () => {
      const { sut } = setup({
        owned: () => [game(1, 'A', 10)],
        achievements: noAchievementList,
        player: () => achieved(1, 4),
        art: storeArtOfGame1,
      });

      const view = await sut.getGame(1);

      expect(view.header).toBe(
        'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1/abc/header.jpg?t=9',
      );
    });

    it('should leave the header empty when the store fails to provide the art', async () => {
      const { sut } = setup({
        owned: () => [game(1, 'A', 10)],
        achievements: noAchievementList,
        player: () => achieved(1, 4),
        art: storeDown,
      });

      const view = await sut.getGame(1);

      expect(view.header).toBe('');
    });
  });

  describe('getGameStaleFirst', () => {
    it('should read the game when nothing is cached', async () => {
      const { sut, client } = setupNioh();

      const view = await sut.getGameStaleFirst(NIOH, unheard);

      expect(view.unlockedCount).toBe(1);
      expect(requestsTo(client, 'getPlayerAchievements')).toBe(1);
    });

    it('should answer the cached game without reading when it is recent', async () => {
      const { sut, client } = setupNioh();
      const first = await sut.getGameStaleFirst(NIOH, unheard);

      const second = await sut.getGameStaleFirst(NIOH, unheard);

      expect(second).toBe(first);
      expect(requestsTo(client, 'getPlayerAchievements')).toBe(1);
    });

    it('should announce nothing when the refresh of a stale game finds no change', async () => {
      const { sut, client, advance } = setupNioh();
      const onFreshMock = vi.fn<(view: IGameView) => void>();
      const callbacks = { ...unheard, onFresh: onFreshMock };
      const first = await sut.getGameStaleFirst(NIOH, callbacks);
      advance(5 * 60_000);

      const stale = await sut.getGameStaleFirst(NIOH, callbacks);
      await vi.waitFor(() =>
        expect(requestsTo(client, 'getPlayerAchievements')).toBe(2),
      );
      // Joins the refresh still in flight, so what follows sees how it ended.
      await sut.getGame(NIOH);

      expect(stale).toBe(first);
      expect(onFreshMock).not.toHaveBeenCalled();
    });

    it('should answer the stale game at once and hand over the new view when it changed', async () => {
      const { sut, advance, unlock } = setupNioh();
      const onFreshMock = vi.fn<(view: IGameView) => void>();
      const onErrorMock = vi.fn<(e: unknown) => void>();
      const callbacks = { onFresh: onFreshMock, onError: onErrorMock };
      await sut.getGameStaleFirst(NIOH, callbacks);
      unlock(3);
      advance(5 * 60_000);

      const stale = await sut.getGameStaleFirst(NIOH, callbacks);

      expect(stale.unlockedCount).toBe(1);
      await vi.waitFor(() =>
        expect(onFreshMock).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({ unlockedCount: 3 }),
        ),
      );
      expect(onErrorMock).not.toHaveBeenCalled();
    });

    it('should not hand over the new view when another account is in use by the time the refresh ends', async () => {
      let answer: ReturnType<typeof held<IRawPlayerAchievement[]>> | null =
        null;
      const { sut, store, advance } = setupSecondAccount({
        owned: () => [game(NIOH, 'Nioh 3', 500)],
        achievements: () => nioh.response.achievements,
        player: () => answer?.promise ?? niohUnlocked(1),
      });
      const onFreshMock = vi.fn<(view: IGameView) => void>();
      await sut.getGameStaleFirst(NIOH, unheard);
      advance(5 * 60_000);
      answer = held();
      await sut.getGameStaleFirst(NIOH, { ...unheard, onFresh: onFreshMock });
      store.setActiveAccount(OTHER_STEAM_ID);

      answer.resolve(niohUnlocked(3));
      await turn();

      expect(onFreshMock).not.toHaveBeenCalled();
    });

    it('should keep the new view for its account when another is in use by the time the refresh ends', async () => {
      let answer: ReturnType<typeof held<IRawPlayerAchievement[]>> | null =
        null;
      const { sut, store, advance, keptFor } = setupSecondAccount({
        owned: () => [game(NIOH, 'Nioh 3', 500)],
        achievements: () => nioh.response.achievements,
        player: () => answer?.promise ?? niohUnlocked(1),
      });
      await sut.getGameStaleFirst(NIOH, unheard);
      advance(5 * 60_000);
      answer = held();
      await sut.getGameStaleFirst(NIOH, unheard);
      store.setActiveAccount(OTHER_STEAM_ID);

      answer.resolve(niohUnlocked(3));
      await turn();

      expect({
        mine: keptFor(STEAM_ID, NIOH).game?.unlockedCount,
        theirs: keptFor(OTHER_STEAM_ID, NIOH).game,
      }).toEqual({ mine: 3, theirs: null });
    });

    it('should not say Steam answered when the cached game is recent', async () => {
      const { sut } = setupNioh();
      const onAnswerMock = vi.fn<() => void>();
      await sut.getGameStaleFirst(NIOH, unheard);

      await sut.getGameStaleFirst(NIOH, { ...unheard, onAnswer: onAnswerMock });

      expect(onAnswerMock).not.toHaveBeenCalled();
    });

    it('should say Steam answered when the refresh of a stale game ends', async () => {
      const { sut, advance } = setupNioh();
      const onAnswerMock = vi.fn<() => void>();
      await sut.getGameStaleFirst(NIOH, unheard);
      advance(5 * 60_000);

      await sut.getGameStaleFirst(NIOH, { ...unheard, onAnswer: onAnswerMock });
      // Joins the refresh still in flight, so what follows sees how it ended.
      await sut.getGame(NIOH);

      expect(onAnswerMock).toHaveBeenCalledExactlyOnceWith();
    });

    it('should not say Steam answered when the refresh of a stale game fails', async () => {
      let isBroken = false;
      const { sut, advance } = setup({
        owned: () => [game(7, 'Game', 5)],
        achievements: noAchievementList,
        player: () => (isBroken ? failing('invalid-key')() : achieved(0, 0)),
      });
      const onAnswerMock = vi.fn<() => void>();
      const onErrorMock = vi.fn<(e: unknown) => void>();
      await sut.getGameStaleFirst(7, unheard);
      isBroken = true;
      advance(5 * 60_000);

      await sut.getGameStaleFirst(7, {
        ...unheard,
        onError: onErrorMock,
        onAnswer: onAnswerMock,
      });
      await vi.waitFor(() => expect(onErrorMock).toHaveBeenCalledOnce());

      expect(onAnswerMock).not.toHaveBeenCalled();
    });

    it('should report a failed refresh without failing the answer', async () => {
      let isBroken = false;
      const { sut, advance } = setup({
        owned: () => [game(7, 'Game', 5)],
        achievements: noAchievementList,
        player: () => (isBroken ? failing('invalid-key')() : achieved(0, 0)),
      });
      const onFreshMock = vi.fn<(view: IGameView) => void>();
      const onErrorMock = vi.fn<(e: unknown) => void>();
      const callbacks = { onFresh: onFreshMock, onError: onErrorMock };
      const first = await sut.getGameStaleFirst(7, callbacks);
      isBroken = true;
      advance(5 * 60_000);

      const stale = await sut.getGameStaleFirst(7, callbacks);

      expect(stale).toBe(first);
      await vi.waitFor(() =>
        expect(onErrorMock).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({ kind: 'invalid-key' }),
        ),
      );
      expect(onFreshMock).not.toHaveBeenCalled();
    });
  });

  describe('lastPlayedAppId', () => {
    it('should pick the game played most recently', async () => {
      const { sut } = setup({
        owned: () => [
          game(1, 'Old', 10, 100),
          game(2, 'Recent', 10, 900),
          game(3, 'Never', 0, 0),
        ],
      });

      const appId = await sut.lastPlayedAppId();

      expect(appId).toBe(2);
    });
  });

  describe('getDashboard', () => {
    it('should list the games from the closest to complete to the furthest, complete ones last', async () => {
      const { sut } = setup({
        owned: () => [
          game(1, 'Half', 10),
          game(2, 'Complete', 10),
          game(3, 'Almost', 10),
        ],
        player: perGame({
          1: () => achieved(5, 10),
          2: () => achieved(10, 10),
          3: () => achieved(9, 10),
        }),
      });

      const list = await sut.getDashboard();

      expect(list.map((g) => g.name)).toEqual(['Almost', 'Half', 'Complete']);
    });

    it('should leave out games never played and games without achievements', async () => {
      const { sut } = setup({
        owned: () => [
          game(1, 'Half', 10),
          game(4, 'No achievements', 10),
          game(5, 'Never opened', 0),
        ],
        player: perGame({
          1: () => achieved(5, 10),
          4: failing('no-stats'),
        }),
      });

      const list = await sut.getDashboard();

      expect(list.map((g) => g.name)).toEqual(['Half']);
    });

    it('should describe a game as the dashboard lists it', async () => {
      const { sut } = setup({
        owned: () => [game(3, 'Almost', 10)],
        player: () => achieved(9, 10),
      });

      const list = await sut.getDashboard();

      expect(list).toEqual([
        makeGameSummary({
          appid: 3,
          name: 'Almost',
          icon: 'https://media.steampowered.com/steamcommunity/public/images/apps/3/abc.jpg',
          unlocked: 9,
        }),
      ]);
    });

    it('should report each played game read, out of how many', async () => {
      const { sut } = setup({
        owned: () => [
          game(1, 'Half', 10),
          game(2, 'Complete', 10),
          game(4, 'No achievements', 10),
          game(5, 'Never opened', 0),
        ],
        player: perGame({
          1: () => achieved(5, 10),
          2: () => achieved(10, 10),
          4: failing('no-stats'),
        }),
      });
      const progress: [done: number, total: number][] = [];

      await sut.getDashboard('cached', (done, total) => {
        progress.push([done, total]);
      });

      expect(progress).toEqual([
        [1, 3],
        [2, 3],
        [3, 3],
      ]);
    });

    it('should share one read between identical simultaneous requests', async () => {
      const { sut, client } = setupTwoGames();

      await Promise.all([sut.getDashboard(), sut.getDashboard()]);

      expect(requestsTo(client, 'getPlayerAchievements')).toBe(2);
    });

    it('should file the dashboard under the account it was read for when another is in use by the time Steam answers', async () => {
      const { sut, store, keptFor } = setupSecondAccount({
        owned: () => [game(1, 'A', 10)],
        player: () => achieved(1, 4),
      });
      const reading = sut.getDashboard();
      store.setActiveAccount(OTHER_STEAM_ID);

      await reading;

      expect({
        mine: keptFor(STEAM_ID, 1),
        theirs: keptFor(OTHER_STEAM_ID, 1),
      }).toEqual({
        mine: {
          library: [game(1, 'A', 10)],
          game: null,
          summary: { total: 4, unlocked: 1, playtime: 10, lastUnlockAt: 0 },
        },
        theirs: { library: null, game: null, summary: null },
      });
    });

    it('should answer the dashboard of the account it was asked for when another is in use by the time the library arrives', async () => {
      const { sut, store, advance } = setupSecondAccount({
        owned: () => [game(1, 'A', 10), game(2, 'B', 20)],
        player: (_appid, credentials) =>
          achieved(isMine(credentials) ? 1 : 3, 4),
      });
      await sut.getDashboard();
      store.setActiveAccount(OTHER_STEAM_ID);
      await sut.getDashboard();
      store.setActiveAccount(STEAM_ID);
      advance(11 * 60_000);
      const reading = sut.getDashboard();
      store.setActiveAccount(OTHER_STEAM_ID);

      const list = await reading;

      expect(list.map(({ appid, unlocked }) => ({ appid, unlocked }))).toEqual([
        { appid: 1, unlocked: 1 },
        { appid: 2, unlocked: 1 },
      ]);
    });

    it('should say Steam answered when a game was read for the dashboard', async () => {
      const { sut } = setupTwoGames();
      const onAnswerMock = vi.fn<() => void>();

      await sut.getDashboard('cached', undefined, onAnswerMock);

      expect(onAnswerMock).toHaveBeenCalledExactlyOnceWith();
    });

    it('should say Steam answered when only the library was read again', async () => {
      const { sut, client, advance } = setupTwoGames();
      const onAnswerMock = vi.fn<() => void>();
      await sut.getDashboard();
      advance(11 * 60_000);

      await sut.getDashboard('cached', undefined, onAnswerMock);

      expect(requestsTo(client, 'getOwnedGames')).toBe(2);
      expect(requestsTo(client, 'getPlayerAchievements')).toBe(2);
      expect(onAnswerMock).toHaveBeenCalledExactlyOnceWith();
    });

    it('should not say Steam answered when the library and every game come from the cache', async () => {
      const { sut, client } = setupTwoGames();
      const onAnswerMock = vi.fn<() => void>();
      await sut.getDashboard();
      const askedBefore = client.asked.length;

      await sut.getDashboard('cached', undefined, onAnswerMock);

      expect(client.asked).toHaveLength(askedBefore);
      expect(onAnswerMock).not.toHaveBeenCalled();
    });

    it('should not say Steam answered when only the art, which needs no key, was asked for', async () => {
      const { sut, client } = setup({
        owned: () => [game(1, 'A', 10)],
        player: () => achieved(1, 4),
        art: storeDown,
      });
      const onAnswerMock = vi.fn<() => void>();
      await sut.getDashboard();

      await sut.getDashboard('cached', undefined, onAnswerMock);

      expect(requestsTo(client, 'getStoreArt')).toBe(2);
      expect(requestsTo(client, 'getPlayerAchievements')).toBe(1);
      expect(onAnswerMock).not.toHaveBeenCalled();
    });

    it('should not say Steam answered when the only game read has no stats', async () => {
      const { sut } = setup({
        owned: () => [game(4, 'No achievements', 10)],
        player: failing('no-stats'),
      });
      const onAnswerMock = vi.fn<() => void>();
      await sut.library();

      await sut.getDashboard('cached', undefined, onAnswerMock);

      expect(onAnswerMock).not.toHaveBeenCalled();
    });

    it('should read every played game the first time', async () => {
      const { sut, client } = setupTwoGames();

      await sut.getDashboard();

      expect(requestsTo(client, 'getPlayerAchievements')).toBe(2);
    });

    it('should not read again a game whose playtime did not change', async () => {
      const { sut, client, advance } = setupTwoGames();
      await sut.getDashboard();
      advance(11 * 60_000);

      await sut.getDashboard();

      expect(requestsTo(client, 'getPlayerAchievements')).toBe(2);
    });

    it('should read again only the game whose playtime changed', async () => {
      const { sut, client, advance, play } = setupTwoGames();
      await sut.getDashboard();
      play(15);
      advance(11 * 60_000);

      await sut.getDashboard();

      expect(requestsTo(client, 'getPlayerAchievements')).toBe(3);
    });

    it('should read every game again when asked for all of them', async () => {
      const { sut, client } = setupTwoGames();
      await sut.getDashboard();

      await sut.getDashboard('all');

      expect(requestsTo(client, 'getPlayerAchievements')).toBe(4);
    });

    it('should attach the capsule the store has for a game', async () => {
      const { sut } = setup({
        owned: () => [game(1, 'A', 10), game(2, 'B', 10)],
        player: () => achieved(1, 4),
        art: storeArtOfGame1,
      });

      const list = await sut.getDashboard();

      expect(list.find((g) => g.appid === 1)?.capsule).toBe(
        'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1/def/capsule_231x87.jpg?t=9',
      );
    });

    it('should leave the capsule empty for a game the store has no art for', async () => {
      const { sut } = setup({
        owned: () => [game(1, 'A', 10), game(2, 'B', 10)],
        player: () => achieved(1, 4),
        art: storeArtOfGame1,
      });

      const list = await sut.getDashboard();

      expect(list.find((g) => g.appid === 2)?.capsule).toBe('');
    });

    it('should not ask the store again about art it already asked for', async () => {
      const { sut, client } = setup({
        owned: () => [game(1, 'A', 10), game(2, 'B', 10)],
        player: () => achieved(1, 4),
        art: storeArtOfGame1,
      });
      await sut.getDashboard();

      await sut.getDashboard('all');

      expect(requestsTo(client, 'getStoreArt')).toBe(1);
    });

    it('should list the game when the store fails to provide the art', async () => {
      const { sut } = setup({
        owned: () => [game(1, 'A', 10)],
        player: () => achieved(1, 4),
        art: storeDown,
      });

      const list = await sut.getDashboard();

      expect(list.map((g) => g.name)).toEqual(['A']);
    });

    it('should say when a complete game was completed', async () => {
      const { sut } = setupCompleteGame();

      const list = await sut.getDashboard();

      expect(list.find((g) => g.appid === 1)?.completedAt).toBe(900);
    });

    it('should give no completion date to a game still in progress', async () => {
      const { sut } = setupCompleteGame();

      const list = await sut.getDashboard();

      expect(list.find((g) => g.appid === 2)?.completedAt).toBeNull();
    });

    it('should start no other game when the read of one fails the dashboard', async () => {
      const { start, failGame, gamesAsked } = setupDozenGames();
      const { ended } = await start();

      await failGame(2, 'network', ended);

      expect(gamesAsked()).toEqual([1, 2, 3, 4]);
    });

    it('should keep the games that were being read when another failed the dashboard', async () => {
      const { start, failGame, gamesSaved } = setupDozenGames();
      const { ended } = await start();

      await failGame(2, 'network', ended);

      expect(gamesSaved()).toEqual([1, 3, 4]);
    });

    it('should answer the failure only after the reads in flight ended, and announce nothing after it', async () => {
      const { start, failGame, events } = setupDozenGames();
      const { ended } = await start();

      await failGame(2, 'network', ended);

      expect(events).toEqual(['1/12', '2/12', '3/12', 'failed: network']);
    });

    it('should read only the games that were not read when a failed dashboard is asked for again', async () => {
      const { start, failGame, answerTheRest, gamesAsked, client, events } =
        setupDozenGames();
      await failGame(2, 'network', (await start()).ended);
      client.asked.length = 0;
      events.length = 0;

      const { ended } = await start();
      await answerTheRest();
      await ended;

      expect(gamesAsked()).toEqual([2, 5, 6, 7, 8, 9, 10, 11, 12]);
      expect(events.at(-1)).toBe('answered 12 games');
    });

    it('should read the other games and keep the failed one out of the cache when one fails with an unknown error', async () => {
      const { start, failGame, gamesAsked, gamesSaved, events } =
        setupDozenGames();
      const { ended } = await start();

      await failGame(2, 'unknown', ended);

      expect(gamesAsked()).toEqual(DOZEN);
      expect(gamesSaved()).toEqual([1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      expect(events.at(-1)).toBe('answered 11 games');
    });

    it('should fail with a private profile instead of answering an empty dashboard', async () => {
      const { sut } = setup({
        owned: () => [game(1, 'A', 10)],
        player: failing('private'),
      });

      const dashboardPromise = sut.getDashboard();

      await expect(dashboardPromise).rejects.toMatchObject({
        kind: 'private',
      });
    });
  });
});
