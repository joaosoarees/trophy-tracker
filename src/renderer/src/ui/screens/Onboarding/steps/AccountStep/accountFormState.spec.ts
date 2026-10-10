import { describe, expect, it } from 'vitest';

import { STEAM_ID } from '@tests/helpers';

import {
  accountFormReducer,
  createAccountFormState,
  type IAccountFormState,
  isDetecting,
} from './accountFormState';

/** The step as it starts with no account: the form is all there is. */
const INITIAL: IAccountFormState = {
  isOpen: true,
  isOptional: false,
  detection: 'pending',
};

/** The form of the first account, waiting to hear of the Steam client. */
const makeState = (
  props: Partial<IAccountFormState> = {},
): IAccountFormState => ({ ...INITIAL, ...props });

describe('accountFormState', () => {
  describe('createAccountFormState', () => {
    it('should start with the required form open when there is no account yet', () => {
      const state = createAccountFormState({
        hasAccounts: false,
        isInitiallyOpen: false,
      });

      expect(state).toEqual(INITIAL);
    });

    it('should start with the form closed when there are accounts', () => {
      const state = createAccountFormState({
        hasAccounts: true,
        isInitiallyOpen: false,
      });

      expect(state).toEqual({
        isOpen: false,
        isOptional: false,
        detection: 'pending',
      });
    });

    it('should start with the required form open when the step was opened to add an account', () => {
      const state = createAccountFormState({
        hasAccounts: true,
        isInitiallyOpen: true,
      });

      expect(state).toEqual(INITIAL);
    });
  });

  describe('isDetecting', () => {
    it('should ask for the account of the Steam client when the form is open and was not answered', () => {
      const state = makeState();

      const isAsking = isDetecting(state);

      expect(isAsking).toBe(true);
    });

    it('should not ask when the form is closed', () => {
      const state = makeState({ isOpen: false });

      const isAsking = isDetecting(state);

      expect(isAsking).toBe(false);
    });

    it.each(['none', 'inField', 'setAside'] as const)(
      'should not ask again when the answer was "%s"',
      (detection) => {
        const state = makeState({ detection });

        const isAsking = isDetecting(state);

        expect(isAsking).toBe(false);
      },
    );
  });

  describe('accountFormReducer', () => {
    describe('opened', () => {
      it('should open the form as one that can be closed again, asking anew, when another account is to be added', () => {
        const state = makeState({ isOpen: false, detection: 'setAside' });

        const opened = accountFormReducer(state, { type: 'opened' });

        expect(opened).toEqual({
          isOpen: true,
          isOptional: true,
          detection: 'pending',
        });
      });
    });

    describe('closed', () => {
      it('should put the form away and forget what was found when it is closed', () => {
        const state = makeState({ isOptional: true, detection: 'inField' });

        const closed = accountFormReducer(state, { type: 'closed' });

        expect(closed).toEqual({
          isOpen: false,
          isOptional: false,
          detection: 'pending',
        });
      });
    });

    describe('lastAccountRemoved', () => {
      it('should go back to the required form, asking anew, when the last account is removed with "Add another account" open', () => {
        const state = makeState({ isOptional: true, detection: 'setAside' });

        const removed = accountFormReducer(state, {
          type: 'lastAccountRemoved',
        });

        expect(removed).toEqual(INITIAL);
      });

      it('should open the required form when the last account is removed with the form closed', () => {
        const state = makeState({ isOpen: false });

        const removed = accountFormReducer(state, {
          type: 'lastAccountRemoved',
        });

        expect(removed).toEqual(INITIAL);
      });
    });

    describe('detected', () => {
      it('should lock the SteamID when the one found goes into an empty field', () => {
        const state = makeState();

        const answered = accountFormReducer(state, {
          type: 'detected',
          steamId: STEAM_ID,
          isSaved: false,
          typed: '',
        });

        expect(answered).toEqual(makeState({ detection: 'inField' }));
      });

      it('should lock the SteamID when the one found is what was typed', () => {
        const state = makeState();

        const answered = accountFormReducer(state, {
          type: 'detected',
          steamId: STEAM_ID,
          isSaved: false,
          typed: STEAM_ID,
        });

        expect(answered).toEqual(makeState({ detection: 'inField' }));
      });

      it('should leave the field to the user when something else was typed', () => {
        const state = makeState();

        const answered = accountFormReducer(state, {
          type: 'detected',
          steamId: STEAM_ID,
          isSaved: false,
          typed: '7656',
        });

        expect(answered).toEqual(makeState({ detection: 'setAside' }));
      });

      it('should not offer the account found when the app already has it', () => {
        const state = makeState({ isOptional: true });

        const answered = accountFormReducer(state, {
          type: 'detected',
          steamId: STEAM_ID,
          isSaved: true,
          typed: '',
        });

        expect(answered).toEqual(
          makeState({ isOptional: true, detection: 'setAside' }),
        );
      });

      it('should say that nothing was found when nobody is signed in to the Steam client', () => {
        const state = makeState();

        const answered = accountFormReducer(state, {
          type: 'detected',
          steamId: null,
          isSaved: false,
          typed: '',
        });

        expect(answered).toEqual(makeState({ detection: 'none' }));
      });

      it('should keep the state when the answer arrives with the form closed', () => {
        const state = makeState({ isOpen: false });

        const answered = accountFormReducer(state, {
          type: 'detected',
          steamId: STEAM_ID,
          isSaved: false,
          typed: '',
        });

        expect(answered).toBe(state);
      });

      it('should keep the state when a second answer arrives after the SteamID found was given up', () => {
        const state = makeState({ detection: 'setAside' });

        const answered = accountFormReducer(state, {
          type: 'detected',
          steamId: STEAM_ID,
          isSaved: false,
          typed: '',
        });

        expect(answered).toBe(state);
      });
    });

    describe('steamIdEdited', () => {
      it('should unlock the SteamID, still knowing one was found, when another account is to be used', () => {
        const state = makeState({ detection: 'inField' });

        const edited = accountFormReducer(state, { type: 'steamIdEdited' });

        expect(edited).toEqual(makeState({ detection: 'setAside' }));
      });

      it('should keep the state when no SteamID is locked', () => {
        const state = makeState({ detection: 'none' });

        const edited = accountFormReducer(state, { type: 'steamIdEdited' });

        expect(edited).toBe(state);
      });
    });
  });
});
