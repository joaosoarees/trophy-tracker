import { toast } from 'sonner';

import { safeSessionStorageGetItem } from '@app/lib/safeSessionStorageGetItem';
import { SystemService } from '@app/services/SystemService';
import type { StoreSlice } from '@app/store/Store';
import { messagesFor } from '@shared/i18n';
import { type IAppInfo } from '@shared/types/AppInfo';
import { isUpdatingItself, needsTheUser } from '@shared/updateFlow';

/** How long the app holds its first screen waiting to hear about a new version. */
const STARTUP_WAIT_MS = 4000;
const CHECKED_KEY = 'updates.checkedOnStartup';

/**
 * What the app is doing about updates as it opens:
 * - `checking`: waiting, for a few seconds at most, to hear about a new version;
 * - `updating`: a version was found in time; it downloads and the app restarts;
 * - `done`: the app is in use; a version found from here on downloads in the
 *   background and the user is asked before the restart.
 */
type Startup = 'checking' | 'updating' | 'done';

type UpdatesStore = {
  /** Running version and what is known about a later one; `null` until asked. */
  appInfo: IAppInfo | null;
  startup: Startup;
  /** A version finished downloading while the app was in use. */
  isReadyDialogOpen: boolean;
  /** A check the user asked for is waiting for its answer. */
  isChecking: boolean;
};

type UpdatesActions = {
  /** Called once when the app opens. Returns what undoes the subscription. */
  start: () => () => void;
  /** The check the user asks for; answers whether it could be made. */
  check: () => Promise<boolean>;
  /** Takes what the main process announces about a download. */
  accept: (appInfo: IAppInfo) => void;
  /** Closes the app to install the downloaded version. */
  restart: () => void;
  dismissReady: () => void;
  /** Brings the restart question back after it was put off. */
  showReady: () => void;
};

export type UpdatesSlice = UpdatesStore & UpdatesActions;

// Guards against a second `start` while the first check is still running.
let isStarting = false;

// A window reload (a language change) is not the app opening again.
const alreadyCheckedThisLaunch = (): boolean =>
  safeSessionStorageGetItem<boolean>(CHECKED_KEY) === true;

export const createUpdatesSlice: StoreSlice<UpdatesSlice> = (set, get) => {
  const setStartup = (startup: Startup): void => {
    if (startup === 'done') sessionStorage.setItem(CHECKED_KEY, 'true');
    set(
      (prevState) => {
        prevState.updates.startup = startup;
      },
      false,
      `updates/startup:${startup}`,
    );
  };

  /** Where the app does not update itself, says once that a version exists. */
  const announce = (info: IAppInfo | null): void => {
    if (info === null || info.newVersion === null || !needsTheUser(info)) {
      return;
    }
    const t = messagesFor(get().session.language);
    const isConfigured = get().settings.appState?.isConfigured === true;
    toast(t.update.available(info.newVersion), {
      duration: 10_000,
      // The details live in Settings, which only exists once the app is set up.
      action: isConfigured
        ? {
            label: t.update.see,
            onClick: () => get().navigation.goTo('settings'),
          }
        : undefined,
    });
  };

  const runStartupCheck = async (): Promise<void> => {
    const answer = SystemService.checkForUpdates().then(
      ({ info }) => info,
      () => null,
    );
    const first = await Promise.race([
      answer,
      new Promise<'timeout'>((resolve) =>
        setTimeout(() => resolve('timeout'), STARTUP_WAIT_MS),
      ),
    ]);

    if (first === 'timeout') {
      // Too slow to hold the app for: whatever is found is handled in use.
      setStartup('done');
      void answer.then((info) => {
        if (info === null) return;
        get().updates.accept(info);
        announce(info);
      });
      return;
    }

    if (first !== null && isUpdatingItself(first)) {
      setStartup('updating');
      get().updates.accept(first);
      return;
    }

    setStartup('done');
    if (first !== null) get().updates.accept(first);
    announce(first);
  };

  return {
    appInfo: null,
    startup: alreadyCheckedThisLaunch() ? 'done' : 'checking',
    isReadyDialogOpen: false,
    isChecking: false,

    start: () => {
      const off = SystemService.onAppInfoChanged(get().updates.accept);

      if (get().updates.startup === 'done') {
        // After a reload: only read what the main process already knows.
        void SystemService.getAppInfo().then(get().updates.accept, () => {});
      } else if (!isStarting) {
        isStarting = true;
        void runStartupCheck().finally(() => (isStarting = false));
      }
      return off;
    },

    check: async () => {
      const setChecking = (isChecking: boolean): void =>
        set(
          (prevState) => {
            prevState.updates.isChecking = isChecking;
          },
          false,
          isChecking ? 'updates/check' : 'updates/checked',
        );

      setChecking(true);
      try {
        const { ok, info } = await SystemService.checkForUpdates();
        get().updates.accept(info);
        return ok;
      } catch {
        return false;
      } finally {
        setChecking(false);
      }
    },

    accept: (appInfo) => {
      const { startup, appInfo: previous } = get().updates;
      const hasBecomeReady =
        appInfo.updateStatus === 'ready' && previous?.updateStatus !== 'ready';

      set(
        (prevState) => {
          prevState.updates.appInfo = appInfo;
          // In use, the restart is the user's call.
          if (startup === 'done' && hasBecomeReady) {
            prevState.updates.isReadyDialogOpen = true;
          }
        },
        false,
        'updates/accept',
      );

      if (startup !== 'updating') return;
      if (appInfo.updateStatus === 'ready') {
        get().updates.restart();
      } else if (!isUpdatingItself(appInfo)) {
        // The download failed: open the app; Settings offers the download page.
        setStartup('done');
        announce(appInfo);
      }
    },

    restart: () => {
      // Notes still waiting to be written must not be lost to the restart.
      get().userData.flush();
      void SystemService.installUpdate();
    },

    showReady: () =>
      set(
        (prevState) => {
          prevState.updates.isReadyDialogOpen =
            prevState.updates.appInfo?.updateStatus === 'ready';
        },
        false,
        'updates/showReady',
      ),

    dismissReady: () =>
      set(
        (prevState) => {
          prevState.updates.isReadyDialogOpen = false;
        },
        false,
        'updates/dismissReady',
      ),
  };
};
