import { useFormContext } from 'react-hook-form';

import { useT } from '@app/hooks/useT';
import { LANGUAGES } from '@shared/i18n';
import { type IAccount } from '@shared/types/Account';
import { Button } from '@ui/primitives/button';
import { StepHeader } from '@ui/screens/Onboarding/components/StepHeader';
import {
  StepperFooter,
  StepperPreviousButton,
} from '@ui/screens/Onboarding/components/Stepper';
import type { OnboardingFormData } from '@ui/screens/Onboarding/schema';

interface IDoneStepProps {
  accounts: IAccount[];
  /** Played games found on the only account, when it was verified in this visit. */
  gamesFound: number | null;
  /** Left out when the step was opened only to add an account. */
  showLanguage: boolean;
  isFinishing: boolean;
}

/** The summary of what was set up, and the way into the app. Nothing is decided here. */
export function DoneStep({
  accounts,
  gamesFound,
  showLanguage,
  isFinishing,
}: IDoneStepProps) {
  const t = useT();
  const form = useFormContext<OnboardingFormData>();
  const { languageStep } = form.getValues();

  return (
    <div>
      <StepHeader
        title={t.onboarding.done.title}
        description={t.onboarding.done.description}
      />

      <dl className="bg-card mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border p-3">
        {showLanguage && (
          <>
            <dt className="text-muted-foreground">
              {t.onboarding.done.language}
            </dt>
            <dd>{LANGUAGES[languageStep.language].label}</dd>
          </>
        )}
        <dt className="text-muted-foreground">{t.accounts.title}</dt>
        <dd className="min-w-0">
          {accounts
            .map((account) => account.name || account.steamId)
            .join(', ')}
        </dd>
      </dl>

      <div className="space-y-2">
        {gamesFound !== null && <p>{t.onboarding.done.found(gamesFound)}</p>}
        <p>{t.onboarding.done.howItWorks}</p>
      </div>

      <StepperFooter>
        <StepperPreviousButton disabled={isFinishing} />
        <Button type="submit" disabled={isFinishing}>
          {isFinishing ? t.onboarding.done.saving : t.onboarding.done.finish}
        </Button>
      </StepperFooter>
    </div>
  );
}
