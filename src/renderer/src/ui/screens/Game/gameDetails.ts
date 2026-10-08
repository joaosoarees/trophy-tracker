import { shownProgress } from '@shared/checklist';
import { type IAchievement } from '@shared/types/Achievement';
import { type IGameView } from '@shared/types/Game';
import { type GameUserData } from '@shared/types/UserData';

export interface IGameDetails {
  /** The achievement unlocked most recently, when Steam reports dates. */
  lastUnlocked: IAchievement | null;
  /** The pending achievement most players have. */
  easiest: IAchievement | null;
  /** The pending achievement fewest players have; `null` when it is the easiest too. */
  rarest: IAchievement | null;
  /** The pending achievement whose counter is furthest along. */
  closest: {
    achievement: IAchievement;
    current: number;
    target: number;
  } | null;
}

/** What a player asks about a game beyond its list: where they stand and what to go for next. */
export function gameDetailsOf(
  view: IGameView,
  userData: GameUserData,
): IGameDetails {
  const pending = view.achievements.filter((a) => !a.unlocked);
  const rated = pending.filter((a) => a.rarity !== null);
  const byRarity = [...rated].sort((a, b) => (b.rarity ?? 0) - (a.rarity ?? 0));
  const easiest = byRarity[0] ?? null;
  const rarest = byRarity.at(-1) ?? null;

  let closest: IGameDetails['closest'] = null;
  for (const achievement of pending) {
    const progress = shownProgress(achievement, userData[achievement.id]);
    if (!progress || progress.current === 0) continue;
    const ratio = progress.current / progress.target;
    if (!closest || ratio > closest.current / closest.target) {
      closest = { achievement, ...progress };
    }
  }

  const dated = view.achievements.filter(
    (a) => a.unlocked && a.unlockedAt !== null,
  );
  return {
    lastUnlocked:
      dated.length > 0
        ? dated.reduce((last, a) =>
            (a.unlockedAt ?? 0) > (last.unlockedAt ?? 0) ? a : last,
          )
        : null,
    easiest,
    rarest: rarest && rarest.id !== easiest?.id ? rarest : null,
    closest,
  };
}
