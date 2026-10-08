import { useContext } from 'react';

import { StepperContext } from '.';

export function useStepper() {
  return useContext(StepperContext);
}
