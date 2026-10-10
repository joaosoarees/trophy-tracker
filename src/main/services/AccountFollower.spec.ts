import { describe, expect, it, vi } from 'vitest';

import { OTHER_STEAM_ID, STEAM_ID, UNKNOWN_STEAM_ID } from '@tests/helpers';

import { AccountFollower } from './AccountFollower';

/**
 * The part of the store the follower uses, in memory: the saved accounts and
 * the one in use. As in the real one, only a saved account can be put in use.
 */
function fakeAccountStore(saved: string[], initiallyInUse: string) {
  let inUse = initiallyInUse;
  return {
    getActiveSteamId: (): string | null => inUse,
    setActiveAccount: (steamId: string): boolean => {
      if (!saved.includes(steamId)) return false;
      inUse = steamId;
      return true;
    },
  };
}

/**
 * The app with two accounts, following `STEAM_ID`, and a Steam client signed
 * in to `initiallySignedIn`. `signIn` changes who is signed in to the client;
 * `failReads` makes the client's account impossible to read from then on,
 * until someone is signed in again.
 */
function setup(initiallySignedIn: string | null) {
  const store = fakeAccountStore([OTHER_STEAM_ID, STEAM_ID], STEAM_ID);
  let signedIn = initiallySignedIn;
  let isReadable = true;
  const onFollowMock = vi.fn<(steamId: string) => void>();
  const sut = new AccountFollower({
    getSignedInSteamId: () =>
      isReadable
        ? Promise.resolve(signedIn)
        : Promise.reject(new Error('reg.exe timed out')),
    store,
    onFollow: onFollowMock,
  });
  const signIn = (steamId: string | null): void => {
    signedIn = steamId;
    isReadable = true;
  };
  const failReads = (): void => {
    isReadable = false;
  };
  return { sut, store, onFollowMock, signIn, failReads };
}

describe('AccountFollower', () => {
  describe('onClientChange', () => {
    it('should follow the account signed in to Steam when the app opens', async () => {
      const { sut, store, onFollowMock } = setup(OTHER_STEAM_ID);

      const hasSwitched = await sut.onClientChange();

      expect(hasSwitched).toBe(true);
      expect(store.getActiveSteamId()).toBe(OTHER_STEAM_ID);
      expect(onFollowMock).toHaveBeenCalledExactlyOnceWith(OTHER_STEAM_ID);
    });

    it('should not switch when Steam is on the account already in use', async () => {
      const { sut, onFollowMock } = setup(STEAM_ID);

      const hasSwitched = await sut.onClientChange();

      expect(hasSwitched).toBe(false);
      expect(onFollowMock).not.toHaveBeenCalled();
    });

    it('should keep an account picked by hand when the Steam account is unchanged', async () => {
      const { sut, store } = setup(STEAM_ID);
      await sut.onClientChange();
      store.setActiveAccount(OTHER_STEAM_ID);

      const hasSwitched = await sut.onClientChange();

      expect(hasSwitched).toBe(false);
      expect(store.getActiveSteamId()).toBe(OTHER_STEAM_ID);
    });

    it('should follow when another account signs in to Steam', async () => {
      const { sut, store, signIn } = setup(STEAM_ID);
      await sut.onClientChange();
      signIn(OTHER_STEAM_ID);

      const hasSwitched = await sut.onClientChange();

      expect(hasSwitched).toBe(true);
      expect(store.getActiveSteamId()).toBe(OTHER_STEAM_ID);
    });

    it('should not switch when the app has no key for the Steam account', async () => {
      const { sut, store, onFollowMock } = setup(UNKNOWN_STEAM_ID);

      const hasSwitched = await sut.onClientChange();

      expect(hasSwitched).toBe(false);
      expect(store.getActiveSteamId()).toBe(STEAM_ID);
      expect(onFollowMock).not.toHaveBeenCalled();
    });

    it('should not switch when nobody is signed in to Steam', async () => {
      const { sut, store } = setup(null);

      const hasSwitched = await sut.onClientChange();

      expect(hasSwitched).toBe(false);
      expect(store.getActiveSteamId()).toBe(STEAM_ID);
    });

    it('should follow the Steam account again when it signs out and back in after a pick by hand', async () => {
      const { sut, store, signIn } = setup(STEAM_ID);
      await sut.onClientChange();
      store.setActiveAccount(OTHER_STEAM_ID);
      signIn(null);
      await sut.onClientChange();
      signIn(STEAM_ID);

      const hasSwitched = await sut.onClientChange();

      expect(hasSwitched).toBe(true);
      expect(store.getActiveSteamId()).toBe(STEAM_ID);
    });

    it('should keep an account picked by hand when a read of the Steam account failed in between', async () => {
      const { sut, store, signIn, failReads } = setup(STEAM_ID);
      await sut.onClientChange();
      store.setActiveAccount(OTHER_STEAM_ID);
      failReads();
      await sut.onClientChange();
      signIn(STEAM_ID);

      const hasSwitched = await sut.onClientChange();

      expect(hasSwitched).toBe(false);
      expect(store.getActiveSteamId()).toBe(OTHER_STEAM_ID);
    });

    it('should not switch when the Steam account cannot be read', async () => {
      const { sut, store, onFollowMock, failReads } = setup(OTHER_STEAM_ID);
      failReads();

      const hasSwitched = await sut.onClientChange();

      expect(hasSwitched).toBe(false);
      expect(store.getActiveSteamId()).toBe(STEAM_ID);
      expect(onFollowMock).not.toHaveBeenCalled();
    });

    it('should not switch again to the account it has just followed for a game', async () => {
      const { sut, store, signIn } = setup(STEAM_ID);
      await sut.onClientChange();
      signIn(OTHER_STEAM_ID);
      await sut.forRunningGame();
      store.setActiveAccount(STEAM_ID);

      const hasSwitched = await sut.onClientChange();

      expect(hasSwitched).toBe(false);
      expect(store.getActiveSteamId()).toBe(STEAM_ID);
    });
  });

  describe('forRunningGame', () => {
    it('should follow the account playing the game when another was picked by hand', async () => {
      const { sut, store, onFollowMock } = setup(STEAM_ID);
      await sut.onClientChange();
      store.setActiveAccount(OTHER_STEAM_ID);

      const result = await sut.forRunningGame();

      expect(result).toBe('followed');
      expect(store.getActiveSteamId()).toBe(STEAM_ID);
      expect(onFollowMock).toHaveBeenCalledExactlyOnceWith(STEAM_ID);
    });

    it('should announce nothing when the game is on the account already in use', async () => {
      const { sut, onFollowMock } = setup(STEAM_ID);

      const result = await sut.forRunningGame();

      expect(result).toBe('followed');
      expect(onFollowMock).not.toHaveBeenCalled();
    });

    it("should answer 'other' when the game is on an account the app does not have", async () => {
      const { sut, store } = setup(UNKNOWN_STEAM_ID);

      const result = await sut.forRunningGame();

      expect(result).toBe('other');
      expect(store.getActiveSteamId()).toBe(STEAM_ID);
    });

    it("should answer 'followed' when nobody is signed in to Steam", async () => {
      const { sut } = setup(null);

      const result = await sut.forRunningGame();

      expect(result).toBe('followed');
    });

    it("should answer 'followed' and stay on the account in use when the Steam account cannot be read", async () => {
      const { sut, store, failReads } = setup(OTHER_STEAM_ID);
      failReads();

      const result = await sut.forRunningGame();

      expect(result).toBe('followed');
      expect(store.getActiveSteamId()).toBe(STEAM_ID);
    });
  });
});
