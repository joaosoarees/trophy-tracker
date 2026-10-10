import { FormProvider } from 'react-hook-form';

import { useT } from '@app/hooks/useT';
import { type IAppState } from '@shared/types/AppState';
import { WindowBar } from '@ui/components/WindowBar';

import { Stepper } from './components/Stepper';
import { AccountStep } from './steps/AccountStep';
import { LanguageStep } from './steps/LanguageStep';
import { useOnboardingController } from './useOnboardingController';

interface IOnboardingProps {
  state: IAppState;
  /** Opened from the app, only to add an account: the language step is left out. */
  isAddingAccount: boolean;
  onDone: () => void;
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
    accounts,
    addedHere,
    isFinishing,
    handleSubmit,
    handleAccountsChange,
  } = useOnboardingController({ state, isAddingAccount, onDone });

  const accountStep = {
    label: t.onboarding.steps.account,
    content: (
      <AccountStep
        accounts={accounts}
        addedHere={addedHere}
        onChange={handleAccountsChange}
        isInitiallyOpen={isAddingAccount}
        isFinishing={isFinishing}
        // Accounts are saved as they are verified: leaving keeps them.
        onCancel={onCancel}
      />
    ),
  };

  return (
    <>
      <WindowBar />
      <main className="mx-auto max-w-lg p-5">
        <FormProvider {...form}>
          <form onSubmit={handleSubmit} noValidate>
            <Stepper
              steps={
                isAddingAccount
                  ? [accountStep]
                  : [
                      {
                        label: t.onboarding.steps.language,
                        content: <LanguageStep />,
                      },
                      accountStep,
                    ]
              }
            />
          </form>
        </FormProvider>
      </main>
    </>
  );
}
