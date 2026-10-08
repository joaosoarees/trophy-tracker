import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { OnboardingService } from '@app/services/OnboardingService';
import { SettingsService } from '@app/services/SettingsService';
import { useStore } from '@app/store';
import { isLanguage } from '@shared/i18n';
import { type IAppState } from '@shared/types';

import { clearDraft, loadDraft, loadStep, saveDraft, saveStep } from './draft';
import { type OnboardingFormData, onboardingSchema } from './schema';

export function useOnboardingController(
  state: IAppState,
  onDone: (state: IAppState) => void,
) {
  const setLanguage = useStore((store) => store.session.setLanguage);
  // Read once: the draft only seeds the form.
  const [draft] = useState(loadDraft);
  const [initialStep] = useState(loadStep);

  const form = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      languageStep: {
        language: isLanguage(draft?.languageStep?.language)
          ? draft.languageStep.language
          : state.language,
      },
      accountStep: {
        steamId: draft?.accountStep?.steamId || state.profile?.steamId || '',
      },
      apiKeyStep: {
        apiKey: '',
      },
    },
  });

  useEffect(() => {
    const { unsubscribe } = form.watch((formData, { name }) => {
      saveDraft(formData as OnboardingFormData);

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

  const handleSubmit = form.handleSubmit(async (formData) => {
    const next = await OnboardingService.saveConfig(
      formData.accountStep.steamId,
      formData.apiKeyStep.apiKey,
    );

    if (!next.configured) {
      form.setError('root', { type: 'server', message: 'saveFailed' });
      return;
    }

    clearDraft();
    onDone(next);
  });

  return {
    form,
    initialStep,
    handleSubmit,
    handleStepChange: saveStep,
  };
}
