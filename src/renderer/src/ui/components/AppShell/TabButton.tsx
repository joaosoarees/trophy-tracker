import { type ReactNode } from 'react';

import { Pressable } from '@ui/components/Pressable';
import { cn } from '@ui/utils/cn';

interface ITabButtonProps {
  isActive: boolean;
  /** The first tab of the bar: it reaches the window's edge where the system draws no buttons there. */
  isFirst?: boolean;
  onClick: () => void;
  children: ReactNode;
}

export function TabButton({
  isActive,
  isFirst = false,
  onClick,
  children,
}: ITabButtonProps) {
  return (
    <Pressable
      aria-current={isActive ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        '-mb-px flex items-center gap-1.5 rounded-t-md rounded-b-none border-b-2 px-2.5 pt-2 pb-2 text-sm font-medium active:scale-[0.98] [&_svg]:size-4',
        // Its icon stands on the page's margin, and no rounded corner shows
        // the bar through at the corner of the window.
        isFirst && 'rounded-tl-none pl-4',
        isActive
          ? 'border-primary text-foreground hover:bg-accent/30'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground border-transparent',
      )}
    >
      {children}
    </Pressable>
  );
}
