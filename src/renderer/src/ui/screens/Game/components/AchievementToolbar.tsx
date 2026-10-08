import { useT } from '@app/hooks/useT';
import { SearchBox } from '@ui/components/SearchBox';
import { Segmented } from '@ui/components/Segmented';

import { type Filter, type Sort, SORTS } from '../achievementList';

interface IAchievementToolbarProps {
  filter: Filter;
  sort: Sort;
  query: string;
  pending: number;
  unlocked: number;
  onFilterChange: (filter: Filter) => void;
  onSortChange: (sort: Sort) => void;
  onQueryChange: (query: string) => void;
}

export function AchievementToolbar({
  filter,
  sort,
  query,
  pending,
  unlocked,
  onFilterChange,
  onSortChange,
  onQueryChange,
}: IAchievementToolbarProps) {
  const t = useT();

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Segmented<Filter>
        value={filter}
        onChange={onFilterChange}
        options={[
          { value: 'pending', label: t.game.pending(pending) },
          { value: 'unlocked', label: t.game.unlocked(unlocked) },
        ]}
      />
      <span className="flex-1" />
      {filter === 'pending' && (
        <select
          value={sort}
          onChange={(event) => onSortChange(event.target.value as Sort)}
          className="bg-muted text-foreground h-8 rounded-md border px-2 text-xs"
        >
          {SORTS.map((value) => (
            <option key={value} value={value}>
              {t.game.sort[value]}
            </option>
          ))}
        </select>
      )}
      <div className="flex basis-full">
        <SearchBox
          value={query}
          onChange={onQueryChange}
          placeholder={t.game.search}
        />
      </div>
    </div>
  );
}
