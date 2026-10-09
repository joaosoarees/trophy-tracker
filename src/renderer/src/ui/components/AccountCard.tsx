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
  /** The account the app is following: it carries the accent and cannot be switched to. */
  isActive?: boolean;
  /** Makes the whole card switch to the account. Ignored for the active one. */
  onSelect?: () => void;
  /** Said at the end of the card in place of the status of the key. */
  status?: ReactNode;
  /** A control at the end of the card, such as removing the account. */
  action?: ReactNode;
  /** What opens inside the card, under its first line: the key and what can be done to it. */
  children?: ReactNode;
}

/**
 * One account: face, name, SteamID and what is known about its key, all
 * inside one card, so nothing about an account sits apart from it. The
 * account in use has the accent border and says so in words; any other can
 * be switched to by clicking anywhere on its card.
 *
 * The card is drawn the same way whether it is in use or not, and what makes
 * it clickable is a button laid under its content. Were the card itself a button in
 * one case and not in the other, switching accounts would throw away and
 * redraw both cards, avatars included, which shows as a flicker.
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
  const isSwitch = onSelect !== undefined && !isActive;

  return (
    <li
      aria-current={isActive ? 'true' : undefined}
      className={cn(
        'bg-card relative rounded-lg border transition-colors',
        isActive && 'border-primary/60',
        // The accent border belongs to the account in use; a hover must not
        // make another account look like it.
        isSwitch && 'has-[>button:hover]:border-input',
      )}
    >
      {isSwitch && (
        // Under the content, which lets clicks through to it: the wash of
        // its hover sits behind the text, as on any other card.
        <Pressable
          aria-label={t.accounts.use(name)}
          onClick={onSelect}
          className="hover:bg-accent/40 active:bg-accent/70 absolute inset-0 rounded-[7px] active:scale-100"
        />
      )}
      <div
        className={cn(
          'relative flex items-center gap-3 p-3',
          isSwitch && 'pointer-events-none',
        )}
      >
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
