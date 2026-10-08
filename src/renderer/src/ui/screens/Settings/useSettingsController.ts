import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { SystemService } from '@app/services/SystemService';
import { useStore } from '@app/store';
import { isLanguage } from '@shared/i18n';

/** Outcome of the last check the user asked for, shown beside the button. */
type UpdateCheck = 'idle' | 'checking' | 'upToDate' | 'failed';

export function useSettingsController() {
  const [isConfirmingErase, setIsConfirmingErase] = useState(false);
  const [updateCheck, setUpdateCheck] = useState<UpdateCheck>('idle');
  const {
    profile,
    language,
    appInfo,
    changeLanguage,
    eraseCredentials,
    startReconfiguring,
    flushUserData,
    checkForUpdates,
  } = useStore(
    useShallow((state) => ({
      profile: state.settings.appState?.profile ?? null,
      language: state.session.language,
      appInfo: state.settings.appInfo,
      changeLanguage: state.settings.changeLanguage,
      eraseCredentials: state.settings.eraseCredentials,
      startReconfiguring: state.navigation.startReconfiguring,
      flushUserData: state.userData.flush,
      checkForUpdates: state.settings.checkForUpdates,
    })),
  );

  function handleChangeLanguage(value: string) {
    if (isLanguage(value)) void changeLanguage(value);
  }

  function handleErase() {
    setIsConfirmingErase(false);
    void eraseCredentials();
  }

  async function handleCheckForUpdates() {
    setUpdateCheck('checking');
    const ok = await checkForUpdates();
    // A version that was found speaks for itself in the notice above.
    setUpdateCheck(ok ? 'upToDate' : 'failed');
  }

  function handleInstallUpdate() {
    // Notes still waiting to be written must not be lost to the restart.
    flushUserData();
    void SystemService.installUpdate();
  }

  return {
    profile,
    language,
    appInfo,
    isConfirmingErase,
    setIsConfirmingErase,
    handleChangeLanguage,
    handleErase,
    handleRedoSetup: startReconfiguring,
    updateCheck,
    handleCheckForUpdates: () => void handleCheckForUpdates(),
    handleInstallUpdate,
    handleDownload: () => void SystemService.openExternal('download'),
  };
}
