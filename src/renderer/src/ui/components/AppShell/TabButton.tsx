import { type ReactNode } from 'react';

import { Pressable } from '@ui/components/Pressable';
import { cn } from '@ui/utils/cn';

interface ITabButtonProps {
  isActive: boolean;
  onClick: () => void;
  children: ReactNode;
}

export function TabButton({ isActive, onClick, children }: ITabButtonProps) {
  return (
    <Pressable
      aria-current={isActive ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        '-mb-px flex items-center gap-1.5 rounded-t-md rounded-b-none border-b-2 px-2.5 pt-2 pb-2 text-sm font-medium active:scale-[0.98] [&_svg]:size-4',
        isActive
          ? 'border-primary text-foreground hover:bg-accent/30'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground border-transparent',
      )}
    >
      {children}
    </Pressable>
  );
}
