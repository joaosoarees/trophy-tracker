import { zodResolver } from '@hookform/resolvers/zod';
import { type SyntheticEvent, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { AccountsService } from '@app/services/AccountsService';
import { OnboardingService } from '@app/services/OnboardingService';
import { SettingsService } from '@app/services/SettingsService';
import { useStore } from '@app/store';
import { isLanguage } from '@shared/i18n';
import { type IAppState } from '@shared/types/AppState';

import { type OnboardingFormData, onboardingSchema } from './schema';

interface IOnboardingOptions {
  state: IAppState;
  /** Opened from the app, only to add an account: no language step. */
  isAddingAccount: boolean;
  onDone: (state: IAppState) => void;
}

export function useOnboardingController({
  state,
  isAddingAccount,
  onDone,
}: IOnboardingOptions) {
  const setLanguage = useStore((store) => store.session.setLanguage);
  const acceptAccountStep = useStore(
    (store) => store.settings.acceptAccountStep,
  );
  /**
   * What the first setup has saved so far: accounts are saved as they are
   * verified, and the store only hears of them when the setup ends.
   */
  const [setupState, setSetupState] = useState(state);
  // With the app set up the store is told of each account as it is saved and
  // of what the main process changes meanwhile, so `state` is the one copy.
  const saved = isAddingAccount ? state : setupState;
  /** The accounts verified in this visit, by SteamID. */
  const [addedHere, setAddedHere] = useState<string[]>([]);
  const [isFinishing, setIsFinishing] = useState(false);

  const form = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      languageStep: {
        language: state.language,
      },
      accountStep: { steamId: '', apiKey: '' },
    },
  });

  useEffect(() => {
    const { unsubscribe } = form.watch((formData, { name }) => {
      // Picking the language switches the screen right away, with no reload.
      const language = formData.languageStep?.language;
      if (name === 'languageStep.language' && isLanguage(language)) {
        setLanguage(language);
        void SettingsService.setLanguage(language);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [form, setLanguage]);

  /** An account was saved (`added`) or removed in the account step. */
  function handleAccountsChange(next: IAppState, added?: string) {
    setSetupState(next);
    acceptAccountStep(next);
    if (added) setAddedHere((ids) => [...ids, added]);
  }

  async function finish() {
    let next = saved;
    // The first setup ends on the account signed in to Steam when it is one
    // of them, otherwise on the first one added. Adding an account from the
    // app ends on the account that was just added.
    if (!isAddingAccount && next.accounts.length > 1) {
      const signedIn = await OnboardingService.detectSteamId();
      const first =
        next.accounts.find((a) => a.steamId === signedIn) ?? next.accounts[0];
      if (first.steamId !== next.activeSteamId) {
        next = await AccountsService.setActive(first.steamId);
      }
    }

    onDone(next);
  }

  function handleSubmit(event: SyntheticEvent) {
    event.preventDefault();
    if (saved.accounts.length === 0) return;
    setIsFinishing(true);
    void finish().finally(() => setIsFinishing(false));
  }

  return {
    form,
    accounts: saved.accounts,
    addedHere,
    isFinishing,
    handleSubmit,
    handleAccountsChange,
  };
}
