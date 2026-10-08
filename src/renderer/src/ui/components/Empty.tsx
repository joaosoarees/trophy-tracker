import { type ReactNode } from 'react';

interface IEmptyProps {
  children: ReactNode;
}

/** Centered placeholder for a screen or list with nothing to show. */
export function Empty({ children }: IEmptyProps) {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-3 px-6 py-12 text-center">
      {children}
    </div>
  );
}
