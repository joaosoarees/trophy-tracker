import { Check } from 'lucide-react';
import {
  useController,
  type Control,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';

import { LANGUAGE_CODES, LANGUAGES } from '@shared/i18n';
import { Pressable } from '@ui/components/Pressable';
import { cn } from '@ui/utils/cn';

interface IControlledLanguageSelectProps<T extends FieldValues> {
  control?: Control<T>;
  name: FieldPath<T>;
}

export function ControlledLanguageSelect<T extends FieldValues>({
  control,
  name,
}: IControlledLanguageSelectProps<T>) {
  const { field } = useController({ name, control });

  return (
    <div role="radiogroup" ref={field.ref} className="grid grid-cols-2 gap-2">
      {LANGUAGE_CODES.map((code) => {
        const selected = field.value === code;
        return (
          <Pressable
            key={code}
            role="radio"
            aria-checked={selected}
            name={field.name}
            disabled={field.disabled}
            onBlur={field.onBlur}
            onClick={() => field.onChange(code)}
            className={cn(
              'bg-card active:bg-accent/70 flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left active:scale-[0.99]',
              selected
                ? 'border-primary text-foreground hover:bg-accent/30'
                : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground',
            )}
          >
            {LANGUAGES[code].label}
            {selected && <Check className="text-primary size-4" />}
          </Pressable>
        );
      })}
    </div>
  );
}
