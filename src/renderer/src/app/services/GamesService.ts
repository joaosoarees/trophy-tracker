import { type CheckResult, type IGameView } from '@shared/types';

import { Service } from './Service';

export class GamesService extends Service {
  /** Game open on Steam or, with no game open, the last one played. */
  static getCurrent(): Promise<GamesService.Current> {
    return this.api.getCurrentAppId();
  }

  static getGame(
    appid: number,
    force = false,
  ): Promise<CheckResult<IGameView>> {
    return this.api.getGame(appid, force);
  }

  /** Returns the function that stops listening. */
  static onCurrentChanged(
    listener: (current: GamesService.Current) => void,
  ): () => void {
    return this.api.onGameChanged(listener);
  }

  /** Returns the function that stops listening. */
  static onGameUpdated(listener: (view: IGameView) => void): () => void {
    return this.api.onGameUpdated(listener);
  }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace GamesService {
  export type Current = { appid: number; running: boolean } | null;
}
