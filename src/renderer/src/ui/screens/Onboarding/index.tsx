import { FormProvider } from 'react-hook-form';

import { useT } from '@app/hooks/useT';
import { type IAppState } from '@shared/types/AppState';

import { Stepper } from './components/Stepper';
import { AccountStep } from './steps/AccountStep';
import { ApiKeyStep } from './steps/ApiKeyStep';
import { DoneStep } from './steps/DoneStep';
import { LanguageStep } from './steps/LanguageStep';
import { PrivacyStep } from './steps/PrivacyStep';
import { useOnboardingController } from './useOnboardingController';

interface IOnboardingProps {
  state: IAppState;
  onDone: (state: IAppState) => void;
  onCancel?: () => void;
}

export function Onboarding({ state, onDone, onCancel }: IOnboardingProps) {
  const t = useT();
  const { form, initialStep, handleSubmit, handleStepChange } =
    useOnboardingController(state, onDone);

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
