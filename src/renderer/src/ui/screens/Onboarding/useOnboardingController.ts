import { zodResolver } from '@hookform/resolvers/zod';
import { type SyntheticEvent, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { AccountsService } from '@app/services/AccountsService';
import { OnboardingService } from '@app/services/OnboardingService';
import { SettingsService } from '@app/services/SettingsService';
import { useStore } from '@app/store';
import { isLanguage } from '@shared/i18n';
import { type IAccount } from '@shared/types/Account';
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
  /** What the main process has saved, as accounts are added one by one. */
  const [saved, setSaved] = useState(state);

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

  const verified = form.watch('accountStep.verified');
  const steamId = form.watch('accountStep.steamId');
  const apiKey = form.watch('accountStep.apiKey');
  /** The account in the form, verified and not saved yet, as it will look once saved. */
  const pending: IAccount | null = verified
    ? {
        steamId: steamId.trim(),
        name: verified.name,
        avatar: verified.avatar,
        keyEnding: apiKey.trim().slice(-4),
        status: 'valid',
        checkedAt: null,
      }
    : null;

  /**
   * Saves the account in the form, if there is one. Answers the state after
   * it, or `null` when it could not be saved.
   */
  async function savePending(): Promise<IAppState | null> {
    if (!pending) return saved;
    const next = await OnboardingService.saveConfig(pending.steamId, apiKey);
    if (!next.accounts.some((a) => a.steamId === pending.steamId)) {
      form.setError('root', { type: 'server', message: 'saveFailed' });
      return null;
    }
    setSaved(next);
    return next;
  }

  /** Saves the account in the form and empties it for the next one. */
  async function handleAddAnother(): Promise<boolean> {
    const next = await savePending();
    if (!next) return false;
    form.setValue('accountStep.steamId', '');
    form.setValue('accountStep.apiKey', '');
    form.unregister('accountStep.verified');
    return true;
  }

  async function finish() {
    // With nothing verified and nothing saved, say what is missing.
    if (!pending && saved.accounts.length === 0) {
      await form.trigger();
      return;
    }
    let next = await savePending();
    if (!next) return;

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

  const [isFinishing, setIsFinishing] = useState(false);
  function handleSubmit(event: SyntheticEvent) {
    event.preventDefault();
    setIsFinishing(true);
    void finish().finally(() => setIsFinishing(false));
  }

  return {
    form,
    initialStep,
    accounts: pending
      ? [
          ...saved.accounts.filter((a) => a.steamId !== pending.steamId),
          pending,
        ]
      : saved.accounts,
    knownSteamIds: saved.accounts.map((a) => a.steamId),
    isFinishing,
    handleSubmit,
    handleAddAnother,
    handleStepChange: isAddingAccount ? undefined : saveStep,
  };
}
