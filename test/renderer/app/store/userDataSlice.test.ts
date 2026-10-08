import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type IApi } from '@shared/types/Api';
import { type GameUserData } from '@shared/types/UserData';

import { makeStore } from './makeStore';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

/** How long the store waits after the last edit before writing it. */
const PAUSE = 500;

async function setup(saved: GameUserData = {}, api: Partial<IApi> = {}) {
  const setUserData = vi.fn(() => Promise.resolve());
  const getUserData = vi.fn(() => Promise.resolve(saved));
  const made = await makeStore({ api: { getUserData, setUserData, ...api } });
  return {
    ...made,
    getUserData,
    setUserData,
    userData: () => made.store.getState().userData,
    /** What the screen shows for game 10. */
    shown: () => made.store.getState().userData.byGame[10],
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('user data: reading', () => {
  it('reads the notes of a game from the main process', async () => {
    const { userData, shown } = await setup({
      A: { note: 'boss of the 3rd map', pinned: true },
    });

    await userData().load(10);

    expect(shown()).toEqual({
      A: { note: 'boss of the 3rd map', pinned: true },
    });
  });

  it('reads each game only once', async () => {
    const { userData, getUserData } = await setup();

    await userData().load(10);
    await userData().load(10);

    expect(getUserData).toHaveBeenCalledTimes(1);
  });
});

describe('user data: editing', () => {
  it('shows an edit at once, before it is saved', async () => {
    const { userData, shown, setUserData } = await setup();

    userData().update(10, 'A', { note: 'bridge first' });

    expect(shown()).toEqual({ A: { note: 'bridge first', pinned: false } });
    expect(setUserData).not.toHaveBeenCalled();
  });

  it('changes only what the edit is about', async () => {
    const { userData, shown } = await setup({
      A: { note: 'bridge first', pinned: false },
    });
    await userData().load(10);

    userData().update(10, 'A', { pinned: true });

    expect(shown().A).toEqual({ note: 'bridge first', pinned: true });
  });

  it('saves after the typing pause, only the last version', async () => {
    const { userData, setUserData } = await setup();
    userData().update(10, 'A', { note: 'b' });
    userData().update(10, 'A', { note: 'br' });
    userData().update(10, 'A', { note: 'bridge' });

    await vi.advanceTimersByTimeAsync(PAUSE);

    expect(setUserData).toHaveBeenCalledTimes(1);
    expect(setUserData).toHaveBeenCalledWith(10, 'A', {
      note: 'bridge',
      pinned: false,
    });
  });

  it('writes right away what is waiting when asked to flush', async () => {
    const { userData, setUserData } = await setup();
    userData().update(10, 'A', { note: 'bridge' });

    userData().flush();

    expect(setUserData).toHaveBeenCalledTimes(1);
  });
});

describe('user data: when the save fails', () => {
  const failing = { setUserData: () => Promise.reject(new Error('disk full')) };

  it('puts back what was saved before the edit and tells the user', async () => {
    const { userData, shown, toast } = await setup(
      { A: { note: 'saved note', pinned: false } },
      failing,
    );
    await userData().load(10);
    userData().update(10, 'A', { note: 'never saved' });

    await vi.advanceTimersByTimeAsync(PAUSE);

    expect(shown().A).toEqual({ note: 'saved note', pinned: false });
    expect(toast.error).toHaveBeenCalledWith(
      'Could not save your change, so it was undone.',
    );
  });

  it('removes an entry that had never been saved', async () => {
    const { userData, shown } = await setup({}, failing);
    await userData().load(10);
    userData().update(10, 'A', { note: 'never saved' });

    await vi.advanceTimersByTimeAsync(PAUSE);

    expect(shown()).toEqual({});
  });
});
