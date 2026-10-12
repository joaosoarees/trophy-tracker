import { describe, expect, it } from 'vitest';

import { activeGame } from './activeGame';

describe('activeGame', () => {
  it('should show no game when none is current and none was picked', () => {
    const game = activeGame(null, null);

    expect(game).toEqual({
      appid: null,
      isRunning: false,
      isOnAnotherAccount: false,
    });
  });

  it('should show the current game as running when it is and nothing was picked', () => {
    const game = activeGame({ appid: 42, isRunning: true }, null);

    expect(game).toEqual({
      appid: 42,
      isRunning: true,
      isOnAnotherAccount: false,
    });
  });

  it('should show the last played game as not running when nothing was picked', () => {
    const game = activeGame({ appid: 7, isRunning: false }, null);

    expect(game).toEqual({
      appid: 7,
      isRunning: false,
      isOnAnotherAccount: false,
    });
  });

  it('should say the game is on another account when it runs on one the app does not have and nothing was picked', () => {
    const current = { appid: 42, isRunning: true, isOnAnotherAccount: true };

    const game = activeGame(current, null);

    expect(game).toEqual({
      appid: 42,
      isRunning: true,
      isOnAnotherAccount: true,
    });
  });

  it('should show the picked game as not running when another one runs', () => {
    const game = activeGame({ appid: 42, isRunning: true }, 7);

    expect(game).toEqual({
      appid: 7,
      isRunning: false,
      isOnAnotherAccount: false,
    });
  });

  it('should show the picked game as running when it is the one that runs', () => {
    const game = activeGame({ appid: 42, isRunning: true }, 42);

    expect(game).toEqual({
      appid: 42,
      isRunning: true,
      isOnAnotherAccount: false,
    });
  });
});
