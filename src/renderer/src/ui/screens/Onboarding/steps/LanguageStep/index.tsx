import { useFormContext } from 'react-hook-form';

import { useT } from '@app/hooks/useT';
import { Label } from '@ui/primitives/label';
import { ControlledLanguageSelect } from '@ui/screens/Onboarding/components/ControlledLanguageSelect';
import { FieldError } from '@ui/screens/Onboarding/components/FieldError';
import { StepHeader } from '@ui/screens/Onboarding/components/StepHeader';
import {
  StepperFooter,
  StepperNextButton,
} from '@ui/screens/Onboarding/components/Stepper';
import { useStepper } from '@ui/screens/Onboarding/components/Stepper/useStepper';
import type { OnboardingFormData } from '@ui/screens/Onboarding/schema';

export function LanguageStep() {
  const t = useT();
  const { nextStep } = useStepper();
  const form = useFormContext<OnboardingFormData>();

  async function handleNextStep() {
    const isValid = await form.trigger('languageStep', { shouldFocus: true });

    if (isValid) {
      nextStep();
    }
  }

  return (
    <div>
      <StepHeader
        title={t.onboarding.language.title}
        description={t.onboarding.language.description}
      />

      <div className="space-y-2">
        <Label>{t.onboarding.language.label}</Label>
        <ControlledLanguageSelect
          control={form.control}
          name="languageStep.language"
        />
        <FieldError name="languageStep.language" />
      </div>

      <div className="mt-5 space-y-2">
        <p>{t.onboarding.language.intro}</p>
        <p>{t.onboarding.language.before}</p>
        <ul className="list-disc space-y-1 pl-5">
          {t.onboarding.language.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="text-muted-foreground">
          {t.onboarding.language.keyStaysLocal}
        </p>
        <p className="text-muted-foreground text-xs">{t.notAffiliated}</p>
      </div>

      <StepperFooter>
        <StepperNextButton onClick={handleNextStep}>
          {t.onboarding.language.start}
        </StepperNextButton>
      </StepperFooter>
    </div>
  );
}
