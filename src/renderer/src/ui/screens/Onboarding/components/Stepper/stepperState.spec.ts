import { describe, expect, it } from 'vitest';

import {
  createStepperState,
  isBusy,
  type IStepperState,
  type StepperAction,
  stepperReducer,
} from './stepperState';

/** On the first of three steps, with nothing ahead reached. */
const makeState = (props: Partial<IStepperState> = {}): IStepperState => ({
  current: 0,
  furthest: 0,
  direction: 'forward',
  stepCount: 3,
  busyTasks: 0,
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
        busyTasks: 0,
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
          busyTasks: 0,
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
          busyTasks: 0,
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
          busyTasks: 0,
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
          busyTasks: 0,
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
          busyTasks: 0,
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
          busyTasks: 0,
        });
      });
    });

    describe('taskStarted', () => {
      it('should count the task when the current step starts one', () => {
        const state = makeState({ current: 1, furthest: 1 });

        const busy = stepperReducer(state, { type: 'taskStarted' });

        expect(busy).toEqual({
          current: 1,
          furthest: 1,
          direction: 'forward',
          stepCount: 3,
          busyTasks: 1,
        });
      });

      it.each<[string, StepperAction]>([
        ['the next step', { type: 'next' }],
        ['the previous step', { type: 'previous' }],
        ['a step behind', { type: 'goTo', step: 0 }],
        ['a step ahead that was reached', { type: 'goTo', step: 2 }],
      ])(
        'should refuse a move to %s when a task of the current step is running',
        (_where, move) => {
          const busy = makeState({ current: 1, furthest: 2, busyTasks: 1 });

          const moved = stepperReducer(busy, move);

          expect(moved).toBe(busy);
        },
      );

      it('should still lock the following steps when a task of the current step is running', () => {
        const busy = makeState({ current: 1, furthest: 2, busyTasks: 1 });

        const locked = stepperReducer(busy, { type: 'lockFollowing' });

        expect(locked).toEqual({
          current: 1,
          furthest: 1,
          direction: 'forward',
          stepCount: 3,
          busyTasks: 1,
        });
      });
    });

    describe('taskEnded', () => {
      it('should move again when the only task of the current step ended', () => {
        const busy = makeState({ current: 1, furthest: 1, busyTasks: 1 });
        const idle = stepperReducer(busy, { type: 'taskEnded' });

        const moved = stepperReducer(idle, { type: 'previous' });

        expect(moved).toEqual({
          current: 0,
          furthest: 1,
          direction: 'backward',
          stepCount: 3,
          busyTasks: 0,
        });
      });

      it('should still refuse a move when one of two tasks ended', () => {
        const busy = makeState({ current: 1, furthest: 1, busyTasks: 2 });
        const stillBusy = stepperReducer(busy, { type: 'taskEnded' });

        const moved = stepperReducer(stillBusy, { type: 'previous' });

        expect(moved).toBe(stillBusy);
      });

      it('should keep the state when no task is running', () => {
        const state = makeState();

        const ended = stepperReducer(state, { type: 'taskEnded' });

        expect(ended).toBe(state);
      });
    });
  });

  describe('isBusy', () => {
    it('should say the step is busy when one of its tasks is running', () => {
      const state = makeState({ busyTasks: 1 });

      const isStepBusy = isBusy(state);

      expect(isStepBusy).toBe(true);
    });

    it('should say the step is not busy when none of its tasks is running', () => {
      const state = makeState();

      const isStepBusy = isBusy(state);

      expect(isStepBusy).toBe(false);
    });
  });
});
