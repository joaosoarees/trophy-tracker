import { Eye, EyeOff } from 'lucide-react';
import { type ComponentProps, useState } from 'react';

import { useT } from '@app/hooks/useT';
import { Input } from '@ui/primitives/input';
import { cn } from '@ui/utils/cn';

import { IconButton } from './IconButton';

/**
 * Where a Web API key is typed or pasted: hidden by default, in the
 * monospaced face so 32 characters can be checked by eye once shown. Only a
 * key being typed can be shown; a saved one never comes back to the screen.
 */
export function KeyField({
  className,
  readOnly,
  ...props
}: Omit<ComponentProps<'input'>, 'type'>) {
  const t = useT();
  const [isShown, setIsShown] = useState(false);

  return (
    <div className="relative">
      <Input
        type={isShown ? 'text' : 'password'}
        autoComplete="off"
        spellCheck={false}
        readOnly={readOnly}
        className={cn(
          // The hint is a sentence, not a key: it keeps the interface face.
          'pr-10 font-mono placeholder:font-sans',
          readOnly && 'bg-muted',
          className,
        )}
        {...props}
      />
      {!readOnly && (
        <IconButton
          type="button"
          label={isShown ? t.accounts.hideKey : t.accounts.showKey}
          aria-pressed={isShown}
          className="absolute top-1/2 right-0.5 -translate-y-1/2"
          onClick={() => setIsShown((shown) => !shown)}
        >
          {isShown ? <EyeOff /> : <Eye />}
        </IconButton>
      )}
    </div>
  );
}
