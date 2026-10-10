import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type IApi } from '@shared/types/Api';
import { type GameUserData, type IChecklistItem } from '@shared/types/UserData';
import { makeAppState } from '@tests/factories/makeAppState';
import { OTHER_STEAM_ID, STEAM_ID } from '@tests/helpers';
import { deferred, makeAppStore } from '@tests/makeAppStore';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), dismiss: vi.fn() }),
}));

/** The state of the app following the second account. */
const otherAccountState = () =>
  makeAppState({
    activeSteamId: OTHER_STEAM_ID,
    profile: { steamId: OTHER_STEAM_ID, name: 'other', avatar: '' },
  });

const bridge: IChecklistItem = { id: 'b', text: 'Bridge', done: false };
const cave: IChecklistItem = { id: 'c', text: 'Cave', done: false };
const tower: IChecklistItem = { id: 't', text: 'Tower', done: false };

/** What the main process has for a game: achievement A with this checklist. */
const savedList = (checklist: IChecklistItem[]): GameUserData => ({
  A: { note: '', pinned: false, checklist },
});

/** Where an item was removed from: achievement A of game 10, first account. */
const FROM = { steamId: STEAM_ID, appid: 10, achievementId: 'A' };

/** How long the store waits after the last edit before writing it. */
const PAUSE = 500;

/**
 * The store, with the first account in use, over a main process that has
 * `saved` for every game and saves what it is given.
 */
async function setup(saved: GameUserData = {}) {
  const getUserDataMock = vi.fn<IApi['getUserData']>(() =>
    Promise.resolve(saved),
  );
  const setUserDataMock = vi.fn<IApi['setUserData']>(() => Promise.resolve());
  const made = await makeAppStore({
    api: {
      getUserData: getUserDataMock,
      setUserData: setUserDataMock,
      // What the store asks as it is wired for an account.
      getCurrentAppId: () => Promise.resolve(null),
      getDashboard: () => Promise.resolve({ ok: true, value: [] }),
      onStateChanged: () => () => {},
      onGameChanged: () => () => {},
      onGameUpdated: () => () => {},
      onDashboardProgress: () => () => {},
    },
  });
  made.sut.getState().settings.apply(makeAppState());
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

    it('should not file the notes of the account that was left under the one in use when they arrive late', async () => {
      const answer = deferred<GameUserData>();
      const { sut } = await makeAppStore({
        api: { getUserData: () => answer.promise },
      });
      sut.getState().settings.apply(makeAppState());
      const loading = sut.getState().userData.load(10);
      sut
        .getState()
        .settings.apply(makeAppState({ activeSteamId: OTHER_STEAM_ID }));
      answer.resolve({ A: { note: 'boss of the 3rd map', pinned: true } });

      await loading;

      expect(sut.getState().userData.byGame).toEqual({});
    });

    it('should not take the notes asked for before the account was left and followed again when they arrive late', async () => {
      const answer = deferred<GameUserData>();
      const { sut, follow, getUserDataMock } = await setup();
      getUserDataMock.mockReturnValueOnce(answer.promise);
      follow(makeAppState());
      const loading = sut.getState().userData.load(10);
      follow(otherAccountState());
      follow(makeAppState());
      answer.resolve({ A: { note: 'boss of the 3rd map', pinned: true } });

      await loading;

      expect(sut.getState().userData.byGame).toEqual({});
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

      expect(setUserDataMock).toHaveBeenCalledExactlyOnceWith(
        10,
        'A',
        { note: 'bridge', pinned: false },
        STEAM_ID,
      );
    });

    it('should save an edit for the account it was made under when another is in use by the time it is written', async () => {
      const { sut, setUserDataMock } = await setup();
      sut.getState().userData.update(10, 'A', { note: 'bridge' });
      sut.getState().settings.apply(otherAccountState());

      await vi.advanceTimersByTimeAsync(PAUSE);

      expect(setUserDataMock).toHaveBeenCalledExactlyOnceWith(
        10,
        'A',
        { note: 'bridge', pinned: false },
        STEAM_ID,
      );
    });

    it('should take no edit when no account is in use', async () => {
      const { sut } = await makeAppStore();

      sut.getState().userData.update(10, 'A', { note: 'bridge' });

      expect(sut.getState().userData.byGame).toEqual({});
    });
  });

  describe('restoreChecklistItem', () => {
    it('should put both items back when two removals are undone, the older one last', async () => {
      const { sut } = await setup(savedList([tower]));
      await sut.getState().userData.load(10);
      sut.getState().userData.restoreChecklistItem(FROM, cave, 0);

      sut.getState().userData.restoreChecklistItem(FROM, bridge, 0);

      expect(sut.getState().userData.byGame[10]).toEqual(
        savedList([bridge, cave, tower]),
      );
    });

    it('should keep an item checked after the removal when the removed one is put back', async () => {
      const { sut } = await setup(savedList([cave, tower]));
      await sut.getState().userData.load(10);
      sut.getState().userData.update(10, 'A', {
        checklist: [{ ...cave, done: true }, tower],
      });

      sut.getState().userData.restoreChecklistItem(FROM, bridge, 0);

      expect(sut.getState().userData.byGame[10]).toEqual(
        savedList([bridge, { ...cave, done: true }, tower]),
      );
    });

    it('should save the list with the item back when the typing pause passes', async () => {
      const { sut, setUserDataMock } = await setup(savedList([tower]));
      await sut.getState().userData.load(10);
      sut.getState().userData.restoreChecklistItem(FROM, bridge, 0);

      await vi.advanceTimersByTimeAsync(PAUSE);

      expect(setUserDataMock).toHaveBeenCalledExactlyOnceWith(
        10,
        'A',
        { note: '', pinned: false, checklist: [bridge, tower] },
        STEAM_ID,
      );
    });

    it('should make it the only item when the achievement has nothing saved any more', async () => {
      const { sut } = await setup();
      await sut.getState().userData.load(10);

      sut.getState().userData.restoreChecklistItem(FROM, bridge, 0);

      expect(sut.getState().userData.byGame[10]).toEqual(savedList([bridge]));
    });

    it('should put the item back in the game it was removed from when another game was edited since', async () => {
      const { sut } = await setup(savedList([tower]));
      await sut.getState().userData.load(10);
      await sut.getState().userData.load(20);
      sut.getState().userData.update(20, 'A', { checklist: [cave] });

      sut.getState().userData.restoreChecklistItem(FROM, bridge, 0);

      expect(sut.getState().userData.byGame).toEqual({
        10: savedList([bridge, tower]),
        20: savedList([cave]),
      });
    });

    it('should leave the list of the account in use alone when the item was removed under the account that was left', async () => {
      const { sut, follow } = await setup(savedList([tower]));
      follow(otherAccountState());
      await sut.getState().userData.load(10);

      sut.getState().userData.restoreChecklistItem(FROM, bridge, 0);

      expect(sut.getState().userData.byGame[10]).toEqual(savedList([tower]));
    });

    it('should save nothing when the item was removed under the account that was left', async () => {
      const { sut, follow, setUserDataMock } = await setup(savedList([tower]));
      follow(otherAccountState());
      await sut.getState().userData.load(10);
      sut.getState().userData.restoreChecklistItem(FROM, bridge, 0);

      await vi.advanceTimersByTimeAsync(PAUSE);

      expect(setUserDataMock).not.toHaveBeenCalled();
    });

    it('should take nothing when the lists of the game were not read yet', async () => {
      const { sut } = await setup(savedList([tower]));

      sut.getState().userData.restoreChecklistItem(FROM, bridge, 0);

      expect(sut.getState().userData.byGame).toEqual({});
    });

    it('should save nothing when the item is already on the list', async () => {
      const { sut, setUserDataMock } = await setup(savedList([bridge, tower]));
      await sut.getState().userData.load(10);
      sut.getState().userData.restoreChecklistItem(FROM, bridge, 0);

      await vi.advanceTimersByTimeAsync(PAUSE);

      expect(setUserDataMock).not.toHaveBeenCalled();
    });
  });

  describe('offerChecklistUndo', () => {
    it('should name the removed item and offer to undo when an item was removed', async () => {
      const { sut, toastMock } = await setup(savedList([tower]));

      sut.getState().userData.offerChecklistUndo(FROM, bridge, 0);

      expect(toastMock).toHaveBeenCalledExactlyOnceWith('Removed “Bridge”', {
        action: { label: 'Undo', onClick: expect.any(Function) },
      });
    });

    it('should put the item back when the undo is clicked', async () => {
      const { sut, toastMock } = await setup(savedList([tower]));
      await sut.getState().userData.load(10);
      sut.getState().userData.offerChecklistUndo(FROM, bridge, 0);
      // The button of the toast, as sonner is given it.
      const undo = toastMock.mock.calls[0][1]?.action as unknown as {
        onClick: () => void;
      };

      undo.onClick();

      expect(sut.getState().userData.byGame[10]).toEqual(
        savedList([bridge, tower]),
      );
    });

    it('should take the offer off the screen when its account is left', async () => {
      const { sut, follow, toastMock } = await setup(savedList([tower]));
      follow(makeAppState());
      toastMock.mockReturnValueOnce('undo of bridge');
      sut.getState().userData.offerChecklistUndo(FROM, bridge, 0);

      follow(otherAccountState());

      expect(toastMock.dismiss).toHaveBeenCalledExactlyOnceWith(
        'undo of bridge',
      );
    });

    it('should take an offer off the screen only once when accounts change twice', async () => {
      const { sut, follow, toastMock } = await setup(savedList([tower]));
      follow(makeAppState());
      toastMock.mockReturnValueOnce('undo of bridge');
      sut.getState().userData.offerChecklistUndo(FROM, bridge, 0);
      follow(otherAccountState());

      follow(makeAppState());

      expect(toastMock.dismiss).toHaveBeenCalledExactlyOnceWith(
        'undo of bridge',
      );
    });
  });

  describe('flush', () => {
    it('should save what is waiting when the typing pause has not passed', async () => {
      const { sut, setUserDataMock } = await setup();
      sut.getState().userData.update(10, 'A', { note: 'bridge' });

      sut.getState().userData.flush();

      expect(setUserDataMock).toHaveBeenCalledExactlyOnceWith(
        10,
        'A',
        { note: 'bridge', pinned: false },
        STEAM_ID,
      );
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

    it('should leave the notes of the account in use alone when the save that fails is of the account that was left', async () => {
      const { sut, follow, getUserDataMock, setUserDataMock } = await setup();
      getUserDataMock
        .mockResolvedValueOnce({ A: { note: 'mine', pinned: false } })
        .mockResolvedValueOnce({ A: { note: 'theirs', pinned: false } });
      const saving = deferred<void>();
      setUserDataMock.mockReturnValueOnce(saving.promise);
      follow(makeAppState());
      await sut.getState().userData.load(10);
      sut.getState().userData.update(10, 'A', { note: 'never saved' });
      follow(otherAccountState());
      await sut.getState().userData.load(10);
      saving.reject(new Error('disk full'));

      await vi.advanceTimersByTimeAsync(0);

      expect(sut.getState().userData.byGame[10]).toEqual({
        A: { note: 'theirs', pinned: false },
      });
    });

    it('should read every note of the game again when the save that fails ends after its account was left and followed again', async () => {
      const saved = {
        A: { note: 'saved note', pinned: false },
        B: { note: 'the other boss', pinned: true },
      };
      const { sut, follow, setUserDataMock } = await setup(saved);
      const saving = deferred<void>();
      setUserDataMock.mockReturnValueOnce(saving.promise);
      follow(makeAppState());
      await sut.getState().userData.load(10);
      sut.getState().userData.update(10, 'A', { note: 'never saved' });
      follow(otherAccountState());
      follow(makeAppState());
      saving.reject(new Error('disk full'));
      await vi.advanceTimersByTimeAsync(0);

      await sut.getState().userData.load(10);

      expect(sut.getState().userData.byGame[10]).toEqual(saved);
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
