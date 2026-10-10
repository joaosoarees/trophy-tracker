import { describe, expect, it } from 'vitest';

import {
  createStepperState,
  type IStepperState,
  stepperReducer,
} from './stepperState';

const STEPS = 3;

/** On the first step, with nothing ahead reached. */
const makeState = (props: Partial<IStepperState> = {}): IStepperState => ({
  current: 0,
  furthest: 0,
  direction: 'forward',
  ...props,
});

describe('stepperState', () => {
  describe('createStepperState', () => {
    it.each([
      { initialStep: 1, current: 1 },
      { initialStep: 9, current: 2 },
      { initialStep: -1, current: 0 },
    ])(
      'should start on step $current when given step $initialStep of three',
      ({ initialStep, current }) => {
        const state = createStepperState(initialStep, STEPS);

        expect(state).toEqual({
          current,
          furthest: current,
          direction: 'forward',
        });
      },
    );
  });

  describe('stepperReducer', () => {
    describe('next', () => {
      it('should move forward when there is a step ahead', () => {
        const state = makeState();

        const moved = stepperReducer(state, { type: 'next' }, STEPS);

        expect(moved).toEqual({
          current: 1,
          furthest: 1,
          direction: 'forward',
        });
      });

      it('should keep the state when it is on the last step', () => {
        const state = makeState({ current: 2, furthest: 2 });

        const moved = stepperReducer(state, { type: 'next' }, STEPS);

        expect(moved).toBe(state);
      });
    });

    describe('previous', () => {
      it('should move back, remembering how far the user got, when there is a step behind', () => {
        const state = makeState({ current: 2, furthest: 2 });

        const moved = stepperReducer(state, { type: 'previous' }, STEPS);

        expect(moved).toEqual({
          current: 1,
          furthest: 2,
          direction: 'backward',
        });
      });

      it('should keep the state when it is on the first step', () => {
        const state = makeState();

        const moved = stepperReducer(state, { type: 'previous' }, STEPS);

        expect(moved).toBe(state);
      });
    });

    describe('goTo', () => {
      it('should jump back when the step is behind the current one', () => {
        const state = makeState({ current: 2, furthest: 2 });

        const moved = stepperReducer(state, { type: 'goTo', step: 0 }, STEPS);

        expect(moved).toEqual({
          current: 0,
          furthest: 2,
          direction: 'backward',
        });
      });

      it('should jump forward when the step ahead was already reached', () => {
        const state = makeState({
          current: 0,
          furthest: 2,
          direction: 'backward',
        });

        const moved = stepperReducer(state, { type: 'goTo', step: 2 }, STEPS);

        expect(moved).toEqual({
          current: 2,
          furthest: 2,
          direction: 'forward',
        });
      });

      it('should keep the state when the step was not reached yet', () => {
        const state = makeState({ current: 1, furthest: 1 });

        const moved = stepperReducer(state, { type: 'goTo', step: 2 }, STEPS);

        expect(moved).toBe(state);
      });
    });

    describe('lockFollowing', () => {
      /** Back on the second step after reaching the third, then locked. */
      const makeLockedState = (): IStepperState =>
        stepperReducer(
          makeState({ current: 1, furthest: 2, direction: 'backward' }),
          { type: 'lockFollowing' },
          STEPS,
        );

      it('should make the current step the furthest one when steps ahead were reached', () => {
        const state = makeState({
          current: 1,
          furthest: 2,
          direction: 'backward',
        });

        const locked = stepperReducer(state, { type: 'lockFollowing' }, STEPS);

        expect(locked).toEqual({
          current: 1,
          furthest: 1,
          direction: 'backward',
        });
      });

      it('should refuse a jump to a following step when they were locked again', () => {
        const locked = makeLockedState();

        const moved = stepperReducer(locked, { type: 'goTo', step: 2 }, STEPS);

        expect(moved).toBe(locked);
      });

      it('should keep the earlier steps reachable when the following ones were locked', () => {
        const locked = makeLockedState();

        const moved = stepperReducer(locked, { type: 'goTo', step: 0 }, STEPS);

        expect(moved).toEqual({
          current: 0,
          furthest: 1,
          direction: 'backward',
        });
      });
    });
  });
});
