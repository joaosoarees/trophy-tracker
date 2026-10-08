import { ExternalLink } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { useT } from '@app/hooks/useT';
import { Button } from '@ui/primitives/button';
import type { OnboardingFormData } from '@ui/screens/Onboarding';
import { StepHeader } from '@ui/screens/Onboarding/components/StepHeader';
import {
  StepperFooter,
  StepperNextButton,
  StepperPreviousButton,
} from '@ui/screens/Onboarding/components/Stepper';

export function PrivacyStep() {
  const t = useT();
  const form = useFormContext<OnboardingFormData>();
  const gamesWithPlaytime = useWatch({
    control: form.control,
    name: 'privacyStep.gamesWithPlaytime',
  });
  const [isTesting, setIsTesting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const started = useRef(false);

  const test = useCallback(async () => {
    setIsTesting(true);
    setProblem(null);
    const { accountStep, apiKeyStep } = form.getValues();
    const result = await window.api.checkPrivacy(
      accountStep.steamId.trim(),
      apiKeyStep.apiKey,
    );
    setIsTesting(false);

    if (result.ok) {
      form.setValue(
        'privacyStep.gamesWithPlaytime',
        result.value.gamesWithPlaytime,
        { shouldValidate: true },
      );
    } else {
      form.resetField('privacyStep.gamesWithPlaytime');
      setProblem(result.error);
    }
  }, [form]);

  // Runs the test on its own when the step opens, unless it has already passed.
  useEffect(() => {
    if (
      started.current ||
      form.getValues('privacyStep.gamesWithPlaytime') !== undefined
    )
      return;
    started.current = true;
    void test();
  }, [form, test]);

  const verified = gamesWithPlaytime !== undefined && !isTesting;

  return (
    <div>
      <StepHeader
        title={t.onboarding.privacy.title}
        description={t.onboarding.privacy.description}
      />

      {isTesting && <p>{t.onboarding.privacy.testing}</p>}
      {verified && <p className="text-success">{t.onboarding.privacy.ok}</p>}

      {!isTesting && problem && (
        <>
          <p className="text-destructive">{problem}</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            {t.onboarding.privacy.steps.map((item, index) => (
              <li key={item}>
                {item}
                {index === 0 && (
                  <>
                    {' '}
                    <Button
                      type="button"
                      size="xs"
                      variant="secondary"
                      onClick={() => void window.api.openExternal('privacy')}
                    >
                      <ExternalLink />
                      {t.common.openInBrowser}
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ol>
        </>
      )}

      <StepperFooter>
        <StepperPreviousButton disabled={isTesting} />
        {verified ? (
          <StepperNextButton />
        ) : (
          <StepperNextButton disabled={isTesting} onClick={() => void test()}>
            {t.onboarding.privacy.testAgain}
          </StepperNextButton>
        )}
      </StepperFooter>
    </div>
  );
}
