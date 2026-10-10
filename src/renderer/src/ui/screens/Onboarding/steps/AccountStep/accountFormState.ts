/**
 * What is known of the account signed in to the Steam client, which decides
 * how the SteamID field is presented.
 */
type SteamIdDetection =
  /** Asked for, and not answered yet. */
  | 'pending'
  /** Nobody is signed in to the Steam client. */
  | 'none'
  /** Found, and it is what the field holds: the field is locked. */
  | 'inField'
  /** Found, but the field is the user's: typed, or the app already has that account. */
  | 'setAside';

export interface IAccountFormState {
  /** With no account yet the form is the step; afterwards it opens on request. */
  isOpen: boolean;
  /** Opened with "Add another account": it can be closed again without adding. */
  isOptional: boolean;
  detection: SteamIdDetection;
}

export type AccountFormAction =
  /** "Add another account". */
  | { type: 'opened' }
  /** The form was cancelled, or its account was verified and joined the list. */
  | { type: 'closed' }
  /** There is no account left: the step is back to its beginning. */
  | { type: 'lastAccountRemoved' }
  /** The Steam client answered who is signed in to it (`steamId`), if anyone. */
  | {
      type: 'detected';
      steamId: string | null;
      /** The app already has that account. */
      isSaved: boolean;
      /** What the SteamID field held as the answer arrived. */
      typed: string;
    }
  /** "Use another account": the SteamID that was found is given up. */
  | { type: 'steamIdEdited' };

interface IAccountFormOptions {
  hasAccounts: boolean;
  /** The step was opened to add an account: its form is what the user came for. */
  isInitiallyOpen: boolean;
}

export function createAccountFormState({
  hasAccounts,
  isInitiallyOpen,
}: IAccountFormOptions): IAccountFormState {
  return {
    isOpen: !hasAccounts || isInitiallyOpen,
    isOptional: false,
    detection: 'pending',
  };
}

/** The account found in the Steam client is asked for while this is true. */
export function isDetecting(state: IAccountFormState): boolean {
  return state.isOpen && state.detection === 'pending';
}

export function accountFormReducer(
  state: IAccountFormState,
  action: AccountFormAction,
): IAccountFormState {
  switch (action.type) {
    case 'opened':
      // Each opening asks again who is signed in to the Steam client.
      return { isOpen: true, isOptional: true, detection: 'pending' };
    case 'closed':
      return { isOpen: false, isOptional: false, detection: 'pending' };
    case 'lastAccountRemoved':
      // Whatever the form was, it is the first account's again: required,
      // and offered the account of the Steam client anew.
      return { isOpen: true, isOptional: false, detection: 'pending' };
    case 'detected': {
      // An answer nobody is waiting for: the form was closed, or was answered.
      if (!isDetecting(state)) return state;
      if (action.steamId === null) return { ...state, detection: 'none' };

      // Only a SteamID found in the Steam client is locked. Anything else in
      // the field was typed by the user, and stays theirs.
      const isInField =
        !action.isSaved &&
        (action.typed === '' || action.typed === action.steamId);

      return { ...state, detection: isInField ? 'inField' : 'setAside' };
    }
    case 'steamIdEdited':
      return state.detection === 'inField'
        ? { ...state, detection: 'setAside' }
        : state;
  }
}
