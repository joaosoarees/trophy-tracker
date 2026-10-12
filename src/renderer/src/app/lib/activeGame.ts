import { type CurrentGame } from '@shared/types/Game';

export interface IActiveGame {
  appid: number | null;
  isRunning: boolean;
  /** The running game belongs to a Steam account the app does not have. */
  isOnAnotherAccount: boolean;
}

/** The game on screen: the one picked in the dashboard or, without a pick, the current one. */
export function activeGame(
  current: CurrentGame,
  pickedAppId: number | null,
): IActiveGame {
  const appid = pickedAppId ?? current?.appid ?? null;
  const isCurrent = current !== null && appid === current.appid;

  return {
    appid,
    isRunning: isCurrent && current.isRunning,
    isOnAnotherAccount: isCurrent && current.isOnAnotherAccount === true,
  };
}
