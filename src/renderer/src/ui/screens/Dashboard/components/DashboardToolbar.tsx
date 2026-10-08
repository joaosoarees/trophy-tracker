import { useT } from '@app/hooks/useT';
import {
  DASHBOARD_SORTS_BY_FILTER,
  type DashboardFilter,
  type DashboardSort,
} from '@shared/dashboardSort';
import { SearchBox } from '@ui/components/SearchBox';
import { Segmented } from '@ui/components/Segmented';

interface IDashboardToolbarProps {
  filter: DashboardFilter;
  /** The order chosen for the list being shown. */
  sort: DashboardSort;
  query: string;
  ongoing: number;
  complete: number;
  onFilterChange: (filter: DashboardFilter) => void;
  onSortChange: (sort: DashboardSort) => void;
  onQueryChange: (query: string) => void;
}

export function DashboardToolbar({
  filter,
  sort,
  query,
  ongoing,
  complete,
  onFilterChange,
  onSortChange,
  onQueryChange,
}: IDashboardToolbarProps) {
  const t = useT();

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Segmented<DashboardFilter>
        value={filter}
        onChange={onFilterChange}
        options={[
          { value: 'ongoing', label: t.dashboard.ongoing(ongoing) },
          { value: 'complete', label: t.dashboard.complete(complete) },
        ]}
      />
      <span className="flex-1" />
      <select
        value={sort}
        onChange={(event) => onSortChange(event.target.value as DashboardSort)}
        className="bg-muted text-foreground h-8 rounded-md border px-2 text-xs"
      >
        {DASHBOARD_SORTS_BY_FILTER[filter].map((value) => (
          <option key={value} value={value}>
            {t.dashboard.sort[value]}
          </option>
        ))}
      </select>
      <div className="flex basis-full">
        <SearchBox
          value={query}
          onChange={onQueryChange}
          placeholder={t.dashboard.search}
        />
      </div>
    </div>
  );
}
