import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { SystemService } from '@app/services/SystemService';
import { useStore } from '@app/store';
import { isLanguage } from '@shared/i18n';
import { type ExternalPage } from '@shared/types/Guide';

export function useSettingsController() {
  const [isConfirmingErase, setIsConfirmingErase] = useState(false);
  const {
    profile,
    language,
    appInfo,
    checkState,
    alwaysOnTop,
    preferences,
    dataFolder,
    changeLanguage,
    eraseCredentials,
    startReconfiguring,
    checkForUpdates,
    restartToUpdate,
    toggleAlwaysOnTop,
    setPreference,
    openDataFolder,
  } = useStore(
    useShallow((state) => ({
      profile: state.settings.appState?.profile ?? null,
      language: state.session.language,
      appInfo: state.updates.appInfo,
      checkState: state.updates.checkState,
      alwaysOnTop: state.settings.alwaysOnTop,
      preferences: state.settings.preferences,
      dataFolder: state.settings.dataFolder,
      changeLanguage: state.settings.changeLanguage,
      eraseCredentials: state.settings.eraseCredentials,
      startReconfiguring: state.navigation.startReconfiguring,
      checkForUpdates: state.updates.check,
      restartToUpdate: state.updates.restart,
      toggleAlwaysOnTop: state.settings.toggleAlwaysOnTop,
      setPreference: state.settings.setPreference,
      openDataFolder: state.settings.openDataFolder,
    })),
  );

  function handleChangeLanguage(value: string) {
    if (isLanguage(value)) void changeLanguage(value);
  }

  function handleErase() {
    setIsConfirmingErase(false);
    void eraseCredentials();
  }

  return {
    profile,
    language,
    appInfo,
    checkState,
    alwaysOnTop,
    preferences,
    dataFolder,
    isConfirmingErase,
    setIsConfirmingErase,
    handleChangeLanguage,
    handleErase,
    handleRedoSetup: startReconfiguring,
    handleToggleAlwaysOnTop: () => void toggleAlwaysOnTop(),
    handleNotifyUnlocksChange: (value: boolean) =>
      void setPreference('notifyUnlocks', value),
    handleRememberWindowChange: (value: boolean) =>
      void setPreference('rememberWindow', value),
    handleOpenDataFolder: () => void openDataFolder(),
    handleCheckForUpdates: () => void checkForUpdates(),
    handleInstallUpdate: restartToUpdate,
    handleOpenPage: (page: ExternalPage) =>
      void SystemService.openExternal(page),
  };
}
