import { User } from 'lucide-react';

import { useT } from '@app/hooks/useT';
import { type IProfile } from '@shared/types/Profile';
import { RemoteImage } from '@ui/components/RemoteImage';

interface IProfileCardProps {
  profile: IProfile;
}

export function ProfileCard({ profile }: IProfileCardProps) {
  const t = useT();

  return (
    <div className="bg-card flex w-full items-center gap-3 rounded-lg border p-3">
      <RemoteImage
        src={profile.avatar}
        fallback={<User className="size-5" />}
        className="size-12 flex-none"
      />
      <div>
        <strong className="block">{profile.name || t.settings.account}</strong>
        <small className="text-muted-foreground">
          {t.settings.steamId(profile.steamId)}
        </small>
      </div>
    </div>
  );
}
