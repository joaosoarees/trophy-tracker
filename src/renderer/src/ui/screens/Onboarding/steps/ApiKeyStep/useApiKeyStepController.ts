import { useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { OnboardingService } from '@app/services/OnboardingService';
import { useStepper } from '@ui/screens/Onboarding/components/Stepper/useStepper';
import { type OnboardingFormData } from '@ui/screens/Onboarding/schema';

export function useApiKeyStepController() {
  const { nextStep } = useStepper();
  const form = useFormContext<OnboardingFormData>();
  const [isVerifying, setIsVerifying] = useState(false);

  async function handleNextStep() {
    const isValid = await form.trigger('apiKeyStep', { shouldFocus: true });
    if (!isValid) return;

    setIsVerifying(true);
    const { accountStep, apiKeyStep } = form.getValues();
    const result = await OnboardingService.checkApiKey(
      accountStep.steamId.trim(),
      apiKeyStep.apiKey,
    );
    setIsVerifying(false);

    if (!result.ok) {
      form.setError(
        'apiKeyStep.apiKey',
        { type: 'validate', message: result.error },
        { shouldFocus: true },
      );
      return;
    }

    // New key: privacy has to be checked again with it.
    form.resetField('privacyStep.gamesWithPlaytime');
    nextStep();
  }

  return { form, isVerifying, handleNextStep };
}
