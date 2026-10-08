import {
  type ComponentPropsWithoutRef,
  createContext,
  type ReactNode,
  useCallback,
  useEffect,
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

interface IStepperProps {
  initialStep?: number;
  steps: {
    label: string;
    content: ReactNode;
  }[];
  onStepChange?: (step: number) => void;
}

export function Stepper({
  steps,
  initialStep = 0,
  onStepChange,
}: IStepperProps) {
  const t = useT();
  const [state, dispatch] = useReducer(
    (current: IStepperState, action: StepperAction) =>
      stepperReducer(current, action, steps.length),
    createStepperState(initialStep, steps.length),
  );

  const { current, furthest, direction } = state;

  useEffect(() => {
    onStepChange?.(current);
  }, [current, onStepChange]);

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
        <ol className="mb-6 flex gap-1.5">
          {steps.map((step, index) => {
            const isCurrent = index === current;
            const isReached = index <= furthest;

            return (
              <li key={step.label} className="flex-1">
                {/* Reached steps can be revisited; the ones ahead stay locked. */}
                <Pressable
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={
                    isCurrent ? undefined : t.onboarding.goToStep(step.label)
                  }
                  disabled={!isReached}
                  onClick={() => dispatch({ type: 'goTo', step: index })}
                  className={cn(
                    'text-muted-foreground w-full rounded-none border-t-[3px] pt-1.5 text-left text-xs duration-200 active:scale-100',
                    isReached &&
                      !isCurrent &&
                      'hover:text-foreground active:text-primary',
                    isCurrent && 'border-primary text-foreground',
                    index < current && 'border-success',
                    // Reached but ahead of the current one: the way back forward.
                    index > current && isReached && 'border-success/50',
                  )}
                >
                  {step.label}
                </Pressable>
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
