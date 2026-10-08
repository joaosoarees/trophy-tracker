import { type IAchievement } from '@shared/types/Achievement';

/** A locked, plain achievement; pass only what the test is about. */
export function makeAchievement(
  props: Partial<IAchievement> = {},
): IAchievement {
  const id = props.id ?? 'A';
  return {
    id,
    name: id,
    description: '',
    hidden: false,
    icon: '',
    iconGray: '',
    rarity: null,
    unlocked: false,
    unlockedAt: null,
    progress: null,
    ...props,
  };
}
