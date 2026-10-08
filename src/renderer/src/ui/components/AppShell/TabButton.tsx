import { type ReactNode } from 'react';

import { cn } from '@ui/utils/cn';

interface ITabButtonProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

export function TabButton({ active, onClick, children }: ITabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        '-mb-px flex items-center gap-1.5 border-b-2 px-2.5 pt-2 pb-2 text-sm font-medium transition-colors [&_svg]:size-4',
        active
          ? 'border-primary text-foreground'
          : 'text-muted-foreground hover:text-foreground border-transparent',
      )}
    >
      {children}
    </button>
  );
}
