import { useCallback, useEffect, useRef, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { OnboardingService } from '@app/services/OnboardingService';
import { type OnboardingFormData } from '@ui/screens/Onboarding/schema';

export function usePrivacyStepController() {
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
    const result = await OnboardingService.checkPrivacy(
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

  return { isTesting, verified, problem, test };
}
