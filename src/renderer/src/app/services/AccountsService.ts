import { type IAppState } from '@shared/types/AppState';
import { type CheckResult } from '@shared/types/Check';

import { Service } from './Service';

/** The accounts the app can follow. A key goes in through here and never comes back. */
export class AccountsService extends Service {
  static setActive(steamId: string): Promise<IAppState> {
    return this.api.setActiveAccount(steamId);
  }

  /** Forgets the account, with its key, what was read for it and its notes. */
  static remove(steamId: string): Promise<IAppState> {
    return this.api.removeAccount(steamId);
  }

  /** Saves the new key only if Steam accepts it for that account. */
  static replaceKey(
    steamId: string,
    apiKey: string,
  ): Promise<CheckResult<IAppState>> {
    return this.api.replaceKey(steamId, apiKey);
  }

  /** Asks Steam again whether the saved key works. */
  static recheck(steamId: string): Promise<IAppState> {
    return this.api.recheckAccount(steamId);
  }

  /** Returns the function that stops listening. */
  static onStateChanged(
    listener: (state: IAppState, followed: boolean) => void,
  ): () => void {
    return this.api.onStateChanged(listener);
  }
}
