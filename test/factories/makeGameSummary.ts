import { type IGameSummary } from '@shared/types/Game';

/** A played game as the dashboard lists it, with nothing unlocked yet. */
export function makeGameSummary(
  props: Partial<IGameSummary> = {},
): IGameSummary {
  return {
    appid: 1,
    name: 'Game',
    icon: '',
    capsule: '',
    playtimeMinutes: 10,
    lastPlayed: 0,
    total: 10,
    unlocked: 0,
    completedAt: null,
    ...props,
  };
}
