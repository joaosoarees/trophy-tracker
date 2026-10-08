import { describe, expect, it, vi } from 'vitest';

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
  it('uses the running game, then the last played one, then nothing', async () => {
    const { watcher, run } = setup();
    expect(await watcher.resolveCurrent()).toEqual({
      appid: 7,
      running: false,
    });
    run(42);
    expect(await watcher.resolveCurrent()).toEqual({
      appid: 42,
      running: true,
    });

    const unconfigured = setup({ isConfigured: () => false });
    expect(await unconfigured.watcher.resolveCurrent()).toBeNull();
    expect(unconfigured.deps.lastPlayedAppId).not.toHaveBeenCalled();
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

  it('does not poll without a running game or when the setup is gone', async () => {
    const idle = setup();
    await idle.watcher.refreshCurrent();
    await idle.watcher.checkUnlocks();
    expect(idle.deps.pollGame).not.toHaveBeenCalled();

    let configured = true;
    const erased = setup({ isConfigured: () => configured });
    erased.run(42);
    await erased.watcher.refreshCurrent();
    configured = false;
    await erased.watcher.checkUnlocks();
    expect(erased.deps.pollGame).not.toHaveBeenCalled();
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
});
