import { type ReactNode } from 'react';

import { cn } from '@ui/utils/cn';

interface ISegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: ISegmentedProps<T>) {
  return (
    <div className="bg-muted inline-flex rounded-md p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors',
            option.value === value
              ? 'bg-accent text-accent-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
