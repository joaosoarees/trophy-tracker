import { BookOpen, CirclePlay, Search } from 'lucide-react';
import { type ReactNode } from 'react';

import { useT } from '@app/hooks/useT';
import { type GuideSite } from '@shared/types/Guide';
import { Hint } from '@ui/components/Hint';
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
        <Hint
          key={site}
          label={
            site === 'steam'
              ? t.guides.steamTitle
              : t.guides.searchOn(SITE_NAMES[site])
          }
        >
          <Button
            size="xs"
            variant="ghost"
            // Quiet at rest: fifteen of these share a screen with the names
            // and descriptions, which are what is being read.
            className="text-muted-foreground"
            onClick={() => onOpen(site)}
          >
            {icon}
            {site === 'steam' ? t.guides.steam : SITE_NAMES[site]}
          </Button>
        </Hint>
      ))}
    </>
  );
}
