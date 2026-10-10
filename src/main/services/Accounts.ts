import { type IAppState } from '@shared/types/AppState';
import { type CheckResult } from '@shared/types/Check';

import { ErrorLog } from '../system/ErrorLog';

import { type AccountFollower } from './AccountFollower';
import { type GameWatcher } from './GameWatcher';
import { type SetupService } from './SetupService';

interface IAccountsDeps {
  setup: Pick<
    SetupService,
    'addAccount' | 'setActiveAccount' | 'removeAccount' | 'getState'
  >;
  follower: Pick<AccountFollower, 'onClientChange' | 'forRunningGame'>;
  watcher: Pick<GameWatcher, 'isPlaying' | 'forget' | 'checkRunningGame'>;
  logError?: (source: string, detail: string) => void;
}

/**
 * Every change of the account in use, in one place: the game on screen
 * belongs to the account that is left, so the watcher forgets it as another
 * account takes over, in the same turn and only once the change was taken: a
 * change the disk refuses throws before anything is forgotten, and the app
 * is left as it was.
 */
export class Accounts {
  /**
   * The looks whose last try ended in a write the disk refused. Each kind
   * has its own run of refusals: the look made every 30 s finds nothing to
   * do, and so works, while the one made as a game starts is still refused.
   */
  private readonly refused = new Set<'client' | 'game'>();

  constructor(private readonly deps: IAccountsDeps) {}

  /**
   * Adds an account, which the app then follows, if Steam accepts its key.
   * The game on screen is forgotten only when the added account took over:
   * the account in use is then one the app did not have before. A refused
   * add changes nothing, even if the app followed a saved account meanwhile,
   * and answers why it was refused. Either way the running game is checked
   * again when the app has an account.
   */
  async add(steamId: string, apiKey: string): Promise<CheckResult<IAppState>> {
    const { setup, watcher } = this.deps;
    const saved = setup.getState().accounts.map((account) => account.steamId);
    const result = await setup.addAccount(steamId, apiKey);
    const state = result.ok ? result.value : setup.getState();
    const hasTakenOver =
      state.activeSteamId !== null && !saved.includes(state.activeSteamId);
    if (hasTakenOver) this.forgetGame();
    if (state.isConfigured) void watcher.checkRunningGame();
    return result;
  }

  /** Follows another saved account, unless a game is being played. */
  switchTo(steamId: string): IAppState {
    const { setup, watcher } = this.deps;
    // The account playing a game is not left while the game runs.
    if (watcher.isPlaying) return setup.getState();
    const state = setup.setActiveAccount(steamId);
    this.forgetGame();
    return state;
  }

  /** Forgets an account, with everything kept for it. */
  remove(steamId: string): IAppState {
    const state = this.deps.setup.removeAccount(steamId);
    this.forgetGame();
    return state;
  }

  /**
   * Puts the app on the account signed in to Steam when that one changed.
   * Nobody asked for it (the app opening, the timer), so it never rejects: an
   * account the disk refuses leaves the app where it was, and the next look
   * tries again. The error log is told once for as long as it goes on, not
   * at every look.
   */
  async followClient(): Promise<void> {
    const hasSwitched = await this.unlessRefused('client', () =>
      this.deps.follower.onClientChange(),
    );
    if (hasSwitched === true) this.forgetGame();
  }

  /**
   * A game has started: puts the app on the account playing it, for the
   * watcher, which asks at each of its checks until it is told whose game it
   * is. Nobody asked for this either, so it never rejects: an account the
   * disk refuses is answered as `refused`, the app stays where it was, and
   * the error log is told once for as long as check after check is refused.
   * The watcher is in the middle of looking at that game, so nothing is
   * forgotten here.
   */
  followRunningGame(): Promise<'followed' | 'other' | 'refused'> {
    return this.unlessRefused('game', () =>
      this.deps.follower.forRunningGame(),
    );
  }

  /**
   * Runs a look the app makes by itself and answers `refused` when it
   * rejects, having told the error log if the look of that kind before it
   * had not been refused too.
   */
  private async unlessRefused<T>(
    look: 'client' | 'game',
    follow: () => Promise<T>,
  ): Promise<T | 'refused'> {
    try {
      const answer = await follow();
      this.refused.delete(look);
      return answer;
    } catch (e) {
      if (!this.refused.has(look)) {
        this.deps.logError?.('main: follow account', ErrorLog.detailOf(e));
      }
      this.refused.add(look);
      return 'refused';
    }
  }

  /** The game on screen belonged to the account that is left. */
  private forgetGame(): void {
    this.deps.watcher.forget({ isCurrentIncluded: true });
  }
}
