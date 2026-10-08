import { useState } from 'react';

import { SystemService } from '@app/services/SystemService';
import { shownProgress } from '@shared/checklist';
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
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);

  const checklist = data?.checklist ?? [];
  const note = data?.note ?? '';
  const isPinned = data?.pinned === true;

  return {
    checklist,
    checkedCount: checklist.filter((item) => item.done).length,
    note,
    isPinned,
    isChecklistOpen,
    // An open note stays open while it has text.
    isNoteVisible: isNoteOpen || note !== '',
    shouldFocusNote: isNoteOpen && note === '',
    progress: achievement.unlocked ? null : shownProgress(achievement, data),
    handleOpenGuide: (site: GuideSite) =>
      void SystemService.openGuide(site, appid, game, achievement.name),
    handleToggleChecklist: () => setIsChecklistOpen((open) => !open),
    handleOpenNote: () => setIsNoteOpen(true),
    handleCloseNote: () => setIsNoteOpen(false),
    handleTogglePin: () => onChange(achievement.id, { pinned: !isPinned }),
    handleNoteChange: (value: string) =>
      onChange(achievement.id, { note: value }),
    handleChecklistChange: (items: IChecklistItem[]) =>
      onChange(achievement.id, { checklist: items }),
  };
}
