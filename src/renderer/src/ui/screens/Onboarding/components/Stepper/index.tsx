import {
  createContext,
  useCallback,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';

import { useT } from '@app/hooks/useT';
import { Button } from '@ui/primitives/button';
import { cn } from '@ui/utils/cn';

import { useStepper } from './useStepper';

interface IStepperContextValue {
  previousStep: () => void;
  nextStep: () => void;
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
  const [currentStep, setCurrentStep] = useState(
    Math.min(Math.max(0, initialStep), steps.length - 1),
  );

  // Which way the last move went, so the new step slides in from that side.
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  const goTo = useCallback(
    (step: number) => {
      const next = Math.min(Math.max(0, step), steps.length - 1);
      setDirection(next < currentStep ? 'backward' : 'forward');
      setCurrentStep(next);
      onStepChange?.(next);
    },
    [steps.length, onStepChange, currentStep],
  );
  const previousStep = useCallback(
    () => goTo(currentStep - 1),
    [goTo, currentStep],
  );
  const nextStep = useCallback(
    () => goTo(currentStep + 1),
    [goTo, currentStep],
  );

  return (
    <StepperContext.Provider value={{ previousStep, nextStep }}>
      <div>
        <ol className="mb-6 flex gap-1.5">
          {steps.map((step, index) => (
            <li
              key={step.label}
              aria-current={index === currentStep ? 'step' : undefined}
              className={cn(
                'text-muted-foreground flex-1 border-t-[3px] pt-1.5 text-xs transition-colors duration-200',
                index === currentStep && 'border-primary text-foreground',
                index < currentStep && 'border-success',
              )}
            >
              {step.label}
            </li>
          ))}
        </ol>

        <div
          key={currentStep}
          className={
            direction === 'forward'
              ? 'animate-step-forward'
              : 'animate-step-backward'
          }
        >
          {steps[currentStep].content}
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
