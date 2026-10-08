import { type ReactNode } from 'react';

import { Pressable } from '@ui/components/Pressable';
import { cn } from '@ui/utils/cn';

interface ITabButtonProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

export function TabButton({ active, onClick, children }: ITabButtonProps) {
  return (
    <Pressable
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        '-mb-px flex items-center gap-1.5 rounded-t-md rounded-b-none border-b-2 px-2.5 pt-2 pb-2 text-sm font-medium [&_svg]:size-4',
        active
          ? 'border-primary text-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground border-transparent',
      )}
    >
      {children}
    </Pressable>
  );
}
