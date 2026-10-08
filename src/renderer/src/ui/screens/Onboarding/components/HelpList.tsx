import { ExternalLink } from 'lucide-react';

import { Button } from '@ui/primitives/button';

interface IHelpListProps {
  /** With a title the steps fold away under it; without one they are always shown. */
  title?: string;
  items: readonly string[];
  /** Label of the button that opens the page the steps talk about. */
  action: string;
  onAction: () => void;
  open?: boolean;
}

/** Numbered steps for something done outside the app, with a button that opens the place. */
export function HelpList({
  title,
  items,
  action,
  onAction,
  open,
}: IHelpListProps) {
  const steps = (
    <>
      <ol className="my-2 list-decimal space-y-1.5 pl-5">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
      <Button type="button" size="xs" variant="secondary" onClick={onAction}>
        <ExternalLink />
        {action}
      </Button>
    </>
  );

  if (!title) {
    return (
      <div className="bg-card rounded-lg border px-3 py-2 text-sm">{steps}</div>
    );
  }

  return (
    <details
      open={open}
      className="bg-card rounded-lg border px-3 py-2 text-sm"
    >
      <summary className="text-primary hover:text-primary/80 focus-visible:ring-ring rounded-sm outline-none focus-visible:ring-2">
        {title}
      </summary>
      {steps}
    </details>
  );
}
