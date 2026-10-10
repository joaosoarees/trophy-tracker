import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type IApi } from '@shared/types/Api';
import { type GameUserData } from '@shared/types/UserData';
import { makeAppStore } from '@tests/makeAppStore';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

/** How long the store waits after the last edit before writing it. */
const PAUSE = 500;

/** The store over a main process that has `saved` for every game and saves what it is given. */
async function setup(saved: GameUserData = {}) {
  const getUserDataMock = vi.fn<IApi['getUserData']>(() =>
    Promise.resolve(saved),
  );
  const setUserDataMock = vi.fn<IApi['setUserData']>(() => Promise.resolve());
  const made = await makeAppStore({
    api: { getUserData: getUserDataMock, setUserData: setUserDataMock },
  });
  return { ...made, getUserDataMock, setUserDataMock };
}

describe('userDataSlice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('load', () => {
    it('should show the notes of a game when the main process answers', async () => {
      const { sut } = await setup({
        A: { note: 'boss of the 3rd map', pinned: true },
      });

      await sut.getState().userData.load(10);

      expect(sut.getState().userData.byGame[10]).toEqual({
        A: { note: 'boss of the 3rd map', pinned: true },
      });
    });

    it('should ask for a game only once when it is loaded again', async () => {
      const { sut, getUserDataMock } = await setup();
      await sut.getState().userData.load(10);

      await sut.getState().userData.load(10);

      expect(getUserDataMock).toHaveBeenCalledExactlyOnceWith(10);
    });
  });

  describe('update', () => {
    it('should show an edit when it is not saved yet', async () => {
      const { sut } = await setup();

      sut.getState().userData.update(10, 'A', { note: 'bridge first' });

      expect(sut.getState().userData.byGame[10]).toEqual({
        A: { note: 'bridge first', pinned: false },
      });
    });

    it('should not save an edit when the typing pause has not passed', async () => {
      const { sut, setUserDataMock } = await setup();

      sut.getState().userData.update(10, 'A', { note: 'bridge first' });

      expect(setUserDataMock).not.toHaveBeenCalled();
    });

    it('should change only what the edit is about when the entry has more', async () => {
      const { sut } = await setup({
        A: { note: 'bridge first', pinned: false },
      });
      await sut.getState().userData.load(10);

      sut.getState().userData.update(10, 'A', { pinned: true });

      expect(sut.getState().userData.byGame[10]).toEqual({
        A: { note: 'bridge first', pinned: true },
      });
    });

    it('should save only the last version when the typing pause passes', async () => {
      const { sut, setUserDataMock } = await setup();
      sut.getState().userData.update(10, 'A', { note: 'b' });
      sut.getState().userData.update(10, 'A', { note: 'br' });
      sut.getState().userData.update(10, 'A', { note: 'bridge' });

      await vi.advanceTimersByTimeAsync(PAUSE);

      expect(setUserDataMock).toHaveBeenCalledExactlyOnceWith(10, 'A', {
        note: 'bridge',
        pinned: false,
      });
    });
  });

  describe('flush', () => {
    it('should save what is waiting when the typing pause has not passed', async () => {
      const { sut, setUserDataMock } = await setup();
      sut.getState().userData.update(10, 'A', { note: 'bridge' });

      sut.getState().userData.flush();

      expect(setUserDataMock).toHaveBeenCalledExactlyOnceWith(10, 'A', {
        note: 'bridge',
        pinned: false,
      });
    });
  });

  describe('when the save fails', () => {
    it('should put back what was saved before the edit when the save fails', async () => {
      const { sut, setUserDataMock } = await setup({
        A: { note: 'saved note', pinned: false },
      });
      setUserDataMock.mockRejectedValueOnce(new Error('disk full'));
      await sut.getState().userData.load(10);
      sut.getState().userData.update(10, 'A', { note: 'never saved' });

      await vi.advanceTimersByTimeAsync(PAUSE);

      expect(sut.getState().userData.byGame[10]).toEqual({
        A: { note: 'saved note', pinned: false },
      });
    });

    it('should tell the user when the save fails', async () => {
      const { sut, setUserDataMock, toastMock } = await setup({
        A: { note: 'saved note', pinned: false },
      });
      setUserDataMock.mockRejectedValueOnce(new Error('disk full'));
      await sut.getState().userData.load(10);
      sut.getState().userData.update(10, 'A', { note: 'never saved' });

      await vi.advanceTimersByTimeAsync(PAUSE);

      expect(toastMock.error).toHaveBeenCalledExactlyOnceWith(
        'Could not save your change, so it was undone.',
      );
    });

    it('should remove the entry when the edit that failed was its first', async () => {
      const { sut, setUserDataMock } = await setup();
      setUserDataMock.mockRejectedValueOnce(new Error('disk full'));
      await sut.getState().userData.load(10);
      sut.getState().userData.update(10, 'A', { note: 'never saved' });

      await vi.advanceTimersByTimeAsync(PAUSE);

      expect(sut.getState().userData.byGame[10]).toEqual({});
    });
  });
});
