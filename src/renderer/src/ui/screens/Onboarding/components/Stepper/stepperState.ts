export interface IStepperState {
  current: number;
  /** Last step the user has reached; steps beyond it are still locked. */
  furthest: number;
  /** Which way the last move went, for the transition. */
  direction: 'forward' | 'backward';
  /** How many steps there are; no move leaves them. */
  stepCount: number;
}

export type StepperAction =
  | { type: 'next' }
  | { type: 'previous' }
  /** Jump to a step from the indicator; ignored when the step is still locked. */
  | { type: 'goTo'; step: number }
  /** Something on the current step changed and what comes after must be redone. */
  | { type: 'lockFollowing' };

/** On the first step, with nothing ahead reached. */
export function createStepperState(stepCount: number): IStepperState {
  return { current: 0, furthest: 0, direction: 'forward', stepCount };
}

export function stepperReducer(
  state: IStepperState,
  action: StepperAction,
): IStepperState {
  const moveTo = (step: number): IStepperState => {
    const current = Math.min(Math.max(0, step), state.stepCount - 1);
    if (current === state.current) return state;

    return {
      ...state,
      current,
      furthest: Math.max(state.furthest, current),
      direction: current < state.current ? 'backward' : 'forward',
    };
  };

  switch (action.type) {
    case 'next':
      return moveTo(state.current + 1);
    case 'previous':
      return moveTo(state.current - 1);
    case 'goTo':
      return action.step <= state.furthest ? moveTo(action.step) : state;
    case 'lockFollowing':
      return state.furthest === state.current
        ? state
        : { ...state, furthest: state.current };
  }
}
