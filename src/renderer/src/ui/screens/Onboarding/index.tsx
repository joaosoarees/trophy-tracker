import { FormProvider } from 'react-hook-form';

import { useT } from '@app/hooks/useT';
import { type IAppState } from '@shared/types/AppState';
import { WindowBar } from '@ui/components/WindowBar';

import { Stepper } from './components/Stepper';
import { AccountStep } from './steps/AccountStep';
import { DoneStep } from './steps/DoneStep';
import { LanguageStep } from './steps/LanguageStep';
import { useOnboardingController } from './useOnboardingController';

interface IOnboardingProps {
  state: IAppState;
  /** Opened from the app, only to add an account: the language step is left out. */
  isAddingAccount: boolean;
  onDone: (state: IAppState) => void;
  onCancel?: () => void;
}

export function Onboarding({
  state,
  isAddingAccount,
  onDone,
  onCancel,
}: IOnboardingProps) {
  const t = useT();
  const {
    form,
    initialStep,
    saved,
    accounts,
    gamesFound,
    gamesFoundOnOnly,
    isFinishing,
    handleSubmit,
    handleAccountsChange,
    handleStepChange,
  } = useOnboardingController({ state, isAddingAccount, onDone });

  const accountSteps = [
    {
      label: t.onboarding.steps.account,
      content: (
        <AccountStep
          accounts={accounts}
          gamesFound={gamesFound}
          onChange={handleAccountsChange}
          startsOpen={isAddingAccount}
          // Accounts are saved as they are verified: leaving keeps them.
          onCancel={onCancel ? () => onDone(saved) : undefined}
        />
      ),
    },
    {
      label: t.onboarding.steps.done,
      content: (
        <DoneStep
          accounts={accounts}
          gamesFound={gamesFoundOnOnly}
          showLanguage={!isAddingAccount}
          isFinishing={isFinishing}
        />
      ),
    },
  ];

  return (
    <>
      <WindowBar />
      <main className="mx-auto max-w-lg p-5">
        <FormProvider {...form}>
          <form onSubmit={handleSubmit} noValidate>
            <Stepper
              initialStep={initialStep}
              onStepChange={handleStepChange}
              steps={
                isAddingAccount
                  ? accountSteps
                  : [
                      {
                        label: t.onboarding.steps.language,
                        content: <LanguageStep />,
                      },
                      ...accountSteps,
                    ]
              }
            />
          </form>
        </FormProvider>
      </main>
    </>
  );
}
