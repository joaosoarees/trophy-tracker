import { Settings as SettingsIcon, User } from 'lucide-react';

import { useT } from '@app/hooks/useT';
import { type IAccount } from '@shared/types/Account';
import { IconButton } from '@ui/components/IconButton';
import { RemoteImage } from '@ui/components/RemoteImage';
import { cn } from '@ui/utils/cn';

interface ISettingsButtonProps {
  /** Settings is the screen being shown. */
  isCurrent: boolean;
  /** The account in use, when the app has more than one; `null` draws the gear. */
  account: IAccount | null;
  onClick: () => void;
}

/**
 * What leads to Settings from the tab bar. With more than one account it
 * carries the face of the one in use, since nothing else on the Game and the
 * Dashboard says whose they are, and Settings is where that is changed. The
 * bar has no room for one more button at 480 px (`docs/platforms.md`).
 */
export function SettingsButton({
  isCurrent,
  account,
  onClick,
}: ISettingsButtonProps) {
  const t = useT();

  return (
    <IconButton
      label={
        account
          ? t.nav.settingsWithAccount(account.name || account.steamId)
          : t.nav.settings
      }
      aria-current={isCurrent ? 'page' : undefined}
      className={cn(isCurrent && 'text-primary hover:text-primary')}
      onClick={onClick}
    >
      {account ? (
        <RemoteImage
          // A face that failed to load must not stay failed for the next account.
          key={account.steamId}
          src={account.avatar}
          fallback={<User />}
          className={cn(
            'size-6 rounded-full',
            // The gap keeps the ring apart from a face of its own colour.
            isCurrent &&
              'ring-primary ring-offset-background ring-2 ring-offset-1',
          )}
        />
      ) : (
        <SettingsIcon />
      )}
    </IconButton>
  );
}
