import { describe, expect, it, vi } from 'vitest';

import {
  KEY,
  makeDiskStore,
  OTHER_KEY,
  OTHER_STEAM_ID,
  STEAM_ID,
  UNKNOWN_STEAM_ID,
} from '@tests/helpers';

import { AccountFollower } from './AccountFollower';

/**
 * The app with two accounts, following `STEAM_ID`, and a Steam client signed
 * in to `initiallySignedIn`. `signIn` changes who is signed in to the client.
 */
function setup(initiallySignedIn: string | null) {
  const store = makeDiskStore();
  for (const [steamId, apiKey] of [
    [OTHER_STEAM_ID, OTHER_KEY],
    [STEAM_ID, KEY],
  ]) {
    store.setCredentials(
      { steamId, apiKey },
      { steamId, name: '', avatar: '' },
    );
  }
  let signedIn = initiallySignedIn;
  const onFollowMock = vi.fn<(steamId: string) => void>();
  const sut = new AccountFollower({
    getSignedInSteamId: () => Promise.resolve(signedIn),
    store,
    onFollow: onFollowMock,
  });
  const signIn = (steamId: string | null): void => {
    signedIn = steamId;
  };
  return { sut, store, onFollowMock, signIn };
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
  });
});
