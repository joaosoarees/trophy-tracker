import { type IAppState } from '@shared/types/AppState';

import { type AccountFollower } from './AccountFollower';
import { type GameWatcher } from './GameWatcher';
import { type SetupService } from './SetupService';

interface IAccountsDeps {
  setup: Pick<
    SetupService,
    'addAccount' | 'setActiveAccount' | 'removeAccount' | 'getState'
  >;
  follower: Pick<AccountFollower, 'onClientChange'>;
  watcher: Pick<GameWatcher, 'isPlaying' | 'forget' | 'checkRunningGame'>;
}

/**
 * Every change of the account in use, in one place: the game on screen
 * belongs to the account that is left, so the watcher forgets it before
 * another account takes over.
 */
export class Accounts {
  constructor(private readonly deps: IAccountsDeps) {}

  /** Adds an account, which the app then follows, if Steam accepts its key. */
  async add(steamId: string, apiKey: string): Promise<IAppState> {
    const { setup, watcher } = this.deps;
    const state = await setup.addAccount(steamId, apiKey);
    if (state.isConfigured) void watcher.checkRunningGame();
    return state;
  }

  /** Follows another saved account, unless a game is being played. */
  switchTo(steamId: string): IAppState {
    const { setup, watcher } = this.deps;
    // The account playing a game is not left while the game runs.
    if (watcher.isPlaying) return setup.getState();
    this.forgetGame();
    return setup.setActiveAccount(steamId);
  }

  /** Forgets an account, with everything kept for it. */
  remove(steamId: string): IAppState {
    this.forgetGame();
    return this.deps.setup.removeAccount(steamId);
  }

  /** Puts the app on the account signed in to Steam when that one changed. */
  async followClient(): Promise<void> {
    if (await this.deps.follower.onClientChange()) this.forgetGame();
  }

  /** The game on screen belonged to the account that is left. */
  private forgetGame(): void {
    this.deps.watcher.forget({ isCurrentIncluded: true });
  }
}
