import { afterEach, describe, expect, it, vi } from 'vitest';

import { type IApi } from '@shared/types/Api';
import { type IAppState } from '@shared/types/AppState';
import { type IPreferences } from '@shared/types/Preferences';
import { makeAppState } from '@tests/factories/makeAppState';
import { OTHER_STEAM_ID, STEAM_ID } from '@tests/helpers';
import { deferred, makeAppStore } from '@tests/makeAppStore';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

const NOT_SAVED = 'Could not save your change, so it was undone.';

/** The store over a main process that answers only the calls in `api`. */
function setup(api: Partial<IApi> = {}) {
  return makeAppStore({ api });
}

/** Everything `load` asks the main process, with answers that are not the defaults. */
function loadableApi(): Partial<IApi> {
  return {
    getState: () => Promise.resolve(makeAppState()),
    getAlwaysOnTop: () => Promise.resolve(true),
    getPreferences: () => Promise.resolve({ rememberWindow: false }),
    getFolder: (id) =>
      Promise.resolve({ path: `/home/me/${id}`, canOpen: true }),
  };
}

/** The state of the app following the second account. */
function otherAccountState(): IAppState {
  return makeAppState({
    activeSteamId: OTHER_STEAM_ID,
    profile: { steamId: OTHER_STEAM_ID, name: 'other', avatar: '' },
  });
}

/** The app before its first account. */
function notSetUpState(): IAppState {
  return makeAppState({
    isConfigured: false,
    profile: null,
    accounts: [],
    activeSteamId: null,
  });
}

describe('settingsSlice', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('load', () => {
    it('should take the setup state when the main process answers', async () => {
      const { sut } = await setup(loadableApi());

      await sut.getState().settings.load();

      expect(sut.getState().settings.appState).toEqual(makeAppState());
    });

    it('should take the always-on-top choice when the main process answers', async () => {
      const { sut } = await setup(loadableApi());

      await sut.getState().settings.load();

      expect(sut.getState().settings.alwaysOnTop).toBe(true);
    });

    it('should take the preferences when the main process answers', async () => {
      const { sut } = await setup(loadableApi());

      await sut.getState().settings.load();

      expect(sut.getState().settings.preferences).toEqual({
        rememberWindow: false,
      });
    });

    it('should take the folders when the main process answers', async () => {
      const { sut } = await setup(loadableApi());

      await sut.getState().settings.load();

      expect(sut.getState().settings.folders).toEqual({
        data: { path: '/home/me/data', canOpen: true },
        errorLog: { path: '/home/me/errorLog', canOpen: true },
      });
    });
  });

  describe('apply', () => {
    it('should make the interface follow the language when a state is applied', async () => {
      const { sut } = await setup();

      sut.getState().settings.apply(makeAppState({ language: 'pt-BR' }));

      expect(sut.getState().session.language).toBe('pt-BR');
    });

    it('should follow the saved achievement order when a state is applied', async () => {
      const { sut } = await setup();

      sut.getState().settings.apply(
        makeAppState({
          achievementSort: { pending: 'rare', unlocked: 'name' },
        }),
      );

      expect(sut.getState().settings.achievementSort).toEqual({
        pending: 'rare',
        unlocked: 'name',
      });
    });

    it('should follow the saved dashboard order when a state is applied', async () => {
      const { sut } = await setup();

      sut.getState().settings.apply(
        makeAppState({
          dashboardSort: { ongoing: 'fewest', complete: 'name' },
        }),
      );

      expect(sut.getState().settings.dashboardSort).toEqual({
        ongoing: 'fewest',
        complete: 'name',
      });
    });
  });

  describe('toggleAlwaysOnTop', () => {
    it('should turn it on when the main process has not answered yet', async () => {
      const answer = deferred<boolean>();
      const { sut } = await setup({ setAlwaysOnTop: () => answer.promise });

      void sut.getState().settings.toggleAlwaysOnTop();

      expect(sut.getState().settings.alwaysOnTop).toBe(true);
    });

    it('should keep it on when the main process applies the change', async () => {
      const { sut } = await setup({
        setAlwaysOnTop: (value) => Promise.resolve(value),
      });

      await sut.getState().settings.toggleAlwaysOnTop();

      expect(sut.getState().settings.alwaysOnTop).toBe(true);
    });

    it('should report no error when the main process applies the change', async () => {
      const { sut, toastMock } = await setup({
        setAlwaysOnTop: (value) => Promise.resolve(value),
      });

      await sut.getState().settings.toggleAlwaysOnTop();

      expect(toastMock.error).not.toHaveBeenCalled();
    });

    it('should turn it back off when the change cannot be made', async () => {
      const { sut } = await setup({
        setAlwaysOnTop: () => Promise.reject(new Error('no window')),
      });

      await sut.getState().settings.toggleAlwaysOnTop();

      expect(sut.getState().settings.alwaysOnTop).toBe(false);
    });

    it('should tell the user when the change cannot be made', async () => {
      const { sut, toastMock } = await setup({
        setAlwaysOnTop: () => Promise.reject(new Error('no window')),
      });

      await sut.getState().settings.toggleAlwaysOnTop();

      expect(toastMock.error).toHaveBeenCalledExactlyOnceWith(NOT_SAVED);
    });

    it('should turn it back off when the main process did not apply the change', async () => {
      const { sut } = await setup({
        setAlwaysOnTop: () => Promise.resolve(false),
      });

      await sut.getState().settings.toggleAlwaysOnTop();

      expect(sut.getState().settings.alwaysOnTop).toBe(false);
    });
  });

  describe('setAchievementSort', () => {
    it('should reorder the list when the main process has not answered yet', async () => {
      const answer = deferred<void>();
      const { sut } = await setup({
        setAchievementSort: () => answer.promise,
      });

      void sut.getState().settings.setAchievementSort('pending', 'rare');

      expect(sut.getState().settings.achievementSort).toEqual({
        pending: 'rare',
        unlocked: 'recent',
      });
    });

    it('should save the order of both lists when one is changed', async () => {
      const setAchievementSortMock = vi.fn(() => Promise.resolve());
      const { sut } = await setup({
        setAchievementSort: setAchievementSortMock,
      });

      await sut.getState().settings.setAchievementSort('pending', 'rare');

      expect(setAchievementSortMock).toHaveBeenCalledExactlyOnceWith({
        pending: 'rare',
        unlocked: 'recent',
      });
    });

    it('should go back to the previous order when it cannot be saved', async () => {
      const { sut } = await setup({
        setAchievementSort: () => Promise.reject(new Error('disk full')),
      });

      await sut.getState().settings.setAchievementSort('pending', 'rare');

      expect(sut.getState().settings.achievementSort).toEqual({
        pending: 'common',
        unlocked: 'recent',
      });
    });

    it('should tell the user when the order cannot be saved', async () => {
      const { sut, toastMock } = await setup({
        setAchievementSort: () => Promise.reject(new Error('disk full')),
      });

      await sut.getState().settings.setAchievementSort('pending', 'rare');

      expect(toastMock.error).toHaveBeenCalledExactlyOnceWith(NOT_SAVED);
    });
  });

  describe('setDashboardSort', () => {
    it('should reorder the list when the main process has not answered yet', async () => {
      const answer = deferred<void>();
      const { sut } = await setup({ setDashboardSort: () => answer.promise });

      void sut.getState().settings.setDashboardSort('ongoing', 'name');

      expect(sut.getState().settings.dashboardSort).toEqual({
        ongoing: 'name',
        complete: 'completed',
      });
    });

    it('should save the order of both lists when one is changed', async () => {
      const setDashboardSortMock = vi.fn(() => Promise.resolve());
      const { sut } = await setup({ setDashboardSort: setDashboardSortMock });

      await sut.getState().settings.setDashboardSort('ongoing', 'name');

      expect(setDashboardSortMock).toHaveBeenCalledExactlyOnceWith({
        ongoing: 'name',
        complete: 'completed',
      });
    });

    it('should go back to the previous order when it cannot be saved', async () => {
      const { sut } = await setup({
        setDashboardSort: () => Promise.reject(new Error('disk full')),
      });

      await sut.getState().settings.setDashboardSort('ongoing', 'name');

      expect(sut.getState().settings.dashboardSort).toEqual({
        ongoing: 'closest',
        complete: 'completed',
      });
    });

    it('should tell the user when the order cannot be saved', async () => {
      const { sut, toastMock } = await setup({
        setDashboardSort: () => Promise.reject(new Error('disk full')),
      });

      await sut.getState().settings.setDashboardSort('ongoing', 'name');

      expect(toastMock.error).toHaveBeenCalledExactlyOnceWith(NOT_SAVED);
    });
  });

  describe('changeLanguage', () => {
    it('should save the language when it is not the one in use', async () => {
      const setLanguageMock = vi.fn(() =>
        Promise.resolve(makeAppState({ language: 'fr' })),
      );
      const { sut } = await setup({ setLanguage: setLanguageMock });

      await sut.getState().settings.changeLanguage('fr');

      expect(setLanguageMock).toHaveBeenCalledExactlyOnceWith('fr');
    });

    it('should reload the window when the language is saved', async () => {
      const { sut, reloadMock } = await setup({
        setLanguage: () => Promise.resolve(makeAppState({ language: 'fr' })),
      });

      await sut.getState().settings.changeLanguage('fr');

      expect(reloadMock).toHaveBeenCalledExactlyOnceWith();
    });

    it('should save nothing when the language is the one in use', async () => {
      const setLanguageMock = vi.fn(() => Promise.resolve(makeAppState()));
      const { sut } = await setup({ setLanguage: setLanguageMock });

      await sut.getState().settings.changeLanguage('en');

      expect(setLanguageMock).not.toHaveBeenCalled();
    });

    it('should not reload the window when the language is the one in use', async () => {
      const { sut, reloadMock } = await setup({
        setLanguage: () => Promise.resolve(makeAppState()),
      });

      await sut.getState().settings.changeLanguage('en');

      expect(reloadMock).not.toHaveBeenCalled();
    });
  });

  describe('switchAccount', () => {
    it('should write what was waiting to be saved before it asks for the other account', async () => {
      const order: string[] = [];
      const { sut } = await setup({
        setActiveAccount: () => {
          order.push('switched');
          return Promise.resolve(otherAccountState());
        },
      });
      sut.getState().settings.apply(makeAppState());
      sut.setState((state) => {
        state.userData.flush = () => void order.push('flushed');
      });

      await sut.getState().settings.switchAccount(OTHER_STEAM_ID);

      expect(order).toEqual(['flushed', 'switched']);
    });

    it('should follow the other account when the main process switches to it', async () => {
      const { sut } = await setup({
        setActiveAccount: () => Promise.resolve(otherAccountState()),
      });
      sut.getState().settings.apply(makeAppState());

      await sut.getState().settings.switchAccount(OTHER_STEAM_ID);

      expect(sut.getState().settings.appState).toEqual(otherAccountState());
    });

    it('should ask the main process for nothing when the account is the one in use', async () => {
      const setActiveAccountMock = vi.fn(() =>
        Promise.resolve(otherAccountState()),
      );
      const { sut } = await setup({ setActiveAccount: setActiveAccountMock });
      sut.getState().settings.apply(makeAppState());

      await sut.getState().settings.switchAccount(STEAM_ID);

      expect(setActiveAccountMock).not.toHaveBeenCalled();
    });
  });

  describe('removeAccount', () => {
    it('should go back to an app that is not set up when the last account is removed', async () => {
      const notSetUp = makeAppState({
        isConfigured: false,
        profile: null,
        accounts: [],
        activeSteamId: null,
      });
      const { sut } = await setup({
        removeAccount: () => Promise.resolve(notSetUp),
      });
      sut.getState().settings.apply(makeAppState());

      await sut.getState().settings.removeAccount(STEAM_ID);

      expect(sut.getState().settings.appState).toEqual(notSetUp);
    });
  });

  describe('accept', () => {
    it('should tell the user when the app followed the account signed in to Steam', async () => {
      const { sut, toastMock } = await setup();
      sut.getState().settings.apply(makeAppState());

      sut.getState().settings.accept(otherAccountState(), true);

      expect(toastMock).toHaveBeenCalledExactlyOnceWith(
        'Now following other, the account signed in to Steam.',
      );
    });

    it('should take the state when the main process sent it without following an account', async () => {
      const { sut } = await setup();
      sut.getState().settings.apply(makeAppState());

      sut.getState().settings.accept(otherAccountState(), false);

      expect(sut.getState().settings.appState).toEqual(otherAccountState());
    });

    it('should announce nothing when the main process did not follow an account', async () => {
      const { sut, toastMock } = await setup();
      sut.getState().settings.apply(makeAppState());

      sut.getState().settings.accept(otherAccountState(), false);

      expect(toastMock).not.toHaveBeenCalled();
    });
  });

  describe('acceptAccountStep', () => {
    it('should follow the added account at once when the app is set up', async () => {
      const { sut } = await setup();
      sut.getState().settings.apply(makeAppState());

      sut.getState().settings.acceptAccountStep(otherAccountState());

      expect(sut.getState().settings.appState).toEqual(otherAccountState());
    });

    it('should stay in the setup when its first account is saved', async () => {
      const { sut } = await setup();
      sut.getState().settings.apply(notSetUpState());

      sut.getState().settings.acceptAccountStep(makeAppState());

      expect(sut.getState().settings.appState).toEqual(notSetUpState());
    });
  });

  describe('finishSetup', () => {
    it('should enter the app when the first setup ends', async () => {
      const { sut } = await setup();
      sut.getState().settings.apply(notSetUpState());

      sut.getState().settings.finishSetup(makeAppState());

      expect(sut.getState().settings.appState).toEqual(makeAppState());
    });

    it('should keep the account the main process followed when an account step that began before it ends', async () => {
      const { sut } = await setup();
      const whenTheStepBegan = makeAppState();
      sut.getState().settings.apply(whenTheStepBegan);
      sut.getState().settings.accept(otherAccountState(), true);

      sut.getState().settings.finishSetup(whenTheStepBegan);

      expect(sut.getState().settings.appState?.activeSteamId).toBe(
        OTHER_STEAM_ID,
      );
    });
  });

  describe('initial state', () => {
    it('should remember the window when nothing was loaded yet', async () => {
      const { sut } = await setup();

      const { preferences } = sut.getState().settings;

      expect(preferences).toEqual({ rememberWindow: true });
    });
  });

  describe('setPreference', () => {
    it('should change the preference when the main process has not answered yet', async () => {
      const answer = deferred<IPreferences>();
      const { sut } = await setup({ setPreference: () => answer.promise });

      void sut.getState().settings.setPreference('rememberWindow', false);

      expect(sut.getState().settings.preferences).toEqual({
        rememberWindow: false,
      });
    });

    it('should ask the main process to save the preference when it is changed', async () => {
      const setPreferenceMock = vi.fn(() =>
        Promise.resolve({ rememberWindow: false }),
      );
      const { sut } = await setup({ setPreference: setPreferenceMock });

      await sut.getState().settings.setPreference('rememberWindow', false);

      expect(setPreferenceMock).toHaveBeenCalledExactlyOnceWith(
        'rememberWindow',
        false,
      );
    });

    it('should keep what the main process saved when it differs from what was asked', async () => {
      const { sut } = await setup({
        setPreference: () => Promise.resolve({ rememberWindow: true }),
      });

      await sut.getState().settings.setPreference('rememberWindow', false);

      expect(sut.getState().settings.preferences).toEqual({
        rememberWindow: true,
      });
    });

    it('should put the preference back when it cannot be saved', async () => {
      const { sut } = await setup({
        setPreference: () => Promise.reject(new Error('disk full')),
      });

      await sut.getState().settings.setPreference('rememberWindow', false);

      expect(sut.getState().settings.preferences).toEqual({
        rememberWindow: true,
      });
    });

    it('should tell the user when the preference cannot be saved', async () => {
      const { sut, toastMock } = await setup({
        setPreference: () => Promise.reject(new Error('disk full')),
      });

      await sut.getState().settings.setPreference('rememberWindow', false);

      expect(toastMock.error).toHaveBeenCalledExactlyOnceWith(NOT_SAVED);
    });
  });

  describe('openFolder', () => {
    it('should say nothing when the folder was opened', async () => {
      const { sut, toastMock } = await setup({
        openFolder: () => Promise.resolve('opened'),
      });

      await sut.getState().settings.openFolder('data');

      expect(toastMock).not.toHaveBeenCalled();
    });

    it('should say the path was copied when the folder cannot be opened', async () => {
      const { sut, toastMock } = await setup({
        openFolder: () => Promise.resolve('copied'),
      });

      await sut.getState().settings.openFolder('errorLog');

      expect(toastMock).toHaveBeenCalledExactlyOnceWith('Path copied.');
    });
  });
});
