export interface IStepperState {
  current: number;
  /** Last step the user has reached; steps beyond it are still locked. */
  furthest: number;
  /** Which way the last move went, for the transition. */
  direction: 'forward' | 'backward';
  /** How many steps there are; no move leaves them. */
  stepCount: number;
  /**
   * How many tasks of the current step are running (an account being
   * verified, the setup ending). The step is not left while there is one:
   * its answer would arrive with nobody to show it.
   */
  busyTasks: number;
}

export type StepperAction =
  | { type: 'next' }
  | { type: 'previous' }
  /** Jump to a step from the indicator; ignored when the step is still locked. */
  | { type: 'goTo'; step: number }
  /** Something on the current step changed and what comes after must be redone. */
  | { type: 'lockFollowing' }
  /** The current step asked for something and waits for the answer. */
  | { type: 'taskStarted' }
  /** A task of the current step was answered, or failed. */
  | { type: 'taskEnded' };

/** On the first step, with nothing ahead reached and nothing running. */
export function createStepperState(stepCount: number): IStepperState {
  return {
    current: 0,
    furthest: 0,
    direction: 'forward',
    stepCount,
    busyTasks: 0,
  };
}

/** Whether a task of the current step is running: no move is taken then. */
export function isBusy(state: IStepperState): boolean {
  return state.busyTasks > 0;
}

export function stepperReducer(
  state: IStepperState,
  action: StepperAction,
): IStepperState {
  const moveTo = (step: number): IStepperState => {
    if (isBusy(state)) return state;
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
    case 'taskStarted':
      return { ...state, busyTasks: state.busyTasks + 1 };
    case 'taskEnded':
      return isBusy(state)
        ? { ...state, busyTasks: state.busyTasks - 1 }
        : state;
  }
}
