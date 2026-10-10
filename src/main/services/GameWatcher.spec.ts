import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type CheckResult } from '@shared/types/Check';
import { type CurrentGame, type IGameView } from '@shared/types/Game';
import { makeAchievement } from '@tests/factories/makeAchievement';
import { makeGameView } from '@tests/factories/makeGameView';

import { GameWatcher, type IGameWatcherDeps } from './GameWatcher';

/** A game with three achievements, of which the given ones are unlocked. */
const view = (appid: number, unlockedIds: string[]) =>
  makeGameView({
    appid,
    achievements: ['a', 'b', 'c'].map((id) =>
      makeAchievement({
        id,
        name: `Achievement ${id}`,
        unlocked: unlockedIds.includes(id),
        unlockedAt: unlockedIds.includes(id) ? 1 : null,
      }),
    ),
  });

function setup(overrides: Partial<IGameWatcherDeps> = {}) {
  let running: number | null = null;
  let polled: CheckResult<IGameView> = { ok: false, error: 'no poll set' };
  const getRunningAppIdMock = vi.fn(() => Promise.resolve(running));
  const lastPlayedAppIdMock = vi.fn(() => Promise.resolve<number | null>(7));
  const pollGameMock = vi.fn((_appid: number) => Promise.resolve(polled));
  const onCurrentChangedMock = vi.fn<(current: CurrentGame) => void>();
  const onGameUpdatedMock = vi.fn<(updated: IGameView) => void>();
  const deps = {
    getRunningAppId: getRunningAppIdMock,
    lastPlayedAppId: lastPlayedAppIdMock,
    pollGame: pollGameMock,
    isConfigured: () => true,
    onCurrentChanged: onCurrentChangedMock,
    onGameUpdated: onGameUpdatedMock,
    ...overrides,
  } satisfies IGameWatcherDeps;

  return {
    sut: new GameWatcher(deps),
    getRunningAppIdMock,
    lastPlayedAppIdMock,
    pollGameMock,
    onCurrentChangedMock,
    onGameUpdatedMock,
    run: (appid: number | null) => (running = appid),
    poll: (next: IGameView) => (polled = { ok: true, value: next }),
  };
}

describe('GameWatcher', () => {
  describe('refreshCurrent', () => {
    it('should show the last played game when no game is running', async () => {
      const { sut } = setup();

      const current = await sut.refreshCurrent();

      expect(current).toEqual({ appid: 7, isRunning: false });
    });

    it('should show the running game when one is running', async () => {
      const { sut, run } = setup();
      run(42);

      const current = await sut.refreshCurrent();

      expect(current).toEqual({ appid: 42, isRunning: true });
    });

    it('should keep showing a game that was closed when the library names another as last played', async () => {
      const { sut, run } = setup();
      run(42);
      await sut.refreshCurrent();
      run(null);

      const current = await sut.refreshCurrent();

      expect(current).toEqual({ appid: 42, isRunning: false });
    });

    it('should say the running game is on another account when the app does not have that account', async () => {
      const { sut, run } = setup({
        followRunningGame: () => Promise.resolve('other'),
      });
      run(42);

      const current = await sut.refreshCurrent();

      expect(current).toEqual({
        appid: 42,
        isRunning: true,
        isOnAnotherAccount: true,
      });
    });

    it('should show the last played game when the game that closed was on another account', async () => {
      const { sut, run } = setup({
        followRunningGame: () => Promise.resolve('other'),
      });
      run(42);
      await sut.refreshCurrent();
      run(null);

      const current = await sut.refreshCurrent();

      expect(current).toEqual({ appid: 7, isRunning: false });
    });

    it('should show no game when the app is not set up', async () => {
      const { sut } = setup({ isConfigured: () => false });

      const current = await sut.refreshCurrent();

      expect(current).toBeNull();
    });

    it('should not ask for the last played game when the app is not set up', async () => {
      const { sut, lastPlayedAppIdMock } = setup({
        isConfigured: () => false,
      });

      await sut.refreshCurrent();

      expect(lastPlayedAppIdMock).not.toHaveBeenCalled();
    });

    it('should show no game when the last played one cannot be read', async () => {
      const { sut } = setup({
        lastPlayedAppId: () => Promise.reject(new Error('offline')),
      });

      const current = await sut.refreshCurrent();

      expect(current).toBeNull();
    });
  });

  describe('isPlaying', () => {
    it('should be true when a game of an account the app has is running', async () => {
      const { sut, run } = setup();
      run(42);
      await sut.refreshCurrent();

      const isPlaying = sut.isPlaying;

      expect(isPlaying).toBe(true);
    });

    it('should be false when the running game is on an account the app does not have', async () => {
      const { sut, run } = setup({
        followRunningGame: () => Promise.resolve('other'),
      });
      run(42);
      await sut.refreshCurrent();

      const isPlaying = sut.isPlaying;

      expect(isPlaying).toBe(false);
    });
  });

  describe('checkRunningGame', () => {
    it('should not ask again whose game it is when the same game is still running', async () => {
      const followRunningGameMock = vi.fn(() =>
        Promise.resolve('followed' as const),
      );
      const { sut, run } = setup({ followRunningGame: followRunningGameMock });
      run(42);
      await sut.checkRunningGame();

      await sut.checkRunningGame();

      expect(followRunningGameMock).toHaveBeenCalledExactlyOnceWith();
    });

    it('should not announce the current game again when it has not changed', async () => {
      const { sut, onCurrentChangedMock } = setup();
      await sut.checkRunningGame();

      await sut.checkRunningGame();

      expect(onCurrentChangedMock).toHaveBeenCalledExactlyOnceWith({
        appid: 7,
        isRunning: false,
      });
    });

    it('should announce the game when it starts', async () => {
      const { sut, onCurrentChangedMock, run } = setup();
      await sut.refreshCurrent();
      run(42);

      await sut.checkRunningGame();

      expect(onCurrentChangedMock).toHaveBeenCalledExactlyOnceWith({
        appid: 42,
        isRunning: true,
      });
    });

    it('should read one last time before announcing the change when the game closes', async () => {
      const events: unknown[] = [];
      const { sut, run, poll } = setup({
        onGameUpdated: (updated) =>
          events.push(['updated', updated.unlockedCount]),
        onCurrentChanged: (current) => events.push(['changed', current]),
      });
      run(42);
      await sut.refreshCurrent();
      sut.remember(view(42, ['a']));
      poll(view(42, ['a', 'b', 'c']));
      run(null);

      await sut.checkRunningGame();

      expect(events).toEqual([
        ['updated', 3],
        ['changed', { appid: 42, isRunning: false }],
      ]);
    });

    it('should announce the current game again when it was forgotten', async () => {
      const { sut, onCurrentChangedMock, run } = setup();
      run(42);
      await sut.checkRunningGame();
      sut.forget({ isCurrentIncluded: true });

      await sut.checkRunningGame();

      expect(onCurrentChangedMock).toHaveBeenCalledTimes(2);
      expect(onCurrentChangedMock).toHaveBeenNthCalledWith(2, {
        appid: 42,
        isRunning: true,
      });
    });
  });

  describe('checkUnlocks', () => {
    it('should hand over the new view when something was unlocked', async () => {
      const { sut, onGameUpdatedMock, run, poll } = setup();
      run(42);
      await sut.refreshCurrent();
      sut.remember(view(42, ['a']));
      const next = view(42, ['a', 'b']);
      poll(next);

      await sut.checkUnlocks();

      expect(onGameUpdatedMock).toHaveBeenCalledExactlyOnceWith(next);
    });

    it('should not announce an update when the poll returns the same view', async () => {
      const { sut, onGameUpdatedMock, run, poll } = setup();
      run(42);
      await sut.refreshCurrent();
      const seen = view(42, ['a']);
      sut.remember(seen);
      poll(seen);

      await sut.checkUnlocks();

      expect(onGameUpdatedMock).not.toHaveBeenCalled();
    });

    it('should not announce an update when the poll fails', async () => {
      const { sut, onGameUpdatedMock, run } = setup();
      run(42);
      await sut.refreshCurrent();

      await sut.checkUnlocks();

      expect(onGameUpdatedMock).not.toHaveBeenCalled();
    });

    it('should not poll when no game is running', async () => {
      const { sut, pollGameMock } = setup();
      await sut.refreshCurrent();

      await sut.checkUnlocks();

      expect(pollGameMock).not.toHaveBeenCalled();
    });

    it('should not poll when the running game is on an account the app does not have', async () => {
      const { sut, pollGameMock, run } = setup({
        followRunningGame: () => Promise.resolve('other'),
      });
      run(42);
      await sut.refreshCurrent();

      await sut.checkUnlocks();

      expect(pollGameMock).not.toHaveBeenCalled();
    });

    it('should not poll when the setup is gone', async () => {
      let isConfigured = true;
      const { sut, pollGameMock, run } = setup({
        isConfigured: () => isConfigured,
      });
      run(42);
      await sut.refreshCurrent();
      isConfigured = false;

      await sut.checkUnlocks();

      expect(pollGameMock).not.toHaveBeenCalled();
    });
  });

  describe('start', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should look for the running game every ten seconds when no interval is given', async () => {
      const { sut, getRunningAppIdMock } = setup();
      sut.start();

      await vi.advanceTimersByTimeAsync(30_000);

      expect(getRunningAppIdMock).toHaveBeenCalledTimes(3);
    });

    it('should announce a game that was opened when the next check comes round', async () => {
      const { sut, onCurrentChangedMock, run } = setup();
      sut.start();
      run(42);

      await vi.advanceTimersByTimeAsync(10_000);

      expect(onCurrentChangedMock).toHaveBeenCalledExactlyOnceWith({
        appid: 42,
        isRunning: true,
      });
    });

    it('should read the running game every minute when no interval is given', async () => {
      const { sut, pollGameMock, run } = setup();
      run(42);
      await sut.refreshCurrent();
      sut.start();

      await vi.advanceTimersByTimeAsync(120_000);

      expect(pollGameMock).toHaveBeenCalledTimes(2);
      expect(pollGameMock).toHaveBeenLastCalledWith(42);
    });

    it('should look for the running game at the interval it is given', async () => {
      const { sut, getRunningAppIdMock } = setup({
        intervals: { running: 2_000, unlocks: 3_000 },
      });
      sut.start();

      await vi.advanceTimersByTimeAsync(6_000);

      expect(getRunningAppIdMock).toHaveBeenCalledTimes(3);
    });

    it('should read the running game at the interval it is given', async () => {
      const { sut, pollGameMock, run } = setup({
        intervals: { running: 2_000, unlocks: 3_000 },
      });
      run(42);
      await sut.refreshCurrent();
      sut.start();

      await vi.advanceTimersByTimeAsync(6_000);

      expect(pollGameMock).toHaveBeenCalledTimes(2);
      expect(pollGameMock).toHaveBeenLastCalledWith(42);
    });
  });
});
