import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { AccountFollower } from '@main/services/AccountFollower';
import { Store } from '@main/storage/Store';
import { KEY, OTHER_KEY, OTHER_STEAM_ID, STEAM_ID } from '@test/helpers';

/** The app with two accounts, following the first, and a Steam client signed in to `signedIn`. */
function setup(initiallySignedIn: string | null) {
  const store = new Store(mkdtempSync(join(tmpdir(), 'stt-')));
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
  const onFollow = vi.fn();
  const follower = new AccountFollower({
    getSignedInSteamId: () => Promise.resolve(signedIn),
    store,
    onFollow,
  });
  return {
    store,
    follow: () => follower.onClientChange(),
    whenAGameStarts: () => follower.forRunningGame(),
    onFollow,
    signIn: (id: string | null) => (signedIn = id),
  };
}

describe('AccountFollower', () => {
  it('follows the account signed in to Steam as the app opens', async () => {
    const { store, follow, onFollow } = setup(OTHER_STEAM_ID);

    await follow();

    expect(store.getActiveSteamId()).toBe(OTHER_STEAM_ID);
    expect(onFollow).toHaveBeenCalledWith(OTHER_STEAM_ID);
  });

  it('does nothing when Steam is on the account already in use', async () => {
    const { follow, onFollow } = setup(STEAM_ID);

    await follow();

    expect(onFollow).not.toHaveBeenCalled();
  });

  it('leaves alone an account the user picked by hand', async () => {
    const { store, follow } = setup(STEAM_ID);
    await follow();
    store.setActiveAccount(OTHER_STEAM_ID);

    await follow();

    expect(store.getActiveSteamId()).toBe(OTHER_STEAM_ID);
  });

  it('follows when another account signs in to Steam', async () => {
    const { store, follow, signIn } = setup(STEAM_ID);
    await follow();

    signIn(OTHER_STEAM_ID);
    await follow();

    expect(store.getActiveSteamId()).toBe(OTHER_STEAM_ID);
  });

  it('ignores an account the app has no key for', async () => {
    const { store, follow, onFollow } = setup('76561198000000099');

    await follow();

    expect(store.getActiveSteamId()).toBe(STEAM_ID);
    expect(onFollow).not.toHaveBeenCalled();
  });

  it('stays where it is when nobody is signed in to Steam', async () => {
    const { store, follow } = setup(null);

    await follow();

    expect(store.getActiveSteamId()).toBe(STEAM_ID);
  });

  it('follows the account playing a game, even over one picked by hand', async () => {
    const { store, follow, whenAGameStarts, onFollow } = setup(STEAM_ID);
    await follow();
    store.setActiveAccount(OTHER_STEAM_ID);

    const result = await whenAGameStarts();

    expect(result).toBe('followed');
    expect(store.getActiveSteamId()).toBe(STEAM_ID);
    expect(onFollow).toHaveBeenCalledWith(STEAM_ID);
  });

  it('announces nothing when the game is on the account already in use', async () => {
    const { whenAGameStarts, onFollow } = setup(STEAM_ID);

    expect(await whenAGameStarts()).toBe('followed');
    expect(onFollow).not.toHaveBeenCalled();
  });

  it('says a game is on another account when the app does not have it', async () => {
    const { store, whenAGameStarts } = setup('76561198000000099');

    expect(await whenAGameStarts()).toBe('other');
    expect(store.getActiveSteamId()).toBe(STEAM_ID);
  });

  it('takes the game to be the account in use when nobody can be told to be signed in', async () => {
    const { whenAGameStarts } = setup(null);

    expect(await whenAGameStarts()).toBe('followed');
  });

  it('does not switch again for the account it has just followed for a game', async () => {
    const { store, follow, whenAGameStarts, signIn } = setup(STEAM_ID);
    await follow();
    signIn(OTHER_STEAM_ID);
    await whenAGameStarts();
    store.setActiveAccount(STEAM_ID);

    await follow();

    expect(store.getActiveSteamId()).toBe(STEAM_ID);
  });
});
