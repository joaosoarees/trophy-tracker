import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { AccountsService } from '@app/services/AccountsService';
import { OnboardingService } from '@app/services/OnboardingService';
import { type IAccount } from '@shared/types/Account';
import { type IAppState } from '@shared/types/AppState';
import { useStepper } from '@ui/screens/Onboarding/components/Stepper/useStepper';
import { type OnboardingFormData } from '@ui/screens/Onboarding/schema';

/** Where the SteamID in the field came from, which decides how it is presented. */
type SteamIdSource = 'detected' | 'typed';

interface IAccountStepOptions {
  /** The accounts the app already has. */
  accounts: IAccount[];
  /** The step was opened to add an account: its form is what the user came for. */
  isInitiallyOpen: boolean;
  /** Called with the state after an account was saved (its SteamID is given) or removed. */
  onChange: (state: IAppState, added?: string) => void;
}

export function useAccountStepController({
  accounts,
  isInitiallyOpen,
  onChange,
}: IAccountStepOptions) {
  const { lockFollowingSteps } = useStepper();
  const form = useFormContext<OnboardingFormData>();

  // With no account yet the form is the step; afterwards it opens on request.
  const [isFormOpen, setIsFormOpen] = useState(
    accounts.length === 0 || isInitiallyOpen,
  );
  /** Opened with "Add another account": it can be closed again without adding. */
  const [isFormOptional, setIsFormOptional] = useState(false);
  // Only a SteamID found in the Steam client is locked. Anything else in the
  // field was typed by the user, and stays theirs.
  const [source, setSource] = useState<SteamIdSource>('typed');
  const [isEditingSteamId, setIsEditingSteamId] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  /** Steam refused the key or the SteamID. */
  const [problem, setProblem] = useState<string | null>(null);
  /** The key works but Steam does not let the achievements be read. */
  const [privacyProblem, setPrivacyProblem] = useState<string | null>(null);

  // Offer the account signed in to the Steam client, unless the app already
  // has it or something is in the field. Again each time the form opens.
  useEffect(() => {
    if (!isFormOpen) return;
    let isActive = true;

    void OnboardingService.detectSteamId().then((steamId) => {
      if (!isActive || !steamId) return;
      if (accounts.some((account) => account.steamId === steamId)) return;

      const current = form.getValues('accountStep.steamId');
      if (!current) form.setValue('accountStep.steamId', steamId);
      if (!current || current === steamId) setSource('detected');
    });

    return () => {
      isActive = false;
    };
    // Only opening the form asks; the list changing under it does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, isFormOpen]);

  function emptyForm() {
    form.setValue('accountStep.steamId', '');
    form.setValue('accountStep.apiKey', '');
    form.clearErrors('accountStep');
    setSource('typed');
    setIsEditingSteamId(false);
    setProblem(null);
    setPrivacyProblem(null);
  }

  /**
   * The key alone does not say whose it is, so both are checked together.
   * An account Steam accepts is saved right away and joins the list.
   */
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
    if (!privacy.ok) {
      setIsVerifying(false);
      setPrivacyProblem(privacy.error);
      return;
    }

    const next = await OnboardingService.addAccount(steamId, apiKey);
    setIsVerifying(false);
    onChange(next, steamId.trim());
    emptyForm();
    setIsFormOpen(false);
    setIsFormOptional(false);
  }

  async function handleRemove(steamId: string) {
    const next = await AccountsService.remove(steamId);
    onChange(next);
    if (next.accounts.length > 0) return;
    // Back to the beginning: there is nothing for the next step to show.
    lockFollowingSteps();
    setIsFormOpen(true);
  }

  function handleOpenForm() {
    emptyForm();
    setIsFormOpen(true);
    setIsFormOptional(true);
  }

  function handleCloseForm() {
    emptyForm();
    setIsFormOpen(false);
    setIsFormOptional(false);
  }

  function handleEditSteamId() {
    setIsEditingSteamId(true);
    setSource('typed');
    form.setFocus('accountStep.steamId');
  }

  return {
    form,
    isFormOpen,
    isFormOptional,
    isVerifying,
    problem,
    privacyProblem,
    steamIdSource: source,
    // Locked while it is the account found in the Steam client.
    isSteamIdLocked: source !== 'typed' && !isEditingSteamId,
    handleVerify: () => void handleVerify(),
    handleRemove: (steamId: string) => void handleRemove(steamId),
    handleOpenForm,
    handleCloseForm,
    handleEditSteamId,
  };
}
