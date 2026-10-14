import { useState } from 'react';

import { SystemService } from '@app/services/SystemService';
import { shownProgress } from '@shared/checklist';
import { parseLink } from '@shared/link';
import { type IAchievement } from '@shared/types/Achievement';
import { type GuideSite } from '@shared/types/Guide';
import {
  type IAchievementUserData,
  type IChecklistItem,
} from '@shared/types/UserData';

interface IParams {
  achievement: IAchievement;
  game: string;
  appid: number;
  data: IAchievementUserData | undefined;
  onChange: (id: string, patch: Partial<IAchievementUserData>) => void;
}

export function useAchievementCardController({
  achievement,
  game,
  appid,
  data,
  onChange,
}: IParams) {
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  // `null` until the user decides: a checklist with items left to check
  // starts open, since which ones are left is what it is for.
  const [isChecklistOpenByChoice, setIsChecklistOpenByChoice] = useState<
    boolean | null
  >(null);
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  // What was typed in the link's field, while the field is open. It is kept
  // apart because it may not be an address yet, and only an address is saved.
  const [linkDraft, setLinkDraft] = useState<string | null>(null);

  const checklist = data?.checklist ?? [];
  const note = data?.note ?? '';
  const isPinned = data?.pinned === true;
  // A file edited by hand may hold anything: only an address counts as a link.
  const link = parseLink(data?.link ?? '');
  const isChecklistOpen =
    isChecklistOpenByChoice ?? checklist.some((item) => !item.done);

  return {
    checklist,
    checkedCount: checklist.filter((item) => item.done).length,
    note,
    isPinned,
    isChecklistOpen,
    // A note is on screen while it has text, and while it is being edited.
    isNoteVisible: isNoteOpen || note !== '',
    shouldFocusNote: isNoteOpen && note === '',
    link,
    linkText: linkDraft ?? link ?? '',
    isLinkOpen,
    isLinkInvalid:
      linkDraft !== null &&
      linkDraft.trim() !== '' &&
      parseLink(linkDraft) === null,
    progress: achievement.unlocked ? null : shownProgress(achievement, data),
    handleOpenGuide: (site: GuideSite) =>
      void SystemService.openGuide(site, appid, game, achievement.name),
    handleOpenLink: () => {
      if (link) void SystemService.openLink(link);
    },
    handleToggleLink: () => {
      setIsLinkOpen(!isLinkOpen);
      setLinkDraft(null);
    },
    handleLinkChange: (value: string) => {
      setLinkDraft(value);
      // Emptying the field takes the link out; text that is not an address
      // yet leaves the saved one as it is.
      if (value.trim() === '') onChange(achievement.id, { link: undefined });
      else {
        const typed = parseLink(value);
        if (typed) onChange(achievement.id, { link: typed });
      }
    },
    handleToggleChecklist: () => setIsChecklistOpenByChoice(!isChecklistOpen),
    handleOpenNote: () => setIsNoteOpen(true),
    handleCloseNote: () => setIsNoteOpen(false),
    handleTogglePin: () => onChange(achievement.id, { pinned: !isPinned }),
    handleNoteChange: (value: string) =>
      onChange(achievement.id, { note: value }),
    handleChecklistChange: (items: IChecklistItem[]) => {
      // Working on the list keeps it open, also after its last item is checked.
      setIsChecklistOpenByChoice(true);
      onChange(achievement.id, { checklist: items });
    },
  };
}
