import { useShallow } from 'zustand/react/shallow';

import { SystemService } from '@app/services/SystemService';
import { useStore } from '@app/store';
import { isLanguage } from '@shared/i18n';
import { type IAccount } from '@shared/types/Account';
import { type ExternalPage } from '@shared/types/Guide';

/** A stable value for the selector while the state is still unknown. */
const NO_ACCOUNTS: IAccount[] = [];

export function useSettingsController() {
  const {
    accounts,
    activeAccount,
    isPlaying,
    language,
    appInfo,
    alwaysOnTop,
    preferences,
    dataFolder,
    changeLanguage,
    switchAccount,
    startAddingAccount,
    restartToUpdate,
    toggleAlwaysOnTop,
    setPreference,
    openDataFolder,
  } = useStore(
    useShallow((state) => ({
      accounts: state.settings.appState?.accounts ?? NO_ACCOUNTS,
      activeAccount:
        state.settings.appState?.accounts.find(
          (account) =>
            account.steamId === state.settings.appState?.activeSteamId,
        ) ?? null,
      // The account playing a game is not left while the game runs.
      isPlaying:
        state.session.current?.isRunning === true &&
        state.session.current.isOnAnotherAccount !== true,
      language: state.session.language,
      appInfo: state.updates.appInfo,
      alwaysOnTop: state.settings.alwaysOnTop,
      preferences: state.settings.preferences,
      dataFolder: state.settings.dataFolder,
      changeLanguage: state.settings.changeLanguage,
      switchAccount: state.settings.switchAccount,
      startAddingAccount: state.navigation.startAddingAccount,
      restartToUpdate: state.updates.restart,
      toggleAlwaysOnTop: state.settings.toggleAlwaysOnTop,
      setPreference: state.settings.setPreference,
      openDataFolder: state.settings.openDataFolder,
    })),
  );

  function handleChangeLanguage(value: string) {
    if (isLanguage(value)) void changeLanguage(value);
  }

  return {
    accounts,
    activeAccount,
    isAccountLocked: isPlaying,
    language,
    appInfo,
    alwaysOnTop,
    preferences,
    dataFolder,
    handleChangeLanguage,
    handleSwitchAccount: (steamId: string) => void switchAccount(steamId),
    handleAddAccount: startAddingAccount,
    handleToggleAlwaysOnTop: () => void toggleAlwaysOnTop(),
    handleRememberWindowChange: (value: boolean) =>
      void setPreference('rememberWindow', value),
    handleOpenDataFolder: () => void openDataFolder(),
    handleInstallUpdate: restartToUpdate,
    handleOpenPage: (page: ExternalPage) =>
      void SystemService.openExternal(page),
  };
}
