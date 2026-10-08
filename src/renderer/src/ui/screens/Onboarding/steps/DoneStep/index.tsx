import { useFormContext } from 'react-hook-form';

import { useT } from '@app/hooks/useT';
import { LANGUAGES } from '@shared/i18n';
import { Button } from '@ui/primitives/button';
import { FieldError } from '@ui/screens/Onboarding/components/FieldError';
import { StepHeader } from '@ui/screens/Onboarding/components/StepHeader';
import {
  StepperFooter,
  StepperPreviousButton,
} from '@ui/screens/Onboarding/components/Stepper';
import type { OnboardingFormData } from '@ui/screens/Onboarding/schema';

export function DoneStep() {
  const t = useT();
  const form = useFormContext<OnboardingFormData>();
  const { isSubmitting, errors } = form.formState;
  const { languageStep, accountStep } = form.getValues();
  const account = accountStep.verified;

  return (
    <div>
      <StepHeader
        title={t.onboarding.done.title}
        description={t.onboarding.done.description}
      />

      <dl className="bg-card mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border p-3">
        <dt className="text-muted-foreground">{t.onboarding.done.language}</dt>
        <dd>{LANGUAGES[languageStep.language].label}</dd>
        <dt className="text-muted-foreground">{t.onboarding.done.account}</dt>
        <dd className="truncate">{account?.name || accountStep.steamId}</dd>
      </dl>

      <div className="space-y-2">
        <p>{t.onboarding.done.found(account?.gamesWithPlaytime ?? 0)}</p>
        <p>{t.onboarding.done.howItWorks}</p>
      </div>

      {errors.root?.message && (
        <p className="text-destructive mt-3">{t.onboarding.done.saveFailed}</p>
      )}
      <FieldError name="accountStep.verified" />

      <StepperFooter>
        <StepperPreviousButton disabled={isSubmitting} />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t.onboarding.done.saving : t.onboarding.done.finish}
        </Button>
      </StepperFooter>
    </div>
  );
}
