import { useFormContext } from 'react-hook-form';

import { useT } from '@app/hooks/useT';
import { LANGUAGES } from '@shared/i18n';
import { type IAccount } from '@shared/types/Account';
import { AccountGrid } from '@ui/components/AccountGrid';
import { Button } from '@ui/primitives/button';
import { FieldError } from '@ui/screens/Onboarding/components/FieldError';
import { StepHeader } from '@ui/screens/Onboarding/components/StepHeader';
import {
  StepperFooter,
  StepperPreviousButton,
} from '@ui/screens/Onboarding/components/Stepper';
import { useStepper } from '@ui/screens/Onboarding/components/Stepper/useStepper';
import type { OnboardingFormData } from '@ui/screens/Onboarding/schema';

interface IDoneStepProps {
  /** Every account the app will have: the saved ones and the one just verified. */
  accounts: IAccount[];
  /** Left out when the step was opened only to add an account. */
  showLanguage: boolean;
  isFinishing: boolean;
  /** Saves the verified account and empties the form; answers whether it could. */
  onAddAnother: () => Promise<boolean>;
}

export function DoneStep({
  accounts,
  showLanguage,
  isFinishing,
  onAddAnother,
}: IDoneStepProps) {
  const t = useT();
  const { previousStep } = useStepper();
  const form = useFormContext<OnboardingFormData>();
  const { errors } = form.formState;
  const { languageStep, accountStep } = form.getValues();
  const account = accountStep.verified;

  async function handleAddAnother() {
    if (await onAddAnother()) previousStep();
  }

  return (
    <div>
      <StepHeader
        title={t.onboarding.done.title}
        description={t.onboarding.done.description}
      />

      <section aria-label={t.accounts.title} className="mb-4">
        <AccountGrid
          label={t.accounts.title}
          accounts={accounts}
          activeId={null}
          onAdd={isFinishing ? undefined : () => void handleAddAnother()}
        />
      </section>

      <div className="space-y-2">
        {showLanguage && (
          <p className="text-muted-foreground">
            {t.onboarding.done.language}:{' '}
            {LANGUAGES[languageStep.language].label}
          </p>
        )}
        {account && <p>{t.onboarding.done.found(account.gamesWithPlaytime)}</p>}
        <p>{t.onboarding.done.howItWorks}</p>
      </div>

      {errors.root?.message && (
        <p className="text-destructive mt-3">{t.onboarding.done.saveFailed}</p>
      )}
      <FieldError name="accountStep.verified" />

      <StepperFooter>
        <StepperPreviousButton disabled={isFinishing} />
        <Button type="submit" disabled={isFinishing}>
          {isFinishing ? t.onboarding.done.saving : t.onboarding.done.finish}
        </Button>
      </StepperFooter>
    </div>
  );
}
