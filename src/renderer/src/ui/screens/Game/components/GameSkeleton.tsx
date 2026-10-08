import { Skeleton } from '@ui/primitives/skeleton';

const CARDS = Array.from({ length: 6 }, (_, index) => index);

function AchievementCardSkeleton() {
  return (
    <li className="bg-card flex gap-3 rounded-lg border p-3">
      <Skeleton className="size-12 flex-none" />
      <div className="flex-1 space-y-2 py-0.5">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3.5 w-4/5" />
        <Skeleton className="h-6 w-3/5" />
      </div>
    </li>
  );
}

/** Stands in for the whole screen the first time a game is opened. */
export function GameSkeleton() {
  return (
    <section className="flex-1 overflow-hidden" aria-busy="true">
      <header className="border-b px-4 pt-10 pb-3.5">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="mt-3 h-2 w-full rounded-full" />
        <Skeleton className="mt-2 h-3.5 w-2/5" />
      </header>

      <div className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-8 w-36" />
        </div>
        <Skeleton className="mb-3 h-8 w-full" />

        <ul className="flex flex-col gap-2">
          {CARDS.map((card) => (
            <AchievementCardSkeleton key={card} />
          ))}
        </ul>
      </div>
    </section>
  );
}
