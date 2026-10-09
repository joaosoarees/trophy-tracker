import { useEffect, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { OnboardingService } from '@app/services/OnboardingService';
import { useStepper } from '@ui/screens/Onboarding/components/Stepper/useStepper';
import { type OnboardingFormData } from '@ui/screens/Onboarding/schema';

/** Where the SteamID in the field came from, which decides how it is presented. */
type SteamIdSource = 'detected' | 'saved' | 'typed';

export function useAccountStepController(savedSteamId: string | null) {
  const { nextStep, lockFollowingSteps } = useStepper();
  const form = useFormContext<OnboardingFormData>();
  const verified = useWatch({
    control: form.control,
    name: 'accountStep.verified',
  });

  // Only the account the app is already set up with starts locked, like a
  // detected one. Anything else in the field was typed by the user (and kept
  // by the draft), and stays theirs to edit.
  const [source, setSource] = useState<SteamIdSource>(() =>
    savedSteamId !== null &&
    form.getValues('accountStep.steamId') === savedSteamId
      ? 'saved'
      : 'typed',
  );
  const [isEditingSteamId, setIsEditingSteamId] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  /** Steam refused the key or the SteamID. */
  const [problem, setProblem] = useState<string | null>(null);
  /** The key works but Steam does not let the achievements be read. */
  const [privacyProblem, setPrivacyProblem] = useState<string | null>(null);

  // Fill in the account signed in to the Steam client, without overwriting what is already there.
  useEffect(() => {
    let active = true;

    void OnboardingService.detectSteamId().then((steamId) => {
      if (!active || !steamId) return;

      const current = form.getValues('accountStep.steamId');
      if (!current) form.setValue('accountStep.steamId', steamId);
      if (!current || current === steamId) setSource('detected');
    });

    return () => {
      active = false;
    };
  }, [form]);

  /** The key alone does not say whose it is, so both are checked together. */
  async function handleVerify() {
    const isValid = await form.trigger(
      ['accountStep.steamId', 'accountStep.apiKey'],
      { shouldFocus: true },
    );
    if (!isValid) return;

    setIsVerifying(true);
    setProblem(null);
    setPrivacyProblem(null);
    const { steamId, apiKey } = form.getValues('accountStep');

    const account = await OnboardingService.checkApiKey(steamId, apiKey);
    if (!account.ok) {
      setIsVerifying(false);
      setProblem(account.error);
      return;
    }

    const privacy = await OnboardingService.checkPrivacy(steamId, apiKey);
    setIsVerifying(false);
    if (!privacy.ok) {
      setPrivacyProblem(privacy.error);
      return;
    }

    form.setValue(
      'accountStep.verified',
      {
        name: account.value.name,
        avatar: account.value.avatar,
        gamesWithPlaytime: privacy.value.gamesWithPlaytime,
      },
      { shouldValidate: true },
    );
  }

  /** Unlocks the fields. What was verified no longer holds, and neither do the steps after this one. */
  function handleChange() {
    // The value was never typed into a field, so it is removed rather than reset.
    form.unregister('accountStep.verified');
    setProblem(null);
    setPrivacyProblem(null);
    lockFollowingSteps();
  }

  function handleEditSteamId() {
    setIsEditingSteamId(true);
    setSource('typed');
    form.setFocus('accountStep.steamId');
  }

  const isVerified = verified !== undefined;

  return {
    form,
    verified,
    isVerified,
    isVerifying,
    problem,
    privacyProblem,
    steamIdSource: source,
    // Locked while it is the detected or saved account, and once verified.
    isSteamIdLocked: isVerified || (source !== 'typed' && !isEditingSteamId),
    handleVerify: () => void handleVerify(),
    handleChange,
    handleEditSteamId,
    handleNext: nextStep,
  };
}
