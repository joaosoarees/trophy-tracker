import { useContext } from 'react';

import { StepperContext } from './StepperContext';

export function useStepper() {
  const stepper = useContext(StepperContext);

  if (!stepper) {
    throw new Error('Cannot use `useStepper` outside `Stepper`.');
  }

  return stepper;
}
