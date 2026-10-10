import { describe, expect, it } from 'vitest';

import {
  createStepperState,
  type IStepperState,
  stepperReducer,
} from './stepperState';

/** On the first of three steps, with nothing ahead reached. */
const makeState = (props: Partial<IStepperState> = {}): IStepperState => ({
  current: 0,
  furthest: 0,
  direction: 'forward',
  stepCount: 3,
  ...props,
});

describe('stepperState', () => {
  describe('createStepperState', () => {
    it('should start on the first step, with nothing ahead reached, when given the number of steps', () => {
      const stepCount = 3;

      const state = createStepperState(stepCount);

      expect(state).toEqual({
        current: 0,
        furthest: 0,
        direction: 'forward',
        stepCount: 3,
      });
    });
  });

  describe('stepperReducer', () => {
    describe('next', () => {
      it('should move forward when there is a step ahead', () => {
        const state = makeState();

        const moved = stepperReducer(state, { type: 'next' });

        expect(moved).toEqual({
          current: 1,
          furthest: 1,
          direction: 'forward',
          stepCount: 3,
        });
      });

      it('should keep the state when it is on the last step', () => {
        const state = makeState({ current: 2, furthest: 2 });

        const moved = stepperReducer(state, { type: 'next' });

        expect(moved).toBe(state);
      });
    });

    describe('previous', () => {
      it('should move back, remembering how far the user got, when there is a step behind', () => {
        const state = makeState({ current: 2, furthest: 2 });

        const moved = stepperReducer(state, { type: 'previous' });

        expect(moved).toEqual({
          current: 1,
          furthest: 2,
          direction: 'backward',
          stepCount: 3,
        });
      });

      it('should keep the state when it is on the first step', () => {
        const state = makeState();

        const moved = stepperReducer(state, { type: 'previous' });

        expect(moved).toBe(state);
      });
    });

    describe('goTo', () => {
      it('should jump back when the step is behind the current one', () => {
        const state = makeState({ current: 2, furthest: 2 });

        const moved = stepperReducer(state, { type: 'goTo', step: 0 });

        expect(moved).toEqual({
          current: 0,
          furthest: 2,
          direction: 'backward',
          stepCount: 3,
        });
      });

      it('should jump forward when the step ahead was already reached', () => {
        const state = makeState({
          current: 0,
          furthest: 2,
          direction: 'backward',
        });

        const moved = stepperReducer(state, { type: 'goTo', step: 2 });

        expect(moved).toEqual({
          current: 2,
          furthest: 2,
          direction: 'forward',
          stepCount: 3,
        });
      });

      it('should keep the state when the step was not reached yet', () => {
        const state = makeState({ current: 1, furthest: 1 });

        const moved = stepperReducer(state, { type: 'goTo', step: 2 });

        expect(moved).toBe(state);
      });
    });

    describe('lockFollowing', () => {
      /** Back on the second step after reaching the third, then locked. */
      const makeLockedState = (): IStepperState =>
        stepperReducer(
          makeState({ current: 1, furthest: 2, direction: 'backward' }),
          { type: 'lockFollowing' },
        );

      it('should make the current step the furthest one when steps ahead were reached', () => {
        const state = makeState({
          current: 1,
          furthest: 2,
          direction: 'backward',
        });

        const locked = stepperReducer(state, { type: 'lockFollowing' });

        expect(locked).toEqual({
          current: 1,
          furthest: 1,
          direction: 'backward',
          stepCount: 3,
        });
      });

      it('should keep the state when no step ahead was reached', () => {
        const state = makeState({ current: 1, furthest: 1 });

        const locked = stepperReducer(state, { type: 'lockFollowing' });

        expect(locked).toBe(state);
      });

      it('should refuse a jump to a following step when they were locked again', () => {
        const locked = makeLockedState();

        const moved = stepperReducer(locked, { type: 'goTo', step: 2 });

        expect(moved).toBe(locked);
      });

      it('should keep the earlier steps reachable when the following ones were locked', () => {
        const locked = makeLockedState();

        const moved = stepperReducer(locked, { type: 'goTo', step: 0 });

        expect(moved).toEqual({
          current: 0,
          furthest: 1,
          direction: 'backward',
          stepCount: 3,
        });
      });
    });
  });
});
