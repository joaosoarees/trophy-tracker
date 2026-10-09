import { CircleX, Plus, User } from 'lucide-react';

import { useT } from '@app/hooks/useT';
import { type IAccount } from '@shared/types/Account';
import { cn } from '@ui/utils/cn';

import { Pressable } from './Pressable';
import { RemoteImage } from './RemoteImage';

interface IAccountGridProps {
  accounts: IAccount[];
  /** SteamID of the account in use; `null` when none is yet. */
  activeId: string | null;
  /** Leave out where the accounts are only shown, not switched between. */
  onSelect?: (steamId: string) => void;
  /** Leave out where an account cannot be added. */
  onAdd?: () => void;
  /** Name of the list for assistive technology. */
  label: string;
}

/**
 * A tile is inset by 8px, as a detail row is: its avatar sits on the text
 * margin of the group it is in, and its hover wash is as wide as a row's.
 */
const TILE_BOX = 'flex w-28 flex-col items-start gap-1.5 p-2 text-left text-xs';
const TILE = `${TILE_BOX} hover:bg-accent/40 active:bg-accent/70 rounded-md`;

/**
 * The accounts the app can follow, as faces: one click switches to an
 * account, and the last tile adds another. The account in use carries the
 * accent ring ("you are here"); one whose key Steam refused carries a red
 * mark, also said in its name.
 */
export function AccountGrid({
  accounts,
  activeId,
  onSelect,
  onAdd,
  label,
}: IAccountGridProps) {
  const t = useT();

  return (
    <ul aria-label={label} className="flex flex-wrap gap-1">
      {accounts.map((account) => {
        const isActive = account.steamId === activeId;
        const name = account.name || account.steamId;

        const face = (
          <>
            <span className="relative">
              <RemoteImage
                src={account.avatar}
                fallback={<User className="size-5" />}
                className={cn(
                  'size-12',
                  isActive &&
                    'ring-primary ring-offset-background ring-2 ring-offset-2',
                )}
              />
              {account.status === 'rejected' && (
                <CircleX
                  aria-hidden
                  className="text-destructive bg-background absolute -right-1.5 -bottom-1.5 size-4 rounded-full"
                />
              )}
            </span>
            {/* A name is what tells two accounts apart: it gets a second line before it is cut. */}
            <span className="line-clamp-2 w-full leading-tight break-words">
              {name}
            </span>
          </>
        );

        if (!onSelect) {
          return (
            <li
              key={account.steamId}
              className={cn(TILE_BOX, 'text-foreground')}
            >
              {face}
            </li>
          );
        }

        return (
          <li key={account.steamId}>
            <Pressable
              aria-pressed={isActive}
              aria-label={
                account.status === 'rejected'
                  ? `${name}, ${t.accounts.status.rejected}`
                  : name
              }
              onClick={() => onSelect(account.steamId)}
              className={cn(
                TILE,
                isActive
                  ? 'text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {face}
            </Pressable>
          </li>
        );
      })}
      {onAdd && (
        <li>
          <Pressable
            onClick={onAdd}
            className={cn(TILE, 'text-muted-foreground hover:text-foreground')}
          >
            <span className="border-input flex size-12 items-center justify-center rounded-md border border-dashed">
              <Plus className="size-5" aria-hidden />
            </span>
            {/* Two lines at most: "Add account" is long in French. */}
            <span className="line-clamp-2 w-full leading-tight">
              {t.accounts.add}
            </span>
          </Pressable>
        </li>
      )}
    </ul>
  );
}
