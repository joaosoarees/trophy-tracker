import { Search, X } from 'lucide-react';

import { useT } from '@app/hooks/useT';
import { Input } from '@ui/primitives/input';

import { Hint } from './Hint';
import { Pressable } from './Pressable';

interface ISearchBoxProps {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}

export function SearchBox({ value, placeholder, onChange }: ISearchBoxProps) {
  const t = useT();

  return (
    <div className="relative min-w-0 flex-1">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => event.key === 'Escape' && onChange('')}
        className="h-8 pr-7 pl-8 text-sm"
      />
      {value !== '' && (
        <Hint label={t.common.clearSearch}>
          <Pressable
            aria-label={t.common.clearSearch}
            onClick={() => onChange('')}
            className="text-muted-foreground hover:bg-accent hover:text-foreground absolute top-1/2 right-1.5 -translate-y-1/2 p-1"
          >
            <X className="size-3.5" />
          </Pressable>
        </Hint>
      )}
    </div>
  );
}
