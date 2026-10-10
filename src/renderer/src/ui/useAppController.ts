import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useT } from '@app/hooks/useT';
import { connectStore, useStore } from '@app/store';

export function useAppController() {
  const t = useT();
  const {
    appState,
    language,
    isAddingAccount,
    load,
    stopAddingAccount,
    startUpdates,
    updateStartup,
    updateInfo,
    isUpdateReadyOpen,
    restartToUpdate,
    dismissUpdateReady,
  } = useStore(
    useShallow((state) => ({
      appState: state.settings.appState,
      language: state.session.language,
      isAddingAccount: state.navigation.isAddingAccount,
      load: state.settings.load,
      stopAddingAccount: state.navigation.stopAddingAccount,
      startUpdates: state.updates.start,
      updateStartup: state.updates.startup,
      updateInfo: state.updates.appInfo,
      isUpdateReadyOpen: state.updates.isReadyDialogOpen,
      restartToUpdate: state.updates.restart,
      dismissUpdateReady: state.updates.dismissReady,
    })),
  );

  const isConfigured = appState?.isConfigured === true;
  const activeSteamId = appState?.activeSteamId ?? null;

  useEffect(() => {
    void load();
  }, [load]);

  // Runs before anything else is shown, set up or not.
  useEffect(() => startUpdates(), [startUpdates]);

  useEffect(() => {
    document.title = t.appTitle;
    document.documentElement.lang = language;
  }, [t, language]);

  // Again for each account: what was read for one says nothing about another.
  useEffect(() => {
    if (isConfigured) return connectStore();
  }, [isConfigured, activeSteamId]);

  return {
    appState,
    isOnboardingShown: !isConfigured || isAddingAccount,
    // With the app already set up, the step is only there to add an account.
    isAddingAccount: isConfigured && isAddingAccount,
    // The step has told the store what it saved by then (`finishSetup`).
    handleOnboardingDone: stopAddingAccount,
    handleOnboardingCancel: stopAddingAccount,
    isStartingUp: updateStartup !== 'done',
    // While only checking there is no version to show yet.
    updateVersion:
      updateStartup === 'updating' ? (updateInfo?.newVersion ?? null) : null,
    updatePercent: updateInfo?.downloadPercent ?? 0,
    readyVersion: updateInfo?.newVersion ?? null,
    isUpdateReadyOpen,
    handleRestartToUpdate: restartToUpdate,
    handleUpdateLater: dismissUpdateReady,
  };
}
