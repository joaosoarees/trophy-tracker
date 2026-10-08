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
    goTo,
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
      goTo: state.navigation.goTo,
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

  return {
    tab,
    game,
    alwaysOnTop,
    newVersion,
    isCheckingForUpdates,
    goTo,
    handleToggleAlwaysOnTop: () => void toggleAlwaysOnTop(),
    handleUpdates: () => void handleUpdates(),
  };
}
