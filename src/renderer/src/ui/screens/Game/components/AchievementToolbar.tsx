import { EyeOff } from 'lucide-react';

import { useT } from '@app/hooks/useT';
import {
  type AchievementFilter,
  type AchievementSort,
  SORTS_BY_FILTER,
} from '@shared/achievementSort';
import { Hint } from '@ui/components/Hint';
import { OptionSelect } from '@ui/components/OptionSelect';
import { SearchBox } from '@ui/components/SearchBox';
import { Segmented } from '@ui/components/Segmented';
import { Button } from '@ui/primitives/button';
import { cn } from '@ui/utils/cn';
import { TOGGLE_ON } from '@ui/utils/toggle';

interface IAchievementToolbarProps {
  filter: AchievementFilter;
  /** The order chosen for the list being shown. */
  sort: AchievementSort;
  query: string;
  pending: number;
  unlocked: number;
  isHiddenOnly: boolean;
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
  isHiddenOnly,
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
        label={t.game.filterLabel}
        value={filter}
        onChange={onFilterChange}
        options={[
          { value: 'pending', label: t.game.pending(pending) },
          { value: 'unlocked', label: t.game.unlocked(unlocked) },
        ]}
      />
      {/* Not offered when this list has no hidden achievement to show. */}
      {hiddenCount > 0 && (
        <Hint label={t.game.hiddenOnlyTitle}>
          <Button
            size="sm"
            variant="ghost"
            className={cn('h-8 px-2 text-xs', isHiddenOnly && TOGGLE_ON)}
            aria-pressed={isHiddenOnly}
            onClick={onHiddenOnlyToggle}
          >
            <EyeOff />
            {t.game.hiddenOnly(hiddenCount)}
          </Button>
        </Hint>
      )}
      <OptionSelect
        // Takes the room that is left; when a narrow window wraps it to its own
        // row, that is the whole row.
        className="min-w-40 flex-1"
        label={t.common.sortBy}
        value={sort}
        onChange={onSortChange}
        options={SORTS_BY_FILTER[filter].map((value) => ({
          value,
          label: t.game.sort[value],
        }))}
      />
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
