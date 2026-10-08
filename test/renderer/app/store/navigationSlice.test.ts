import { afterEach, describe, expect, it, vi } from 'vitest';

import { makeStore } from './makeStore';

async function setup(session: Record<string, string> = {}) {
  const made = await makeStore({ session });
  return { ...made, navigation: () => made.store.getState().navigation };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('navigation: the hidden-only filter', () => {
  it('stays on while the user moves around the same game', async () => {
    const { navigation } = await setup();
    navigation().toggleHiddenOnly();

    navigation().showAchievements('unlocked');
    navigation().goTo('dashboard');

    expect(navigation().hiddenOnly).toBe(true);
  });

  it('is turned off when the user picks another game', async () => {
    const { navigation, storage } = await setup();
    navigation().toggleHiddenOnly();

    navigation().pickGame(105600);

    expect(navigation().hiddenOnly).toBe(false);
    expect(storage.get('view-hidden-only')).toBe('false');
  });

  it('is turned off when the app follows a game opened on Steam', async () => {
    const { navigation } = await setup();
    navigation().toggleHiddenOnly();

    navigation().followRunningGame(2638890);

    expect(navigation().hiddenOnly).toBe(false);
  });

  it('is kept when the running game closes, since the game on screen stays', async () => {
    const { navigation } = await setup();
    navigation().followRunningGame(2638890);
    navigation().toggleHiddenOnly();

    navigation().followRunningGame(null);

    expect(navigation().hiddenOnly).toBe(true);
  });

  it('survives a window reload', async () => {
    const { navigation } = await setup({ 'view-hidden-only': 'true' });

    expect(navigation().hiddenOnly).toBe(true);
  });
});
