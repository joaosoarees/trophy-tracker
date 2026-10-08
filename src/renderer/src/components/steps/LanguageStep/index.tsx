import { useFormContext } from 'react-hook-form';
import type { OnboardingFormData } from '@/Onboarding';
import { ControlledLanguageSelect } from '@/components/ControlledLanguageSelect';
import { FieldError } from '@/components/FieldError';
import { StepHeader } from '@/components/StepHeader';
import { StepperFooter, StepperNextButton } from '@/components/Stepper';
import { useStepper } from '@/components/Stepper/useStepper';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useT } from '@/lib/i18n';

interface ILanguageStepProps {
  /** Why the onboarding showed up again (e.g. the key stopped working). */
  notice: string | null;
  onCancel?: () => void;
}

export function LanguageStep({ notice, onCancel }: ILanguageStepProps) {
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

      {notice && (
        <p className="text-destructive mb-4">
          {t.onboarding.redoNotice(notice)}
        </p>
      )}

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
      </div>

      <StepperFooter>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t.common.cancel}
          </Button>
        )}
        <StepperNextButton onClick={handleNextStep}>
          {t.onboarding.language.start}
        </StepperNextButton>
      </StepperFooter>
    </div>
  );
}
