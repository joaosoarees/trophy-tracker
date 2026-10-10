import { afterEach, describe, expect, it, vi } from 'vitest';

import { makeAppStore } from '@tests/makeAppStore';

/** The store as the window opens, with `session` left by the page before a reload. */
function setup(session: Record<string, string> = {}) {
  return makeAppStore({ session });
}

describe('navigationSlice', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('the hidden-only filter', () => {
    it('should stay on when the user shows another list of the same game', async () => {
      const { sut } = await setup();
      sut.getState().navigation.toggleHiddenOnly();

      sut.getState().navigation.showAchievements('unlocked');

      expect(sut.getState().navigation.isHiddenOnly).toBe(true);
    });

    it('should stay on when the user goes to another tab', async () => {
      const { sut } = await setup();
      sut.getState().navigation.toggleHiddenOnly();

      sut.getState().navigation.goTo('dashboard');

      expect(sut.getState().navigation.isHiddenOnly).toBe(true);
    });

    it('should be turned off when the user picks another game', async () => {
      const { sut } = await setup();
      sut.getState().navigation.toggleHiddenOnly();

      sut.getState().navigation.pickGame(105600);

      expect(sut.getState().navigation.isHiddenOnly).toBe(false);
    });

    it('should be remembered as off for a reload when the user picks another game', async () => {
      const { sut, storage } = await setup();
      sut.getState().navigation.toggleHiddenOnly();

      sut.getState().navigation.pickGame(105600);

      expect(storage.get('view-hidden-only')).toBe('false');
    });

    it('should be turned off when the app follows a game opened on Steam', async () => {
      const { sut } = await setup();
      sut.getState().navigation.toggleHiddenOnly();

      sut.getState().navigation.followRunningGame(2638890);

      expect(sut.getState().navigation.isHiddenOnly).toBe(false);
    });

    it('should stay on when the running game closes', async () => {
      const { sut } = await setup();
      sut.getState().navigation.followRunningGame(2638890);
      sut.getState().navigation.toggleHiddenOnly();

      sut.getState().navigation.followRunningGame(null);

      expect(sut.getState().navigation.isHiddenOnly).toBe(true);
    });

    it('should be on when the window reloads with it on', async () => {
      const { sut } = await setup({ 'view-hidden-only': 'true' });

      const { isHiddenOnly } = sut.getState().navigation;

      expect(isHiddenOnly).toBe(true);
    });
  });

  describe('the game details', () => {
    it('should be closed when the app opens', async () => {
      const { sut } = await setup();

      const { isGameDetailsOpen } = sut.getState().navigation;

      expect(isGameDetailsOpen).toBe(false);
    });

    it('should stay open when the user picks another game', async () => {
      const { sut } = await setup();
      sut.getState().navigation.toggleGameDetails();

      sut.getState().navigation.pickGame(105600);

      expect(sut.getState().navigation.isGameDetailsOpen).toBe(true);
    });

    it('should be open when the window reloads with them open', async () => {
      const { sut } = await setup({ 'view-game-details': 'true' });

      const { isGameDetailsOpen } = sut.getState().navigation;

      expect(isGameDetailsOpen).toBe(true);
    });
  });
});
