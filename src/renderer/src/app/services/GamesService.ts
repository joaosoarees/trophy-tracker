import { type CheckResult } from '@shared/types/Check';
import { type IGameView, type CurrentGame } from '@shared/types/Game';

import { Service } from './Service';

export class GamesService extends Service {
  /** Game open on Steam or, with no game open, the last one played. */
  static getCurrent(): Promise<CurrentGame> {
    return this.api.getCurrentAppId();
  }

  static getGame(
    appid: number,
    isForced = false,
  ): Promise<CheckResult<IGameView>> {
    return this.api.getGame(appid, isForced);
  }

  /** Returns the function that stops listening. */
  static onCurrentChanged(
    listener: (current: CurrentGame) => void,
  ): () => void {
    return this.api.onGameChanged(listener);
  }

  /** Returns the function that stops listening. */
  static onGameUpdated(listener: (view: IGameView) => void): () => void {
    return this.api.onGameUpdated(listener);
  }
}
