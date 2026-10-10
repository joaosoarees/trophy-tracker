import {
  type ComponentPropsWithoutRef,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useReducer,
} from 'react';

import { useT } from '@app/hooks/useT';
import { Pressable } from '@ui/components/Pressable';
import { Button } from '@ui/primitives/button';
import { cn } from '@ui/utils/cn';

import { StepperBusyContext, StepperContext } from './StepperContext';
import { createStepperState, isBusy, stepperReducer } from './stepperState';
import { useStepper } from './useStepper';

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
  // How many steps there are is part of the state, counted as it is born.
  const [state, dispatch] = useReducer(
    stepperReducer,
    steps.length,
    createStepperState,
  );

  const { current, furthest, direction } = state;
  const isStepBusy = isBusy(state);

  const previousStep = useCallback(() => dispatch({ type: 'previous' }), []);
  const nextStep = useCallback(() => dispatch({ type: 'next' }), []);
  const lockFollowingSteps = useCallback(
    () => dispatch({ type: 'lockFollowing' }),
    [],
  );
  // The stepper is told by the call itself, not by the step: a task that
  // fails, or whose step is gone by then, still ends.
  const whileBusy = useCallback(async (task: () => Promise<void>) => {
    dispatch({ type: 'taskStarted' });
    try {
      await task();
    } finally {
      dispatch({ type: 'taskEnded' });
    }
  }, []);
  const context = useMemo(
    () => ({ previousStep, nextStep, lockFollowingSteps, whileBusy }),
    [previousStep, nextStep, lockFollowingSteps, whileBusy],
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
                  // Reached steps can be revisited; the ones ahead stay locked,
                  // and so does every one while the current step is busy.
                  // The bar and the label change colour and nothing else: no
                  // wash and no push, which read as a box around the label.
                  <Pressable
                    aria-label={t.onboarding.goToStep(step.label)}
                    disabled={!isReached || isStepBusy}
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

        <StepperBusyContext.Provider value={isStepBusy}>
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
        </StepperBusyContext.Provider>
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
  disabled = false,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof Button>) {
  const { previousStep } = useStepper();
  const isStepBusy = useContext(StepperBusyContext);
  const t = useT();

  return (
    <Button
      variant={variant}
      type={type}
      onClick={onClick ?? previousStep}
      // A busy step is not left, whatever the button was given to do.
      disabled={disabled || isStepBusy}
      {...props}
    >
      {children ?? t.common.back}
    </Button>
  );
}

export function StepperNextButton({
  type = 'button',
  onClick,
  disabled = false,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof Button>) {
  const { nextStep } = useStepper();
  const isStepBusy = useContext(StepperBusyContext);
  const t = useT();

  return (
    <Button
      type={type}
      onClick={onClick ?? nextStep}
      disabled={disabled || isStepBusy}
      {...props}
    >
      {children ?? t.common.next}
    </Button>
  );
}
