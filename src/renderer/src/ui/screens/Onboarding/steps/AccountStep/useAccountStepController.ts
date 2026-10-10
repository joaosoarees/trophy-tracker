import {
  type KeyboardEvent,
  useEffect,
  useEffectEvent,
  useReducer,
  useState,
} from 'react';
import { useFormContext } from 'react-hook-form';

import { useT } from '@app/hooks/useT';
import { explainFailedCall } from '@app/lib/failedCall';
import { singleFlight } from '@app/lib/singleFlight';
import { OnboardingService } from '@app/services/OnboardingService';
import { useStore } from '@app/store';
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
  /** Ends the setup, or the visit that added an account. */
  onFinish: () => Promise<void>;
}

export function useAccountStepController({
  accounts,
  isInitiallyOpen,
  onChange,
  onFinish,
}: IAccountStepOptions) {
  const t = useT();
  const { lockFollowingSteps, whileBusy } = useStepper();
  const form = useFormContext<OnboardingFormData>();
  const removeStepAccount = useStore(
    (store) => store.settings.removeStepAccount,
  );

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
  const [isFinishing, setIsFinishing] = useState(false);
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
    } catch (error) {
      // Not an answer of Steam, which the checks give as a result: a call
      // itself failed. It is said where a refusal is, with the form as it was.
      setProblem(explainFailedCall(error, t));
    } finally {
      setIsVerifying(false);
    }
  }

  // The step is not left while it waits for an answer: each call that waits
  // goes through the stepper (`whileBusy`), which takes no move until it ends.
  function handleVerify() {
    void verifyOnce(() => whileBusy(verify));
  }

  /** Enter in a field checks the account instead of submitting the whole form. */
  function handleEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    handleVerify();
  }

  async function handleRemove(steamId: string) {
    // A call that fails is said by the store, in a toast: the X has no line
    // of its own. The list then follows what the main process was left with.
    const next = await removeStepAccount(steamId);
    if (!next) return;
    onChange(next);
    if (next.accounts.length > 0) return;
    // Back to the beginning: there is nothing for the next step to show.
    lockFollowingSteps();
    emptyForm();
    dispatch({ type: 'lastAccountRemoved' });
  }

  function handleFinish() {
    setIsFinishing(true);
    void whileBusy(onFinish).finally(() => setIsFinishing(false));
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
    /** The setup is ending: nothing else can be asked for meanwhile. */
    isFinishing,
    problem,
    privacyProblem,
    // Locked while it is the account found in the Steam client.
    isSteamIdLocked: formState.detection === 'inField',
    /** Nobody is signed in to the Steam client: the SteamID has to be typed. */
    isSteamIdNotFound: formState.detection === 'none',
    handleVerify,
    handleEnter,
    handleRemove: (steamId: string) =>
      void whileBusy(() => handleRemove(steamId)),
    handleFinish,
    handleOpenForm,
    handleCloseForm,
    handleEditSteamId,
  };
}
