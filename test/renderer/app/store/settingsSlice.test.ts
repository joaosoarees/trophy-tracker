import { afterEach, describe, expect, it, vi } from 'vitest';

import { type IApi } from '@shared/types/Api';
import { makeAppState } from '@test/factories/makeAppState';
import { OTHER_STEAM_ID, STEAM_ID } from '@test/helpers';

import { deferred, makeStore } from './makeStore';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

async function setup(api: Partial<IApi> = {}) {
  const made = await makeStore({ api });
  return { ...made, settings: () => made.store.getState().settings };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('settings: loading', () => {
  it('takes the setup and the always-on-top choice from the main process', async () => {
    const { settings } = await setup({
      getState: () => Promise.resolve(makeAppState()),
      getAlwaysOnTop: () => Promise.resolve(true),
      getPreferences: () => Promise.resolve({ rememberWindow: false }),
      getFolder: (id) =>
        Promise.resolve({ path: `/home/me/${id}`, canOpen: true }),
    });

    await settings().load();

    expect(settings().appState?.isConfigured).toBe(true);
    expect(settings().alwaysOnTop).toBe(true);
    expect(settings().preferences.rememberWindow).toBe(false);
    expect(settings().folders).toEqual({
      data: { path: '/home/me/data', canOpen: true },
      errorLog: { path: '/home/me/errorLog', canOpen: true },
    });
  });

  it('makes the interface follow the saved language and list orders', async () => {
    const { store, settings } = await setup();

    settings().apply(
      makeAppState({
        language: 'pt-BR',
        achievementSort: { pending: 'rare', unlocked: 'name' },
      }),
    );

    expect(store.getState().session.language).toBe('pt-BR');
    expect(settings().achievementSort).toEqual({
      pending: 'rare',
      unlocked: 'name',
    });
  });
});

describe('settings: always on top', () => {
  it('responds at once, before the main process answers', async () => {
    const answer = deferred<boolean>();
    const { settings } = await setup({ setAlwaysOnTop: () => answer.promise });

    void settings().toggleAlwaysOnTop();

    expect(settings().alwaysOnTop).toBe(true);
  });

  it('keeps the change when the main process applies it', async () => {
    const { settings, toast } = await setup({
      setAlwaysOnTop: (value) => Promise.resolve(value),
    });

    await settings().toggleAlwaysOnTop();

    expect(settings().alwaysOnTop).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('puts the button back and tells the user when the change cannot be made', async () => {
    const { settings, toast } = await setup({
      setAlwaysOnTop: () => Promise.reject(new Error('no window')),
    });

    await settings().toggleAlwaysOnTop();

    expect(settings().alwaysOnTop).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(
      'Could not save your change, so it was undone.',
    );
  });

  it('puts the button back when the main process did not apply the change', async () => {
    const { settings } = await setup({
      setAlwaysOnTop: () => Promise.resolve(false),
    });

    await settings().toggleAlwaysOnTop();

    expect(settings().alwaysOnTop).toBe(false);
  });
});

describe('settings: list order', () => {
  it('reorders the achievement list at once and saves the choice', async () => {
    const setAchievementSort = vi.fn(() => Promise.resolve());
    const { settings } = await setup({ setAchievementSort });

    await settings().setAchievementSort('pending', 'rare');

    expect(settings().achievementSort.pending).toBe('rare');
    expect(setAchievementSort).toHaveBeenCalledWith({
      pending: 'rare',
      unlocked: 'recent',
    });
  });

  it('goes back to the previous achievement order when it cannot be saved', async () => {
    const { settings, toast } = await setup({
      setAchievementSort: () => Promise.reject(new Error('disk full')),
    });

    await settings().setAchievementSort('pending', 'rare');

    expect(settings().achievementSort.pending).toBe('common');
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it('reorders the dashboard at once and saves the choice', async () => {
    const setDashboardSort = vi.fn(() => Promise.resolve());
    const { settings } = await setup({ setDashboardSort });

    await settings().setDashboardSort('ongoing', 'name');

    expect(settings().dashboardSort.ongoing).toBe('name');
    expect(setDashboardSort).toHaveBeenCalledWith({
      ongoing: 'name',
      complete: 'completed',
    });
  });

  it('goes back to the previous dashboard order when it cannot be saved', async () => {
    const { settings, toast } = await setup({
      setDashboardSort: () => Promise.reject(new Error('disk full')),
    });

    await settings().setDashboardSort('ongoing', 'name');

    expect(settings().dashboardSort.ongoing).toBe('closest');
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});

describe('settings: language', () => {
  it('saves the new language and reloads the window', async () => {
    const setLanguage = vi.fn(() =>
      Promise.resolve(makeAppState({ language: 'fr' })),
    );
    const { settings, reload } = await setup({ setLanguage });

    await settings().changeLanguage('fr');

    expect(setLanguage).toHaveBeenCalledWith('fr');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the language is the one already in use', async () => {
    const setLanguage = vi.fn(() => Promise.resolve(makeAppState()));
    const { settings, reload } = await setup({ setLanguage });

    await settings().changeLanguage('en');

    expect(setLanguage).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('settings: accounts', () => {
  const other = makeAppState({
    activeSteamId: OTHER_STEAM_ID,
    profile: { steamId: OTHER_STEAM_ID, name: 'other', avatar: '' },
  });

  it('follows another account, writing first what was still waiting to be saved', async () => {
    const order: string[] = [];
    const { settings, store } = await setup({
      setActiveAccount: () => {
        order.push('switched');
        return Promise.resolve(other);
      },
    });
    settings().apply(makeAppState());
    store.setState((state) => {
      state.userData.flush = () => void order.push('flushed');
    });

    await settings().switchAccount(OTHER_STEAM_ID);

    expect(order).toEqual(['flushed', 'switched']);
    expect(settings().appState?.activeSteamId).toBe(OTHER_STEAM_ID);
  });

  it('asks for nothing when the account is already the one in use', async () => {
    const { settings } = await setup();
    settings().apply(makeAppState());

    await settings().switchAccount(STEAM_ID);

    expect(settings().appState?.activeSteamId).toBe(STEAM_ID);
  });

  it('goes back to an app that is not set up when the last account is removed', async () => {
    const { settings } = await setup({
      removeAccount: () =>
        Promise.resolve(
          makeAppState({
            isConfigured: false,
            profile: null,
            accounts: [],
            activeSteamId: null,
          }),
        ),
    });
    settings().apply(makeAppState());

    await settings().removeAccount(STEAM_ID);

    expect(settings().appState).toMatchObject({
      isConfigured: false,
      accounts: [],
    });
  });

  it('tells the user when the app followed the account signed in to Steam', async () => {
    const { settings, toast } = await setup();
    settings().apply(makeAppState());

    settings().accept(other, true);

    expect(toast).toHaveBeenCalledWith(
      'Now following other, the account signed in to Steam.',
    );
  });

  it('takes a state the main process sent without announcing anything', async () => {
    const { settings, toast } = await setup();
    settings().apply(makeAppState());

    settings().accept(other, false);

    expect(settings().appState?.activeSteamId).toBe(OTHER_STEAM_ID);
    expect(toast).not.toHaveBeenCalled();
  });
});

describe('settings: preferences', () => {
  it('remembers the window until told otherwise', async () => {
    const { settings } = await setup();

    expect(settings().preferences).toEqual({ rememberWindow: true });
  });

  it('changes a preference at once and keeps what the main process saved', async () => {
    const setPreference = vi.fn(() =>
      Promise.resolve({ rememberWindow: false }),
    );
    const { settings } = await setup({ setPreference });

    await settings().setPreference('rememberWindow', false);

    expect(settings().preferences.rememberWindow).toBe(false);
    expect(setPreference).toHaveBeenCalledWith('rememberWindow', false);
  });

  it('puts a preference back and tells the user when it cannot be saved', async () => {
    const { settings, toast } = await setup({
      setPreference: () => Promise.reject(new Error('disk full')),
    });

    await settings().setPreference('rememberWindow', false);

    expect(settings().preferences.rememberWindow).toBe(true);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});

describe('settings: opening a folder', () => {
  it('says nothing when the folder was opened', async () => {
    const { settings, toast } = await setup({
      openFolder: () => Promise.resolve('opened'),
    });

    await settings().openFolder('data');

    expect(toast).not.toHaveBeenCalled();
  });

  it('says the path was copied where the folder cannot be opened', async () => {
    const { settings, toast } = await setup({
      openFolder: () => Promise.resolve('copied'),
    });

    await settings().openFolder('errorLog');

    expect(toast).toHaveBeenCalledWith('Path copied.');
  });
});
