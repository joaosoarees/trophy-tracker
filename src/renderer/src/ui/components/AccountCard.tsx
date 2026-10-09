import { Plus, User } from 'lucide-react';
import { type ReactNode } from 'react';

import { useT } from '@app/hooks/useT';
import { type IAccount } from '@shared/types/Account';
import { cn } from '@ui/utils/cn';

import { AccountStatus } from './AccountStatus';
import { Pressable } from './Pressable';
import { RemoteImage } from './RemoteImage';

interface IAccountCardProps {
  account: IAccount;
  /** The account the app is following: it carries the accent and is not a button. */
  isActive?: boolean;
  /** Makes the card one button that switches to the account. Ignored for the active one. */
  onSelect?: () => void;
  /** Said at the end of the card in place of the status of the key. */
  status?: ReactNode;
  /** A control at the end of the card, such as removing the account. */
  action?: ReactNode;
  /** What opens inside the card, under its first line: the key and what can be done to it. */
  children?: ReactNode;
}

const CARD = 'bg-card rounded-lg border';

/**
 * One account: face, name, SteamID and what is known about its key, all
 * inside one card, so nothing about an account sits apart from it. The
 * account in use has the accent border and says so in words; any other is a
 * single button, exactly as wide as the card, that switches to it.
 */
export function AccountCard({
  account,
  isActive = false,
  onSelect,
  status,
  action,
  children,
}: IAccountCardProps) {
  const t = useT();
  const name = account.name || account.steamId;

  const face = (
    <>
      <RemoteImage
        src={account.avatar}
        fallback={<User className="size-5" />}
        className="size-10 flex-none"
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <strong className="truncate font-semibold">{name}</strong>
          {isActive && (
            <span className="text-primary flex-none text-xs font-medium">
              {t.accounts.inUse}
            </span>
          )}
        </span>
        <small className="text-muted-foreground block truncate text-xs tabular-nums">
          {t.settings.steamId(account.steamId)}
        </small>
      </span>
      <span className="flex-none">
        {status ?? <AccountStatus status={account.status} />}
      </span>
    </>
  );

  if (onSelect && !isActive) {
    return (
      <li>
        <Pressable
          onClick={onSelect}
          className={cn(
            CARD,
            // The accent border belongs to the account in use; a hover must not
            // make another account look like it.
            'hover:border-input hover:bg-accent/40 active:bg-accent/70 flex w-full items-center gap-3 p-3 text-left active:scale-[0.99]',
          )}
        >
          {face}
        </Pressable>
      </li>
    );
  }

  return (
    <li
      aria-current={isActive ? 'true' : undefined}
      className={cn(CARD, isActive && 'border-primary/60')}
    >
      <div className="flex items-center gap-3 p-3">
        {face}
        {action}
      </div>
      {children}
    </li>
  );
}

interface IAddAccountCardProps {
  onAdd: () => void;
}

/** The last item of a list of accounts: as wide as a card, dashed because nothing is there yet. */
export function AddAccountCard({ onAdd }: IAddAccountCardProps) {
  const t = useT();

  return (
    <li>
      <Pressable
        onClick={onAdd}
        className="text-muted-foreground hover:border-input hover:bg-accent/40 hover:text-foreground active:bg-accent/70 flex w-full items-center gap-3 rounded-lg border border-dashed p-3 text-left active:scale-[0.99]"
      >
        <span className="flex size-10 flex-none items-center justify-center">
          <Plus className="size-5" aria-hidden />
        </span>
        {t.accounts.add}
      </Pressable>
    </li>
  );
}
