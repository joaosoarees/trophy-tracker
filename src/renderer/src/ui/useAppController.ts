import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useT } from '@app/hooks/useT';
import { connectStore, useStore } from '@app/store';
import { type IAppState } from '@shared/types/AppState';

export function useAppController() {
  const t = useT();
  const {
    appState,
    language,
    current,
    isAddingAccount,
    load,
    finishSetup,
    followRunningGame,
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
      current: state.session.current,
      isAddingAccount: state.navigation.isAddingAccount,
      load: state.settings.load,
      finishSetup: state.settings.finishSetup,
      followRunningGame: state.navigation.followRunningGame,
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

  // `undefined` while the current game is still unknown.
  const runningAppId =
    current === null ? undefined : current.isRunning ? current.appid : null;
  useEffect(() => {
    if (runningAppId !== undefined) followRunningGame(runningAppId);
  }, [runningAppId, followRunningGame]);

  /**
   * Leaves the account step. The first setup hands over the state it
   * produced; an account added to the app is in the store already.
   */
  function handleOnboardingDone(next: IAppState) {
    stopAddingAccount();
    finishSetup(next);
  }

  return {
    appState,
    isOnboardingShown: !isConfigured || isAddingAccount,
    // With the app already set up, the step is only there to add an account.
    isAddingAccount: isConfigured && isAddingAccount,
    handleOnboardingDone,
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
