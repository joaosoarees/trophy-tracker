import { createContext } from 'react';

export interface IStepperContextValue {
  previousStep: () => void;
  nextStep: () => void;
  /** Call when the current step changes something the following steps depend on. */
  lockFollowingSteps: () => void;
}

/** `null` with no `Stepper` above: `useStepper` turns that into an error. */
export const StepperContext = createContext<IStepperContextValue | null>(null);
