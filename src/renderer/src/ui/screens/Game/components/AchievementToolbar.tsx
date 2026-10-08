import { EyeOff } from 'lucide-react';

import { useT } from '@app/hooks/useT';
import {
  type AchievementFilter,
  type AchievementSort,
  SORTS_BY_FILTER,
} from '@shared/achievementSort';
import { SearchBox } from '@ui/components/SearchBox';
import { Segmented } from '@ui/components/Segmented';
import { Button } from '@ui/primitives/button';

interface IAchievementToolbarProps {
  filter: AchievementFilter;
  /** The order chosen for the list being shown. */
  sort: AchievementSort;
  query: string;
  pending: number;
  unlocked: number;
  hiddenOnly: boolean;
  /** Hidden achievements in the list being shown. */
  hiddenCount: number;
  onFilterChange: (filter: AchievementFilter) => void;
  onHiddenOnlyToggle: () => void;
  onSortChange: (sort: AchievementSort) => void;
  onQueryChange: (query: string) => void;
}

export function AchievementToolbar({
  filter,
  sort,
  query,
  pending,
  unlocked,
  hiddenOnly,
  hiddenCount,
  onFilterChange,
  onHiddenOnlyToggle,
  onSortChange,
  onQueryChange,
}: IAchievementToolbarProps) {
  const t = useT();

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Segmented<AchievementFilter>
        value={filter}
        onChange={onFilterChange}
        options={[
          { value: 'pending', label: t.game.pending(pending) },
          { value: 'unlocked', label: t.game.unlocked(unlocked) },
        ]}
      />
      <Button
        size="sm"
        variant={hiddenOnly ? 'default' : 'ghost'}
        className="h-8 px-2 text-xs"
        title={t.game.hiddenOnlyTitle}
        aria-pressed={hiddenOnly}
        onClick={onHiddenOnlyToggle}
      >
        <EyeOff />
        {t.game.hiddenOnly(hiddenCount)}
      </Button>
      <span className="flex-1" />
      <select
        value={sort}
        onChange={(event) =>
          onSortChange(event.target.value as AchievementSort)
        }
        className="bg-muted text-foreground h-8 rounded-md border px-2 text-xs"
      >
        {SORTS_BY_FILTER[filter].map((value) => (
          <option key={value} value={value}>
            {t.game.sort[value]}
          </option>
        ))}
      </select>
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
