import { type ComponentProps, type ReactElement } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui/primitives/tooltip';

interface IHintProps {
  /** What the tooltip says. */
  label: string;
  side?: ComponentProps<typeof TooltipContent>['side'];
  /** The element being explained: one element that takes a ref (a button, a link, a `span`). */
  children: ReactElement;
}

/** A tooltip that shows on hover and on keyboard focus, unlike the native `title`. */
export function Hint({ label, side = 'bottom', children }: IHintProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
