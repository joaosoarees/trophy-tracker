import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useStore } from '@app/store';
import { isLanguage } from '@shared/i18n';

export function useSettingsController() {
  const [isConfirmingErase, setIsConfirmingErase] = useState(false);
  const {
    profile,
    language,
    changeLanguage,
    eraseCredentials,
    startReconfiguring,
  } = useStore(
    useShallow((state) => ({
      profile: state.settings.appState?.profile ?? null,
      language: state.session.language,
      changeLanguage: state.settings.changeLanguage,
      eraseCredentials: state.settings.eraseCredentials,
      startReconfiguring: state.navigation.startReconfiguring,
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
    isConfirmingErase,
    setIsConfirmingErase,
    handleChangeLanguage,
    handleErase,
    handleRedoSetup: startReconfiguring,
  };
}
