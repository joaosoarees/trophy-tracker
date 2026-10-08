import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { OnboardingService } from '@app/services/OnboardingService';
import { type IProfile } from '@shared/types/Profile';
import { useStepper } from '@ui/screens/Onboarding/components/Stepper/useStepper';
import { type OnboardingFormData } from '@ui/screens/Onboarding/schema';

export function useAccountStepController() {
  const { nextStep } = useStepper();
  const form = useFormContext<OnboardingFormData>();
  const [detected, setDetected] = useState(false);
  const [profile, setProfile] = useState<IProfile | null>(null);
  /** Why Steam did not confirm the profile; it does not block moving on. */
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Fill in the account signed in to the Steam client, without overwriting what was already typed.
  useEffect(() => {
    let active = true;

    void OnboardingService.detectSteamId().then((steamId) => {
      if (!active || !steamId) return;

      setDetected(true);
      if (!form.getValues('accountStep.steamId')) {
        form.setValue('accountStep.steamId', steamId);
      }
    });

    return () => {
      active = false;
    };
  }, [form]);

  // The SteamID changed: the previous confirmation no longer holds.
  useEffect(() => {
    const { unsubscribe } = form.watch((_formData, { name }) => {
      if (name === 'accountStep.steamId') {
        setProfile(null);
        setUnconfirmed(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [form]);

  async function handleVerify() {
    const isValid = await form.trigger('accountStep', { shouldFocus: true });
    if (!isValid) return;

    setIsVerifying(true);
    setUnconfirmed(null);
    const result = await OnboardingService.checkSteamId(
      form.getValues('accountStep.steamId'),
    );
    setIsVerifying(false);

    if (result.status === 'found') {
      setProfile(result.profile);
    } else if (result.status === 'unconfirmed') {
      setUnconfirmed(result.reason);
    } else {
      form.setError(
        'accountStep.steamId',
        { type: 'validate', message: result.error },
        { shouldFocus: true },
      );
    }
  }

  return {
    form,
    nextStep,
    detected,
    profile,
    unconfirmed,
    isVerifying,
    handleVerify,
  };
}
