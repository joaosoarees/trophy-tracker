import {
  type ICredentials,
  type IRawOwnedGame,
  type IRawPlayerAchievement,
  type IRawPlayerSummary,
  type IRawSchemaAchievement,
  type IStoreArt,
  type SteamClient,
} from '../src/main/steam/SteamClient';

/**
 * What Steam answers, as `SteamClient` hands it over: values, not HTTP. An
 * answer that throws is Steam failing: throw the `SteamError` the real client
 * would (`new SteamError('private')`).
 */
export interface ISteamAnswers {
  /** The profile of an account (`getPlayerSummary`). */
  summary?: (credentials: ICredentials) => IRawPlayerSummary;
  /** The library of an account; `null` is a library that is not visible. */
  owned?: (credentials: ICredentials) => IRawOwnedGame[] | null;
  /** The achievement list of a game (`getGameAchievements`). */
  achievements?: (appid: number) => IRawSchemaAchievement[];
  /**
   * What a player has in a game (`getPlayerAchievements`). A promise is Steam
   * taking its time: the test settles it when the answer is to arrive.
   */
  player?: (
    appid: number,
    credentials: ICredentials,
  ) => IRawPlayerAchievement[] | Promise<IRawPlayerAchievement[]>;
  /** The counters of a player in a game (`getUserStats`). */
  stats?: (appid: number, credentials: ICredentials) => Record<string, number>;
  /** The art the store has; by default it has none for any game. */
  art?: (appids: number[]) => Map<number, IStoreArt>;
}

/** One thing that was asked of Steam: which method, and with what. */
export type SteamRequest =
  | { method: 'getPlayerSummary'; credentials: ICredentials }
  | { method: 'getOwnedGames'; credentials: ICredentials }
  | { method: 'getGameAchievements'; appid: number }
  | {
      method: 'getPlayerAchievements';
      appid: number;
      credentials: ICredentials;
    }
  | { method: 'getUserStats'; appid: number; credentials: ICredentials }
  | { method: 'getStoreArt'; appids: number[] };

type FakeSteamClient = Pick<
  SteamClient,
  | 'getPlayerSummary'
  | 'getOwnedGames'
  | 'getGameAchievements'
  | 'getPlayerAchievements'
  | 'getUserStats'
  | 'getStoreArt'
> & {
  /** Everything that was asked, in order. */
  asked: SteamRequest[];
};

/**
 * `SteamClient` without the network, for the specs of the services that use
 * one. It answers what it is given and writes down in `asked` every request.
 * A request with no answer throws, so a call the test did not provide for is
 * never taken for an answer from Steam.
 */
export function fakeSteamClient(answers: ISteamAnswers = {}): FakeSteamClient {
  const asked: SteamRequest[] = [];
  /** Writes the request down and answers later, as a request would. */
  const answer = <T>(
    request: SteamRequest,
    give?: () => T | Promise<T>,
  ): Promise<T> => {
    asked.push(request);
    return Promise.resolve().then(() => {
      if (give) return give();
      throw new Error(`fakeSteamClient: nothing answers ${request.method}`);
    });
  };
  const { summary, owned, achievements, player, stats, art } = answers;

  return {
    asked,
    getPlayerSummary: (credentials) =>
      answer(
        { method: 'getPlayerSummary', credentials },
        summary && (() => summary(credentials)),
      ),
    getOwnedGames: (credentials) =>
      answer(
        { method: 'getOwnedGames', credentials },
        owned && (() => owned(credentials)),
      ),
    getGameAchievements: (appid) =>
      answer(
        { method: 'getGameAchievements', appid },
        achievements && (() => achievements(appid)),
      ),
    getPlayerAchievements: (credentials, appid) =>
      answer(
        { method: 'getPlayerAchievements', appid, credentials },
        player && (() => player(appid, credentials)),
      ),
    getUserStats: (credentials, appid) =>
      answer(
        { method: 'getUserStats', appid, credentials },
        stats && (() => stats(appid, credentials)),
      ),
    getStoreArt: (appids) =>
      answer({ method: 'getStoreArt', appids }, () =>
        art ? art(appids) : new Map<number, IStoreArt>(),
      ),
  };
}
