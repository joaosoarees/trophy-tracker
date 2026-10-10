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

/** An answer that arrives when the test says so. */
function held<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** One turn of the event loop: whatever was ready to run has run. */
const turn = (): Promise<void> =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });

/** A scheduler that runs nothing and tells which repetitions are still going. */
function fakeEvery() {
  const going: number[] = [];

  return {
    every: (_run: () => void, ms: number) => {
      going.push(ms);
      return () => void going.splice(going.indexOf(ms), 1);
    },
    /** The interval of each repetition that was started and not stopped. */
    repeating: () => [...going],
  };
}

/** A scheduler that runs a repetition only when the test says its time has come. */
function manualEvery() {
  const runs = new Map<number, () => void>();

  return {
    every: (run: () => void, ms: number) => {
      runs.set(ms, run);
      return () => void runs.delete(ms);
    },
    /** The time of the repetition started with this interval has come round. */
    tick: (ms: number) => runs.get(ms)?.(),
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

    it('should show the last played game of the account in use when a game was seen closing before another account took over', async () => {
      const { sut, run } = setup();
      run(42);
      await sut.refreshCurrent();
      run(null);
      sut.forget({ isCurrentIncluded: true });

      const current = await sut.refreshCurrent();

      expect(current).toEqual({ appid: 7, isRunning: false });
    });
  });

  it('should answer the last played game of the account in use when another was in use as it began to look', async () => {
    const lastPlayed = [held<number | null>(), held<number | null>()];
    let reads = 0;
    const { sut } = setup({
      lastPlayedAppId: () => lastPlayed[reads++].promise,
    });
    const refreshing = sut.refreshCurrent();
    await turn();
    sut.forget({ isCurrentIncluded: true });
    lastPlayed[0].resolve(7);
    lastPlayed[1].resolve(8);

    const current = await refreshing;

    expect(current).toEqual({ appid: 8, isRunning: false });
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

    it('should announce that the game closed when its last read fails', async () => {
      const { sut, onCurrentChangedMock, run } = setup();
      run(42);
      await sut.refreshCurrent();
      run(null);

      await sut.checkRunningGame();

      expect(onCurrentChangedMock).toHaveBeenCalledExactlyOnceWith({
        appid: 42,
        isRunning: false,
      });
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

  it('should not announce the last played game of the account that was left when it is known only after another took over', async () => {
    const lastPlayed = held<number | null>();
    const { sut, onCurrentChangedMock } = setup({
      lastPlayedAppId: () => lastPlayed.promise,
    });
    const checking = sut.checkRunningGame();
    await turn();
    sut.forget({ isCurrentIncluded: true });
    lastPlayed.resolve(7);

    await checking;

    expect(onCurrentChangedMock).not.toHaveBeenCalled();
  });

  it('should not announce the game that closed when another account took over during its last read', async () => {
    const lastPoll = held<CheckResult<IGameView>>();
    const { sut, run, onCurrentChangedMock } = setup({
      pollGame: () => lastPoll.promise,
    });
    run(42);
    await sut.checkRunningGame();
    onCurrentChangedMock.mockClear();
    run(null);
    const checking = sut.checkRunningGame();
    await turn();
    sut.forget({ isCurrentIncluded: true });
    lastPoll.resolve({ ok: true, value: view(42, ['a']) });

    await checking;

    expect(onCurrentChangedMock).not.toHaveBeenCalled();
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

    it('should not announce an update when the poll returns the view the interface has, though it was given another game since', async () => {
      const { sut, onGameUpdatedMock, run, poll } = setup();
      run(42);
      await sut.refreshCurrent();
      const seen = view(42, ['a']);
      sut.remember(seen);
      sut.remember(view(7, ['a']));
      poll(seen);

      await sut.checkUnlocks();

      expect(onGameUpdatedMock).not.toHaveBeenCalled();
    });

    it('should hand over the view again when what was read was dropped since the interface saw it', async () => {
      const { sut, onGameUpdatedMock, run, poll } = setup();
      run(42);
      await sut.refreshCurrent();
      const seen = view(42, ['a']);
      sut.remember(seen);
      sut.forget();
      poll(seen);

      await sut.checkUnlocks();

      expect(onGameUpdatedMock).toHaveBeenCalledExactlyOnceWith(seen);
    });

    it('should not hand over the view of the game of the account that was left when it is read only after another took over', async () => {
      const read = held<CheckResult<IGameView>>();
      const { sut, onGameUpdatedMock, run } = setup({
        pollGame: () => read.promise,
      });
      run(42);
      await sut.refreshCurrent();
      const checking = sut.checkUnlocks();
      sut.forget({ isCurrentIncluded: true });
      read.resolve({ ok: true, value: view(42, ['a']) });

      await checking;

      expect(onGameUpdatedMock).not.toHaveBeenCalled();
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

  describe('forget', () => {
    it('should keep the current game when only what was read is dropped', async () => {
      const { sut, onCurrentChangedMock, run } = setup();
      run(42);
      await sut.checkRunningGame();
      sut.forget();

      await sut.checkRunningGame();

      expect(onCurrentChangedMock).toHaveBeenCalledExactlyOnceWith({
        appid: 42,
        isRunning: true,
      });
    });
  });

  describe('checks that overlap', () => {
    it('should announce a game that opened once when the next check comes round before the one that saw it has ended', async () => {
      const answers = [held<number | null>(), held<number | null>()];
      let asked = 0;
      const { every, tick } = manualEvery();
      const { sut, onCurrentChangedMock } = setup({
        every,
        getRunningAppId: () => answers[asked++].promise,
      });
      sut.start();
      tick(10_000);
      tick(10_000);
      answers[0].resolve(42);
      answers[1].resolve(42);

      await turn();

      expect(onCurrentChangedMock).toHaveBeenCalledExactlyOnceWith({
        appid: 42,
        isRunning: true,
      });
    });

    it('should hand over the new view once when the next read comes round before the one before it has ended and both answer it', async () => {
      const read = held<CheckResult<IGameView>>();
      const { every, tick } = manualEvery();
      const { sut, onGameUpdatedMock, run } = setup({
        every,
        pollGame: () => read.promise,
      });
      run(42);
      await sut.refreshCurrent();
      sut.remember(view(42, ['a']));
      sut.start();
      tick(60_000);
      tick(60_000);
      const next = view(42, ['a', 'b']);
      read.resolve({ ok: true, value: next });

      await turn();

      expect(onGameUpdatedMock).toHaveBeenCalledExactlyOnceWith(next);
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

    it('should not double the checks when it is started twice', () => {
      const { every, repeating } = fakeEvery();
      const { sut } = setup({ every });
      sut.start();

      sut.start();

      expect(repeating()).toEqual([10_000, 60_000]);
    });

    it('should run both checks again when it is started after being stopped', () => {
      const { every, repeating } = fakeEvery();
      const { sut } = setup({ every });
      sut.start();
      sut.stop();

      sut.start();

      expect(repeating()).toEqual([10_000, 60_000]);
    });
  });

  describe('stop', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should no longer look for the running game when it is stopped', async () => {
      const { sut, getRunningAppIdMock } = setup();
      sut.start();
      sut.stop();

      await vi.advanceTimersByTimeAsync(30_000);

      expect(getRunningAppIdMock).not.toHaveBeenCalled();
    });

    it('should no longer read the running game when it is stopped', async () => {
      const { sut, pollGameMock, run } = setup();
      run(42);
      await sut.refreshCurrent();
      sut.start();
      sut.stop();

      await vi.advanceTimersByTimeAsync(120_000);

      expect(pollGameMock).not.toHaveBeenCalled();
    });

    it('should end both repetitions of the scheduler it was given when it is stopped', () => {
      const { every, repeating } = fakeEvery();
      const { sut } = setup({ every });
      sut.start();

      sut.stop();

      expect(repeating()).toEqual([]);
    });
  });
});
