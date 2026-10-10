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

  describe('the tab', () => {
    it('should be the game when the app opens', async () => {
      const { sut } = await setup();

      const { tab } = sut.getState().navigation;

      expect(tab).toBe('game');
    });

    it('should be the one the user was on when the window reloads', async () => {
      const { sut } = await setup({ 'view-tab': '"dashboard"' });

      const { tab } = sut.getState().navigation;

      expect(tab).toBe('dashboard');
    });

    it('should be remembered for a reload when the user goes to another one', async () => {
      const { sut, storage } = await setup();

      sut.getState().navigation.goTo('settings');

      expect(storage.get('view-tab')).toBe('"settings"');
    });

    it('should be the game when what was kept for a reload cannot be read', async () => {
      const { sut } = await setup({ 'view-tab': '"dashbo' });

      const { tab } = sut.getState().navigation;

      expect(tab).toBe('game');
    });
  });

  describe('the list of achievements shown', () => {
    it('should be the pending ones when the app opens', async () => {
      const { sut } = await setup();

      const { achievementFilter } = sut.getState().navigation;

      expect(achievementFilter).toBe('pending');
    });

    it('should be the unlocked ones when the user asks for them', async () => {
      const { sut } = await setup();

      sut.getState().navigation.showAchievements('unlocked');

      expect(sut.getState().navigation.achievementFilter).toBe('unlocked');
    });

    it('should be remembered for a reload when the user asks for another one', async () => {
      const { sut, storage } = await setup();

      sut.getState().navigation.showAchievements('unlocked');

      expect(storage.get('view-achievement-filter')).toBe('"unlocked"');
    });

    it('should be the one the user was on when the window reloads', async () => {
      const { sut } = await setup({ 'view-achievement-filter': '"unlocked"' });

      const { achievementFilter } = sut.getState().navigation;

      expect(achievementFilter).toBe('unlocked');
    });

    it('should be the pending ones when what was kept for a reload names no list', async () => {
      const { sut } = await setup({ 'view-achievement-filter': '"hidden"' });

      const { achievementFilter } = sut.getState().navigation;

      expect(achievementFilter).toBe('pending');
    });
  });

  describe('the list of games shown', () => {
    it('should be the games in progress when the app opens', async () => {
      const { sut } = await setup();

      const { dashboardFilter } = sut.getState().navigation;

      expect(dashboardFilter).toBe('ongoing');
    });

    it('should be the complete games when the user asks for them', async () => {
      const { sut } = await setup();

      sut.getState().navigation.showGames('complete');

      expect(sut.getState().navigation.dashboardFilter).toBe('complete');
    });

    it('should be remembered for a reload when the user asks for another one', async () => {
      const { sut, storage } = await setup();

      sut.getState().navigation.showGames('complete');

      expect(storage.get('view-dashboard-filter')).toBe('"complete"');
    });

    it('should be the one the user was on when the window reloads', async () => {
      const { sut } = await setup({ 'view-dashboard-filter': '"complete"' });

      const { dashboardFilter } = sut.getState().navigation;

      expect(dashboardFilter).toBe('complete');
    });

    it('should be the games in progress when what was kept for a reload names no list', async () => {
      const { sut } = await setup({ 'view-dashboard-filter': '"all"' });

      const { dashboardFilter } = sut.getState().navigation;

      expect(dashboardFilter).toBe('ongoing');
    });
  });

  describe('the game picked in the dashboard', () => {
    it('should be shown on the game tab when the user picks it', async () => {
      const { sut } = await setup();
      sut.getState().navigation.goTo('dashboard');

      sut.getState().navigation.pickGame(105600);

      expect(sut.getState().navigation).toMatchObject({
        pickedAppId: 105600,
        tab: 'game',
      });
    });

    it('should be remembered for a reload, with the tab it is shown on, when the user picks it', async () => {
      const { sut, storage } = await setup();
      sut.getState().navigation.goTo('dashboard');

      sut.getState().navigation.pickGame(105600);

      expect(storage.get('view-picked')).toBe('105600');
      expect(storage.get('view-tab')).toBe('"game"');
    });

    it('should be the one the user had picked when the window reloads', async () => {
      const { sut } = await setup({ 'view-picked': '105600' });

      const { pickedAppId } = sut.getState().navigation;

      expect(pickedAppId).toBe(105600);
    });

    it('should no longer be remembered for a reload when the app follows a game opened on Steam', async () => {
      const { sut, storage } = await setup();
      sut.getState().navigation.pickGame(105600);

      sut.getState().navigation.followRunningGame(2638890);

      expect(storage.get('view-picked')).toBe('null');
    });

    it('should stay picked when the running game closes', async () => {
      const { sut } = await setup();
      sut.getState().navigation.followRunningGame(2638890);
      sut.getState().navigation.pickGame(105600);

      sut.getState().navigation.followRunningGame(null);

      expect(sut.getState().navigation.pickedAppId).toBe(105600);
    });

    it('should be forgotten, with the running game the app had followed, when its account is left', async () => {
      const { sut } = await setup();
      sut.getState().navigation.followRunningGame(2638890);
      sut.getState().navigation.pickGame(105600);

      sut.getState().navigation.forgetPickedGame();

      expect(sut.getState().navigation).toMatchObject({
        pickedAppId: null,
        seenRunningAppId: null,
      });
    });

    it('should no longer be remembered for a reload, nor the running game the app had followed, when its account is left', async () => {
      const { sut, storage } = await setup();
      sut.getState().navigation.followRunningGame(2638890);
      sut.getState().navigation.pickGame(105600);

      sut.getState().navigation.forgetPickedGame();

      expect(storage.get('view-picked')).toBe('null');
      expect(storage.get('view-seen-running')).toBe('null');
    });
  });

  describe('the running game the app followed', () => {
    it('should be remembered for a reload when the app follows it, so it does not jump to it again', async () => {
      const { sut, storage } = await setup();

      sut.getState().navigation.followRunningGame(2638890);

      expect(storage.get('view-seen-running')).toBe('2638890');
    });

    it('should bring the app to the game tab again when the account it was followed for was left', async () => {
      const { sut } = await setup();
      sut.getState().navigation.followRunningGame(2638890);
      sut.getState().navigation.forgetPickedGame();
      sut.getState().navigation.goTo('dashboard');

      sut.getState().navigation.followRunningGame(2638890);

      expect(sut.getState().navigation.tab).toBe('game');
    });
  });

  describe('adding an account', () => {
    it('should not be going on when the app opens', async () => {
      const { sut } = await setup();

      const { isAddingAccount } = sut.getState().navigation;

      expect(isAddingAccount).toBe(false);
    });

    it('should be going on when the user asks to add one', async () => {
      const { sut } = await setup();

      sut.getState().navigation.startAddingAccount();

      expect(sut.getState().navigation.isAddingAccount).toBe(true);
    });

    it('should be over when the user leaves it', async () => {
      const { sut } = await setup();
      sut.getState().navigation.startAddingAccount();

      sut.getState().navigation.stopAddingAccount();

      expect(sut.getState().navigation.isAddingAccount).toBe(false);
    });
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
