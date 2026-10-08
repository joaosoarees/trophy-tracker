import { type ReactNode, useEffect, useState } from 'react';

import { cn } from '@ui/utils/cn';

/** The length of the `collapsible` transition in `styles/index.css`, plus a frame. */
const CLOSE_MS = 200;

interface ICollapsibleProps {
  open: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * A section that grows to its height when it opens and shrinks back when it
 * closes. Closed, it is not in the page at all: it stays mounted only for as
 * long as the closing transition takes, which is what lets an exit be
 * animated without keeping every closed section alive.
 */
export function Collapsible({ open, children, className }: ICollapsibleProps) {
  const [isRendered, setIsRendered] = useState(open);
  // Opening has to render in the same pass, so it is derived, not an effect.
  if (open && !isRendered) setIsRendered(true);

  useEffect(() => {
    if (open) return;
    // A timer rather than `transitionend`: the transition does not run when
    // the section is inside a hidden tab, and the section must still go.
    const timer = setTimeout(() => setIsRendered(false), CLOSE_MS);
    return () => clearTimeout(timer);
  }, [open]);

  if (!isRendered) return null;

  return (
    <div
      data-open={open}
      // Closing content is on its way out: not reachable while it leaves.
      inert={!open}
      className={cn('collapsible', className)}
    >
      {children}
    </div>
  );
}
