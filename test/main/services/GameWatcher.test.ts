import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GameWatcher, type IGameWatcherDeps } from '@main/services/GameWatcher';
import { en } from '@shared/i18n/locales/en';
import { type CheckResult } from '@shared/types/Check';
import { type IGameView } from '@shared/types/Game';
import { makeAchievement } from '@test/factories/makeAchievement';
import { makeGameView } from '@test/factories/makeGameView';

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

function setup(over: Partial<IGameWatcherDeps> = {}) {
  let running: number | null = null;
  let polled: CheckResult<IGameView> = { ok: false, error: 'no poll set' };
  const deps = {
    getRunningAppId: vi.fn(() => Promise.resolve(running)),
    lastPlayedAppId: vi.fn(() => Promise.resolve<number | null>(7)),
    pollGame: vi.fn(() => Promise.resolve(polled)),
    isConfigured: vi.fn(() => true),
    messages: () => en,
    notify: vi.fn(),
    onCurrentChanged: vi.fn(),
    onGameUpdated: vi.fn(),
    ...over,
  } satisfies IGameWatcherDeps;

  return {
    watcher: new GameWatcher(deps),
    deps,
    run: (appid: number | null) => (running = appid),
    poll: (next: IGameView) => (polled = { ok: true, value: next }),
  };
}

describe('GameWatcher', () => {
  it('shows the last played game when none is running', async () => {
    const { watcher } = setup();

    expect(await watcher.resolveCurrent()).toEqual({
      appid: 7,
      running: false,
    });
  });

  it('shows the running game over the last played one', async () => {
    const { watcher, run } = setup();
    run(42);

    expect(await watcher.resolveCurrent()).toEqual({
      appid: 42,
      running: true,
    });
  });

  it('shows no game, and asks Steam nothing, before the app is set up', async () => {
    const { watcher, deps } = setup({ isConfigured: () => false });

    expect(await watcher.resolveCurrent()).toBeNull();
    expect(deps.lastPlayedAppId).not.toHaveBeenCalled();
  });

  it('announces the current game only when it changes', async () => {
    const { watcher, deps, run } = setup();
    await watcher.checkRunningGame();
    await watcher.checkRunningGame();
    expect(deps.onCurrentChanged).toHaveBeenCalledTimes(1);

    run(42);
    await watcher.checkRunningGame();
    expect(deps.onCurrentChanged).toHaveBeenLastCalledWith({
      appid: 42,
      running: true,
    });
    expect(deps.onCurrentChanged).toHaveBeenCalledTimes(2);
  });

  it('notifies each achievement unlocked since the view the interface has', async () => {
    const { watcher, deps, run, poll } = setup();
    run(42);
    await watcher.refreshCurrent();
    watcher.remember(view(42, ['a']));

    const next = view(42, ['a', 'b']);
    poll(next);
    await watcher.checkUnlocks();

    expect(deps.notify).toHaveBeenCalledExactlyOnceWith(
      'Achievement unlocked — Game',
      'Achievement b · 1 left',
    );
    expect(deps.onGameUpdated).toHaveBeenCalledExactlyOnceWith(next);
  });

  it('stays quiet when the poll returns the same view', async () => {
    const { watcher, deps, run, poll } = setup();
    run(42);
    await watcher.refreshCurrent();
    const seen = view(42, ['a']);
    watcher.remember(seen);
    poll(seen);

    await watcher.checkUnlocks();

    expect(deps.notify).not.toHaveBeenCalled();
    expect(deps.onGameUpdated).not.toHaveBeenCalled();
  });

  it('does not poll without a running game', async () => {
    const { watcher, deps } = setup();
    await watcher.refreshCurrent();

    await watcher.checkUnlocks();

    expect(deps.pollGame).not.toHaveBeenCalled();
  });

  it('stops polling once the setup is gone', async () => {
    let configured = true;
    const { watcher, deps, run } = setup({ isConfigured: () => configured });
    run(42);
    await watcher.refreshCurrent();

    configured = false;
    await watcher.checkUnlocks();

    expect(deps.pollGame).not.toHaveBeenCalled();
  });

  it('reads one last time when the game closes, before announcing the change', async () => {
    const events: unknown[] = [];
    const { watcher, deps, run, poll } = setup({
      onGameUpdated: (updated) =>
        events.push(['updated', updated.unlockedCount]),
      onCurrentChanged: (current) => events.push(['changed', current]),
    });
    run(42);
    await watcher.refreshCurrent();
    watcher.remember(view(42, ['a']));

    poll(view(42, ['a', 'b', 'c']));
    run(null);
    await watcher.checkRunningGame();

    expect(deps.notify).toHaveBeenCalledTimes(2);
    expect(deps.notify).toHaveBeenLastCalledWith(
      'Achievement unlocked — Game',
      'Achievement c · all achievements unlocked!',
    );
    expect(events).toEqual([
      ['updated', 3],
      ['changed', { appid: 7, running: false }],
    ]);
  });

  it('shows no game when the last played one cannot be read', async () => {
    const { watcher } = setup({
      lastPlayedAppId: () => Promise.reject(new Error('offline')),
    });

    expect(await watcher.resolveCurrent()).toBeNull();
  });

  it('announces nothing as unlocked after forgetting what the interface had seen', async () => {
    const { watcher, deps, run, poll } = setup();
    run(42);
    await watcher.refreshCurrent();
    watcher.remember(view(42, ['a']));

    watcher.forget();
    poll(view(42, ['a', 'b']));
    await watcher.checkUnlocks();

    expect(deps.notify).not.toHaveBeenCalled();
  });

  it('announces the current game again after forgetting it too', async () => {
    const { watcher, deps, run } = setup();
    run(42);
    await watcher.checkRunningGame();

    watcher.forget({ current: true });
    await watcher.checkRunningGame();

    expect(deps.onCurrentChanged).toHaveBeenCalledTimes(2);
  });

  it('ignores a view of a game that is not the current one', async () => {
    const { watcher, deps, run, poll } = setup();
    run(42);
    await watcher.refreshCurrent();

    watcher.remember(view(7, ['a']));
    poll(view(42, ['a', 'b']));
    await watcher.checkUnlocks();

    // With nothing to compare against, the first poll announces no unlock.
    expect(deps.notify).not.toHaveBeenCalled();
  });

  it('does not announce an update when the poll fails', async () => {
    const { watcher, deps, run } = setup();
    run(42);
    await watcher.refreshCurrent();

    await watcher.checkUnlocks();

    expect(deps.onGameUpdated).not.toHaveBeenCalled();
  });
});

describe('GameWatcher: the periodic checks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('looks for the running game every ten seconds', async () => {
    const { watcher, deps } = setup();
    watcher.start();

    await vi.advanceTimersByTimeAsync(30_000);

    expect(deps.getRunningAppId).toHaveBeenCalledTimes(3);
  });

  it('notices a game that was opened, without being asked', async () => {
    const { watcher, deps, run } = setup();
    watcher.start();

    run(42);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(deps.onCurrentChanged).toHaveBeenLastCalledWith({
      appid: 42,
      running: true,
    });
  });

  it('reads the running game again every minute', async () => {
    const { watcher, deps, run } = setup();
    run(42);
    await watcher.refreshCurrent();
    watcher.start();

    await vi.advanceTimersByTimeAsync(120_000);

    expect(deps.pollGame).toHaveBeenCalledTimes(2);
  });
});
