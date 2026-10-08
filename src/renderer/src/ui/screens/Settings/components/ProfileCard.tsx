import { useT } from '@app/hooks/useT';
import { type IProfile } from '@shared/types/Profile';

interface IProfileCardProps {
  profile: IProfile;
}

export function ProfileCard({ profile }: IProfileCardProps) {
  const t = useT();

  return (
    <div className="bg-card flex w-full items-center gap-3 rounded-lg border p-3">
      {profile.avatar && (
        <img src={profile.avatar} alt="" className="size-12 rounded-md" />
      )}
      <div>
        <strong className="block">{profile.name || t.settings.account}</strong>
        <small className="text-muted-foreground">
          {t.settings.steamId(profile.steamId)}
        </small>
      </div>
    </div>
  );
}
