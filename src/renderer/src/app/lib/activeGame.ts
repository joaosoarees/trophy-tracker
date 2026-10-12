import { type CurrentGame } from '@shared/types/Game';

export interface IActiveGame {
  appid: number | null;
  isRunning: boolean;
  /** The running game belongs to a Steam account the app does not have. */
  isOnAnotherAccount: boolean;
}

/**
 * The game on screen: the one picked in the dashboard or, without a pick, the
 * current one. A game running on an account the app does not have is not
 * this account's: with no pick it takes the screen, to say so and offer the
 * account, but a pick is of a game of the account in use (the dashboard
 * lists no other), which is shown as that account has it, and is not the
 * one running.
 */
export function activeGame(
  current: CurrentGame,
  pickedAppId: number | null,
): IActiveGame {
  const isElsewhere = current?.isOnAnotherAccount === true;
  if (pickedAppId === null) {
    return {
      appid: current?.appid ?? null,
      isRunning: current?.isRunning === true,
      isOnAnotherAccount: isElsewhere,
    };
  }

  const isTheOneRunning =
    !isElsewhere &&
    current?.isRunning === true &&
    current.appid === pickedAppId;
  return {
    appid: pickedAppId,
    isRunning: isTheOneRunning,
    isOnAnotherAccount: false,
  };
}
