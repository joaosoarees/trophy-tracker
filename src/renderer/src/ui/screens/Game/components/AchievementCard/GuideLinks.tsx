import { BookOpen, CirclePlay, Search } from 'lucide-react';
import { type ReactNode } from 'react';

import { useT } from '@app/hooks/useT';
import { type GuideSite } from '@shared/types';
import { Button } from '@ui/primitives/button';

const GUIDES: { site: GuideSite; icon: ReactNode }[] = [
  { site: 'steam', icon: <BookOpen /> },
  { site: 'youtube', icon: <CirclePlay /> },
  { site: 'google', icon: <Search /> },
];
const SITE_NAMES = { youtube: 'YouTube', google: 'Google' };

interface IGuideLinksProps {
  onOpen: (site: GuideSite) => void;
}

/** One button per place to look up how to get an achievement. */
export function GuideLinks({ onOpen }: IGuideLinksProps) {
  const t = useT();

  return (
    <>
      {GUIDES.map(({ site, icon }) => (
        <Button
          key={site}
          size="xs"
          variant="secondary"
          title={
            site === 'steam'
              ? t.guides.steamTitle
              : t.guides.searchOn(SITE_NAMES[site])
          }
          onClick={() => onOpen(site)}
        >
          {icon}
          {site === 'steam' ? t.guides.steam : SITE_NAMES[site]}
        </Button>
      ))}
    </>
  );
}
