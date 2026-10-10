import { createContext } from 'react';

export interface IStepperContextValue {
  previousStep: () => void;
  nextStep: () => void;
  /** Call when the current step changes something the following steps depend on. */
  lockFollowingSteps: () => void;
  /**
   * Runs what the current step asks for and waits on (an account being
   * verified, the setup ending). No move is taken until it is answered or
   * fails: the step would be gone when its answer arrives. Pass every such
   * call through here instead of telling the stepper when it starts and ends.
   */
  whileBusy: (task: () => Promise<void>) => Promise<void>;
}

/**
 * What a step can ask of the stepper: the same four functions for as long as
 * the `Stepper` lives, so reading them never redraws a step. `null` with no
 * `Stepper` above: `useStepper` turns that into an error.
 */
export const StepperContext = createContext<IStepperContextValue | null>(null);

/**
 * Whether a task of the current step is running. Kept out of
 * `StepperContext`, whose readers would all redraw as it changes: only the
 * stepper's own buttons read it.
 */
export const StepperBusyContext = createContext(false);
