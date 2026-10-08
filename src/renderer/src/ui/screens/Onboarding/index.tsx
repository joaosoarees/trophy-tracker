import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { z } from 'zod';

import { useT } from '@app/hooks/useT';
import { safeSessionStorageGetItem } from '@app/lib/safeSessionStorageGetItem';
import { OnboardingService } from '@app/services/OnboardingService';
import { SettingsService } from '@app/services/SettingsService';
import { useStore } from '@app/store';
import { isLanguage } from '@shared/i18n';
import type { IAppState } from '@shared/types';

import { Stepper } from './components/Stepper';
import { AccountStep } from './steps/AccountStep';
import { accountStepSchema } from './steps/AccountStep/schema';
import { ApiKeyStep } from './steps/ApiKeyStep';
import { apiKeyStepSchema } from './steps/ApiKeyStep/schema';
import { DoneStep } from './steps/DoneStep';
import { LanguageStep } from './steps/LanguageStep';
import { languageStepSchema } from './steps/LanguageStep/schema';
import { PrivacyStep } from './steps/PrivacyStep';
import { privacyStepSchema } from './steps/PrivacyStep/schema';

const schema = z.object({
  languageStep: languageStepSchema,
  accountStep: accountStepSchema,
  apiKeyStep: apiKeyStepSchema,
  privacyStep: privacyStepSchema,
});

export type OnboardingFormData = z.infer<typeof schema>;

/** The draft survives a reload, but never stores the Web API key. */
type Draft = Pick<OnboardingFormData, 'languageStep' | 'accountStep'>;

const DRAFT_KEY = 'onboarding-form';
const STEP_KEY = 'onboarding-step';
const API_KEY_STEP = 2;

interface IOnboardingProps {
  state: IAppState;
  onDone: (state: IAppState) => void;
  onCancel?: () => void;
}

export function Onboarding({ state, onDone, onCancel }: IOnboardingProps) {
  const t = useT();
  const setLanguage = useStore((store) => store.session.setLanguage);

  const draft = safeSessionStorageGetItem<Draft>(DRAFT_KEY);
  const form = useForm<OnboardingFormData>({
    resolver: zodResolver(schema),
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
      const { languageStep, accountStep } = formData;
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ languageStep, accountStep }),
      );

      // Picking the language switches the screen right away, with no reload.
      if (
        name === 'languageStep.language' &&
        isLanguage(languageStep?.language)
      ) {
        setLanguage(languageStep.language);
        void SettingsService.setLanguage(languageStep.language);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [form, setLanguage]);

  const handleStepChange = useCallback((step: number) => {
    sessionStorage.setItem(STEP_KEY, String(step));
  }, []);

  const handleSubmit = form.handleSubmit(async (formData) => {
    const next = await OnboardingService.saveConfig(
      formData.accountStep.steamId,
      formData.apiKeyStep.apiKey,
    );

    if (!next.configured) {
      form.setError('root', { type: 'server', message: 'saveFailed' });
      return;
    }

    sessionStorage.removeItem(DRAFT_KEY);
    sessionStorage.removeItem(STEP_KEY);
    onDone(next);
  });

  // After a reload the key is gone, so the form cannot resume past the key step.
  const savedStep = Number(sessionStorage.getItem(STEP_KEY) ?? 0);
  const initialStep = Math.min(
    Number.isInteger(savedStep) ? savedStep : 0,
    API_KEY_STEP,
  );

  return (
    <div className="mx-auto max-w-lg p-5">
      <FormProvider {...form}>
        <form onSubmit={handleSubmit} noValidate>
          <Stepper
            initialStep={initialStep}
            onStepChange={handleStepChange}
            steps={[
              {
                label: t.onboarding.steps.language,
                content: (
                  <LanguageStep
                    notice={state.configError}
                    onCancel={onCancel}
                  />
                ),
              },
              {
                label: t.onboarding.steps.account,
                content: <AccountStep />,
              },
              {
                label: t.onboarding.steps.apiKey,
                content: <ApiKeyStep />,
              },
              {
                label: t.onboarding.steps.privacy,
                content: <PrivacyStep />,
              },
              {
                label: t.onboarding.steps.done,
                content: <DoneStep />,
              },
            ]}
          />
        </form>
      </FormProvider>
    </div>
  );
}
