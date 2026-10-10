import { type IGameView } from '@shared/types/Game';

/** A game read from Steam; the counts follow the achievements unless given. */
export function makeGameView(props: Partial<IGameView> = {}): IGameView {
  const achievements = props.achievements ?? [];
  return {
    appid: 1,
    name: 'Game',
    total: achievements.length,
    unlockedCount: achievements.filter((a) => a.unlocked).length,
    fetchedAt: 1,
    ...props,
    achievements,
  };
}
