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
    failures,
    current,
    reconfiguringFrom,
    load,
    apply,
    followRunningGame,
    stopReconfiguring,
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
      failures: state.session.failures,
      current: state.session.current,
      reconfiguringFrom: state.navigation.reconfiguringFrom,
      load: state.settings.load,
      apply: state.settings.apply,
      followRunningGame: state.navigation.followRunningGame,
      stopReconfiguring: state.navigation.stopReconfiguring,
      startUpdates: state.updates.start,
      updateStartup: state.updates.startup,
      updateInfo: state.updates.appInfo,
      isUpdateReadyOpen: state.updates.isReadyDialogOpen,
      restartToUpdate: state.updates.restart,
      dismissUpdateReady: state.updates.dismissReady,
    })),
  );

  const configured = appState?.configured === true;

  useEffect(() => {
    void load();
  }, [load]);

  // Runs before anything else is shown, set up or not.
  useEffect(() => startUpdates(), [startUpdates]);

  useEffect(() => {
    document.title = t.appTitle;
    document.documentElement.lang = language;
  }, [t, language]);

  useEffect(() => {
    if (configured) return connectStore();
  }, [configured]);

  // A read failed: check whether the key stopped being valid.
  useEffect(() => {
    if (failures > 0) void load();
  }, [failures, load]);

  // `undefined` while the current game is still unknown.
  const runningAppId =
    current === null ? undefined : current.running ? current.appid : null;
  useEffect(() => {
    if (runningAppId !== undefined) followRunningGame(runningAppId);
  }, [runningAppId, followRunningGame]);

  /**
   * Leaves the onboarding. When the setup was redone with the app already in
   * use and the language changed along the way, what is loaded came from Steam
   * in the old language, and only a reload guarantees none of it is left.
   */
  function leaveOnboarding(next?: IAppState) {
    if (reconfiguringFrom !== null && language !== reconfiguringFrom) {
      window.location.reload();
      return;
    }

    stopReconfiguring();
    if (next) apply(next);
  }

  function handleOnboardingDone(next: IAppState) {
    leaveOnboarding(next);
  }

  function handleOnboardingCancel() {
    leaveOnboarding();
  }

  const reconfiguring = reconfiguringFrom !== null;

  return {
    appState,
    showOnboarding: !configured || reconfiguring,
    canCancelOnboarding: configured && reconfiguring,
    handleOnboardingDone,
    handleOnboardingCancel,
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
