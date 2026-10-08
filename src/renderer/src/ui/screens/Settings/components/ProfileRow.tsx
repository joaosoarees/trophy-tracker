import { User } from 'lucide-react';

import { useT } from '@app/hooks/useT';
import { type IProfile } from '@shared/types/Profile';
import { RemoteImage } from '@ui/components/RemoteImage';

interface IProfileRowProps {
  profile: IProfile;
}

/** Whose account the app follows: the first row of the Account group. */
export function ProfileRow({ profile }: IProfileRowProps) {
  const t = useT();

  return (
    <li className="flex items-center gap-3 px-2 py-2.5">
      <RemoteImage
        src={profile.avatar}
        fallback={<User className="size-5" />}
        className="size-10 flex-none"
      />
      <div className="min-w-0">
        <strong className="block truncate font-semibold">
          {profile.name || t.settings.account}
        </strong>
        <small className="text-muted-foreground text-xs tabular-nums">
          {t.settings.steamId(profile.steamId)}
        </small>
      </div>
    </li>
  );
}
