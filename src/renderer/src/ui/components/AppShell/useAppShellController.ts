import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

import { useActiveGame } from '@app/hooks/useActiveGame';
import { useT } from '@app/hooks/useT';
import { useStore } from '@app/store';

export function useAppShellController() {
  const t = useT();
  const game = useActiveGame();
  const {
    tab,
    alwaysOnTop,
    newVersion,
    isUpdateReady,
    isCheckingForUpdates,
    libraryError,
    isLibraryLoading,
    activeAccount,
    goTo,
    startAddingAccount,
    loadCurrent,
    loadDashboard,
    toggleAlwaysOnTop,
    checkForUpdates,
    showUpdateReady,
  } = useStore(
    useShallow((state) => ({
      tab: state.navigation.tab,
      alwaysOnTop: state.settings.alwaysOnTop,
      newVersion: state.updates.appInfo?.newVersion ?? null,
      isUpdateReady: state.updates.appInfo?.updateStatus === 'ready',
      isCheckingForUpdates: state.updates.checkState === 'checking',
      libraryError: state.dashboard.error,
      isLibraryLoading:
        state.dashboard.games === null && state.dashboard.error === null,
      activeAccount:
        state.settings.appState?.accounts.find(
          (account) =>
            account.steamId === state.settings.appState?.activeSteamId,
        ) ?? null,
      goTo: state.navigation.goTo,
      startAddingAccount: state.navigation.startAddingAccount,
      loadCurrent: state.session.loadCurrent,
      loadDashboard: state.dashboard.load,
      toggleAlwaysOnTop: state.settings.toggleAlwaysOnTop,
      checkForUpdates: state.updates.check,
      showUpdateReady: state.updates.showReady,
    })),
  );

  /**
   * One button for the whole subject: it looks for a version, and once there
   * is one it leads to what can be done about it.
   */
  async function handleUpdates() {
    if (isUpdateReady) {
      showUpdateReady();
      return;
    }
    if (newVersion !== null) {
      goTo('settings');
      return;
    }

    const ok = await checkForUpdates();
    if (!ok) {
      toast.error(t.settings.updateCheckFailed);
    } else if (useStore.getState().updates.appInfo?.newVersion == null) {
      // The bar has no room for an answer; a version that was found shows in the icon.
      toast(t.settings.upToDate);
    }
  }

  /** The library could not be read as the app opened: ask for both again. */
  function handleRetryLibrary() {
    void loadCurrent();
    void loadDashboard();
  }

  return {
    tab,
    game,
    libraryError,
    isLibraryLoading,
    handleRetryLibrary,
    handleAddAccount: startAddingAccount,
    // Only a key that stopped working is worth a notice over every screen.
    troubledAccount:
      activeAccount?.status === 'rejected' ||
      activeAccount?.status === 'rateLimited'
        ? activeAccount
        : null,
    alwaysOnTop,
    newVersion,
    isCheckingForUpdates,
    goTo,
    handleToggleAlwaysOnTop: () => void toggleAlwaysOnTop(),
    handleUpdates: () => void handleUpdates(),
  };
}
