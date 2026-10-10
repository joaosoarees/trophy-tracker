import {
  type KeyboardEvent,
  useEffect,
  useEffectEvent,
  useReducer,
  useState,
} from 'react';
import { useFormContext } from 'react-hook-form';

import { singleFlight } from '@app/lib/singleFlight';
import { AccountsService } from '@app/services/AccountsService';
import { OnboardingService } from '@app/services/OnboardingService';
import { type IAccount } from '@shared/types/Account';
import { type IAppState } from '@shared/types/AppState';
import { useStepper } from '@ui/screens/Onboarding/components/Stepper/useStepper';
import { type OnboardingFormData } from '@ui/screens/Onboarding/schema';

import {
  accountFormReducer,
  createAccountFormState,
  isDetecting,
} from './accountFormState';

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

  // Whether the form is open, whether it can be closed, and what is known of
  // the Steam client's account change together: one reducer holds the three.
  const [formState, dispatch] = useReducer(
    accountFormReducer,
    { hasAccounts: accounts.length > 0, isInitiallyOpen },
    createAccountFormState,
  );
  const [isVerifying, setIsVerifying] = useState(false);
  // One check at a time. The buttons are disabled by `isVerifying`, but Enter
  // held down in a field asks again before that is drawn, and nothing in a
  // render can tell it: the guard is kept outside of them.
  const [verifyOnce] = useState(singleFlight);
  /** Steam refused the key or the SteamID. */
  const [problem, setProblem] = useState<string | null>(null);
  /** The key works but Steam does not let the achievements be read. */
  const [privacyProblem, setPrivacyProblem] = useState<string | null>(null);

  // Offer the account signed in to the Steam client, unless the app already
  // has it or something else is in the field. It reads the accounts and the
  // field as they are when the answer arrives, without asking again for them.
  const offerDetected = useEffectEvent((steamId: string | null) => {
    const isSaved = accounts.some((account) => account.steamId === steamId);
    const typed = form.getValues('accountStep.steamId');
    if (steamId && !isSaved && !typed) {
      form.setValue('accountStep.steamId', steamId);
    }
    dispatch({ type: 'detected', steamId, isSaved, typed });
  });

  // Asked each time the form opens, and again when the step goes back to its
  // beginning: the list changing under an open form does not ask.
  const isAskingSteamClient = isDetecting(formState);
  useEffect(() => {
    if (!isAskingSteamClient) return;
    let isActive = true;

    void OnboardingService.detectSteamId().then((steamId) => {
      if (isActive) offerDetected(steamId);
    });

    return () => {
      isActive = false;
    };
  }, [isAskingSteamClient]);

  function emptyForm() {
    form.setValue('accountStep.steamId', '');
    form.setValue('accountStep.apiKey', '');
    form.clearErrors('accountStep');
    setProblem(null);
    setPrivacyProblem(null);
  }

  /**
   * The key alone does not say whose it is, so both are checked together.
   * An account Steam accepts is saved right away and joins the list.
   */
  async function verify() {
    const isValid = await form.trigger(
      ['accountStep.steamId', 'accountStep.apiKey'],
      { shouldFocus: true },
    );
    if (!isValid) return;

    setIsVerifying(true);
    setProblem(null);
    setPrivacyProblem(null);
    const { steamId, apiKey } = form.getValues('accountStep');

    // A call that fails must not leave the buttons disabled for good.
    try {
      const account = await OnboardingService.checkApiKey(steamId, apiKey);
      if (!account.ok) {
        setProblem(account.error);
        return;
      }

      const privacy = await OnboardingService.checkPrivacy(steamId, apiKey);
      if (!privacy.ok) {
        setPrivacyProblem(privacy.error);
        return;
      }

      // Checked once more as it is saved. A refusal here is not a state to
      // take: the form stays as it is, with the reason.
      const added = await OnboardingService.addAccount(steamId, apiKey);
      if (!added.ok) {
        setProblem(added.error);
        return;
      }

      onChange(added.value, steamId.trim());
      emptyForm();
      dispatch({ type: 'closed' });
    } finally {
      setIsVerifying(false);
    }
  }

  function handleVerify() {
    void verifyOnce(verify);
  }

  /** Enter in a field checks the account instead of submitting the whole form. */
  function handleEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    handleVerify();
  }

  async function handleRemove(steamId: string) {
    const next = await AccountsService.remove(steamId);
    onChange(next);
    if (next.accounts.length > 0) return;
    // Back to the beginning: there is nothing for the next step to show.
    lockFollowingSteps();
    emptyForm();
    dispatch({ type: 'lastAccountRemoved' });
  }

  function handleOpenForm() {
    emptyForm();
    dispatch({ type: 'opened' });
  }

  function handleCloseForm() {
    emptyForm();
    dispatch({ type: 'closed' });
  }

  function handleEditSteamId() {
    dispatch({ type: 'steamIdEdited' });
    form.setFocus('accountStep.steamId');
  }

  return {
    form,
    isFormOpen: formState.isOpen,
    isFormOptional: formState.isOptional,
    isVerifying,
    problem,
    privacyProblem,
    // Locked while it is the account found in the Steam client.
    isSteamIdLocked: formState.detection === 'inField',
    /** Nobody is signed in to the Steam client: the SteamID has to be typed. */
    isSteamIdNotFound: formState.detection === 'none',
    handleVerify,
    handleEnter,
    handleRemove: (steamId: string) => void handleRemove(steamId),
    handleOpenForm,
    handleCloseForm,
    handleEditSteamId,
  };
}
