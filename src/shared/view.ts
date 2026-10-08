import type { Achievement, GameView } from './types'

const sameAchievement = (a: Achievement, b: Achievement): boolean =>
  a.unlocked === b.unlocked &&
  a.unlockedAt === b.unlockedAt &&
  a.progress?.current === b.progress?.current &&
  a.progress?.target === b.progress?.target &&
  a.name === b.name &&
  a.description === b.description &&
  a.rarity === b.rarity &&
  a.hidden === b.hidden &&
  a.icon === b.icon &&
  a.iconGray === b.iconGray

/**
 * Merges a new read with the previous one, reusing what did not change.
 * Returns `previous` itself when nothing changed, so that whoever compares by
 * identity (notifying the interface, re-rendering cards) does no needless work.
 */
export function mergeView(previous: GameView | null | undefined, next: GameView): GameView {
  if (!previous || previous.appid !== next.appid) return next
  const before = new Map(previous.achievements.map((a) => [a.id, a]))
  let changed = previous.achievements.length !== next.achievements.length
  const achievements = next.achievements.map((a, i) => {
    const old = before.get(a.id)
    if (old && sameAchievement(old, a)) {
      if (previous.achievements[i] !== old) changed = true
      return old
    }
    changed = true
    return a
  })
  if (!changed && previous.name === next.name && previous.header === next.header) return previous
  return { ...next, achievements }
}
