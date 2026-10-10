import {
  type ComponentPropsWithoutRef,
  createContext,
  type ReactNode,
  useCallback,
  useMemo,
  useReducer,
} from 'react';

import { useT } from '@app/hooks/useT';
import { Pressable } from '@ui/components/Pressable';
import { Button } from '@ui/primitives/button';
import { cn } from '@ui/utils/cn';

import {
  createStepperState,
  type IStepperState,
  type StepperAction,
  stepperReducer,
} from './stepperState';
import { useStepper } from './useStepper';

interface IStepperContextValue {
  previousStep: () => void;
  nextStep: () => void;
  /** Call when the current step changes something the following steps depend on. */
  lockFollowingSteps: () => void;
}

export const StepperContext = createContext({} as IStepperContextValue);

/** A step's name under its bar, whether it can be clicked or not. */
const STEP =
  'text-muted-foreground block w-full border-t-[3px] pt-1.5 text-left text-xs transition-colors duration-200';

interface IStepperProps {
  steps: {
    label: string;
    content: ReactNode;
  }[];
}

export function Stepper({ steps }: IStepperProps) {
  const t = useT();
  const [state, dispatch] = useReducer(
    (current: IStepperState, action: StepperAction) =>
      stepperReducer(current, action, steps.length),
    createStepperState(0, steps.length),
  );

  const { current, furthest, direction } = state;

  const previousStep = useCallback(() => dispatch({ type: 'previous' }), []);
  const nextStep = useCallback(() => dispatch({ type: 'next' }), []);
  const lockFollowingSteps = useCallback(
    () => dispatch({ type: 'lockFollowing' }),
    [],
  );
  const context = useMemo(
    () => ({ previousStep, nextStep, lockFollowingSteps }),
    [previousStep, nextStep, lockFollowingSteps],
  );

  return (
    <StepperContext.Provider value={context}>
      <div>
        {/* With a single step there is nowhere else to be: no bar is drawn. */}
        <ol className={cn('mb-6 flex gap-1.5', steps.length === 1 && 'hidden')}>
          {steps.map((step, index) => {
            const isCurrent = index === current;
            const isReached = index <= furthest;

            return (
              <li key={step.label} className="flex-1">
                {isCurrent ? (
                  // Where the user already is leads nowhere: it is not a button.
                  <span
                    aria-current="step"
                    className={cn(STEP, 'border-primary text-foreground')}
                  >
                    {step.label}
                  </span>
                ) : (
                  // Reached steps can be revisited; the ones ahead stay locked.
                  // The bar and the label change colour and nothing else: no
                  // wash and no push, which read as a box around the label.
                  <Pressable
                    aria-label={t.onboarding.goToStep(step.label)}
                    disabled={!isReached}
                    onClick={() => dispatch({ type: 'goTo', step: index })}
                    className={cn(
                      STEP,
                      'rounded-none active:scale-100',
                      isReached &&
                        'hover:text-foreground hover:border-primary/60',
                      index < current && 'border-success',
                      // Reached but ahead of the current one: the way back forward.
                      index > current && isReached && 'border-success/50',
                    )}
                  >
                    {step.label}
                  </Pressable>
                )}
              </li>
            );
          })}
        </ol>

        <div
          key={current}
          className={
            direction === 'forward'
              ? 'animate-step-forward'
              : 'animate-step-backward'
          }
        >
          {steps[current].content}
        </div>
      </div>
    </StepperContext.Provider>
  );
}

export function StepperFooter({ children }: { children: ReactNode }) {
  return <footer className="mt-6 flex justify-end gap-2">{children}</footer>;
}

export function StepperPreviousButton({
  variant = 'ghost',
  type = 'button',
  onClick,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof Button>) {
  const { previousStep } = useStepper();
  const t = useT();

  return (
    <Button
      variant={variant}
      type={type}
      onClick={onClick ?? previousStep}
      {...props}
    >
      {children ?? t.common.back}
    </Button>
  );
}

export function StepperNextButton({
  type = 'button',
  onClick,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof Button>) {
  const { nextStep } = useStepper();
  const t = useT();

  return (
    <Button type={type} onClick={onClick ?? nextStep} {...props}>
      {children ?? t.common.next}
    </Button>
  );
}
