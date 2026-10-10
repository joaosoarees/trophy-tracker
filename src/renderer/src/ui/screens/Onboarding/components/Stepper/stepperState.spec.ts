import { describe, expect, it } from 'vitest';

import {
  createStepperState,
  type IStepperState,
  type StepperAction,
  stepperReducer,
} from '@ui/screens/Onboarding/components/Stepper/stepperState';

const STEPS = 3;
const run = (state: IStepperState, ...actions: StepperAction[]) =>
  actions.reduce(
    (current, action) => stepperReducer(current, action, STEPS),
    state,
  );
const start = createStepperState(0, STEPS);

describe('stepperReducer', () => {
  it('starts on the given step, inside the range, with nothing ahead reached', () => {
    expect(start).toEqual({ current: 0, furthest: 0, direction: 'forward' });
    expect(createStepperState(9, STEPS)).toMatchObject({
      current: 2,
      furthest: 2,
    });
  });

  it('moves forward and back, remembering how far the user got', () => {
    const state = run(
      start,
      { type: 'next' },
      { type: 'next' },
      { type: 'previous' },
    );
    expect(state).toEqual({ current: 1, furthest: 2, direction: 'backward' });
  });

  it('does not move past the first or the last step', () => {
    expect(run(start, { type: 'previous' })).toBe(start);
    const end = run(start, { type: 'next' }, { type: 'next' });
    expect(run(end, { type: 'next' })).toBe(end);
  });

  it('jumps to any step already reached, in either direction', () => {
    const reached = run(start, { type: 'next' }, { type: 'next' });
    const back = run(reached, { type: 'goTo', step: 0 });
    expect(back).toEqual({ current: 0, furthest: 2, direction: 'backward' });
    expect(run(back, { type: 'goTo', step: 2 })).toEqual({
      current: 2,
      furthest: 2,
      direction: 'forward',
    });
  });

  it('refuses to jump to a step that was not reached yet', () => {
    const state = run(start, { type: 'next' });
    expect(run(state, { type: 'goTo', step: 2 })).toBe(state);
  });

  it('locks the following steps again when the current one is changed', () => {
    const reached = run(
      start,
      { type: 'next' },
      { type: 'next' },
      { type: 'previous' },
    );
    const locked = run(reached, { type: 'lockFollowing' });
    expect(locked).toMatchObject({ current: 1, furthest: 1 });
    expect(run(locked, { type: 'goTo', step: 2 })).toBe(locked);
    // Earlier steps stay reachable.
    expect(run(locked, { type: 'goTo', step: 0 }).current).toBe(0);
  });
});
