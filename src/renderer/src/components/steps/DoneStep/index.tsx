import { useFormContext } from 'react-hook-form';

import { FieldError } from '@/components/FieldError';
import { StepHeader } from '@/components/StepHeader';
import { StepperFooter, StepperPreviousButton } from '@/components/Stepper';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n';
import type { OnboardingFormData } from '@/Onboarding';

export function DoneStep() {
  const t = useT();
  const form = useFormContext<OnboardingFormData>();
  const { isSubmitting, errors } = form.formState;
  const games = form.getValues('privacyStep.gamesWithPlaytime') ?? 0;

  return (
    <div>
      <StepHeader
        title={t.onboarding.done.title}
        description={t.onboarding.done.description}
      />

      <div className="space-y-2">
        <p>{t.onboarding.done.found(games)}</p>
        <p>{t.onboarding.done.howItWorks}</p>
      </div>

      {errors.root?.message && (
        <p className="text-destructive mt-3">{t.onboarding.done.saveFailed}</p>
      )}
      <FieldError name="privacyStep.gamesWithPlaytime" />

      <StepperFooter>
        <StepperPreviousButton disabled={isSubmitting} />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t.onboarding.done.saving : t.onboarding.done.finish}
        </Button>
      </StepperFooter>
    </div>
  );
}
