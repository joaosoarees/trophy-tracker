import { zodResolver } from '@hookform/resolvers/zod';
import { type SyntheticEvent, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { AccountsService } from '@app/services/AccountsService';
import { OnboardingService } from '@app/services/OnboardingService';
import { SettingsService } from '@app/services/SettingsService';
import { useStore } from '@app/store';
import { isLanguage } from '@shared/i18n';
import { type IAppState } from '@shared/types/AppState';

import { clearDraft, loadDraft, loadStep, saveDraft, saveStep } from './draft';
import { type OnboardingFormData, onboardingSchema } from './schema';

interface IOnboardingOptions {
  state: IAppState;
  /** Opened from the app, only to add an account: no language step and no draft. */
  isAddingAccount: boolean;
  onDone: (state: IAppState) => void;
}

export function useOnboardingController({
  state,
  isAddingAccount,
  onDone,
}: IOnboardingOptions) {
  const setLanguage = useStore((store) => store.session.setLanguage);
  // Read once: the draft only seeds the form.
  const [draft] = useState(() => (isAddingAccount ? null : loadDraft()));
  const [initialStep] = useState(() => (isAddingAccount ? 0 : loadStep()));
  /** What the main process has saved: accounts are saved as they are verified. */
  const [saved, setSaved] = useState(state);
  /** Played games found for each account verified in this visit. */
  const [gamesFound, setGamesFound] = useState<Record<string, number>>({});
  const [isFinishing, setIsFinishing] = useState(false);

  const form = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      languageStep: {
        language: isLanguage(draft?.language) ? draft.language : state.language,
      },
      accountStep: { steamId: draft?.steamId ?? '', apiKey: '' },
    },
  });

  useEffect(() => {
    const { unsubscribe } = form.watch((formData, { name }) => {
      if (!isAddingAccount) {
        saveDraft({
          language: formData.languageStep?.language,
          steamId: formData.accountStep?.steamId,
        });
      }

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
  }, [form, setLanguage, isAddingAccount]);

  /** An account was saved or removed in the account step. */
  function handleAccountsChange(next: IAppState, games?: number) {
    setSaved(next);
    if (games !== undefined && next.activeSteamId) {
      // Saving follows the account that was saved.
      setGamesFound((found) => ({ ...found, [next.activeSteamId!]: games }));
    }
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

    if (!isAddingAccount) clearDraft();
    onDone(next);
  }

  function handleSubmit(event: SyntheticEvent) {
    event.preventDefault();
    if (saved.accounts.length === 0) return;
    setIsFinishing(true);
    void finish().finally(() => setIsFinishing(false));
  }

  const [only] = saved.accounts;

  return {
    form,
    initialStep,
    saved,
    accounts: saved.accounts,
    gamesFound,
    /** For the summary: only said when there is one account and it was just verified. */
    gamesFoundOnOnly:
      saved.accounts.length === 1 ? (gamesFound[only.steamId] ?? null) : null,
    isFinishing,
    handleSubmit,
    handleAccountsChange,
    handleStepChange: isAddingAccount ? undefined : saveStep,
  };
}
