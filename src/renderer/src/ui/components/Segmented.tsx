import { type ReactNode } from 'react';

import { cn } from '@ui/utils/cn';

import { Pressable } from './Pressable';

interface ISegmentedProps<T extends string> {
  /** What is being chosen, for assistive technology. */
  label: string;
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: ISegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="bg-muted inline-flex rounded-md p-0.5"
    >
      {options.map((option) => (
        <Pressable
          key={option.value}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-[5px] px-2.5 py-1 text-xs font-medium',
            option.value === value
              ? 'bg-accent text-accent-foreground hover:bg-accent/80'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
          )}
        >
          {option.label}
        </Pressable>
      ))}
    </div>
  );
}
