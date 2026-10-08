import type { IAchievement, IGameView, GuideSite } from '../../shared/types';

import type { IRawPlayerAchievement, IRawSchemaAchievement } from './client';

const iconUrl = (appid: number, file: string): string =>
  file
    ? `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${appid}/${file}`
    : '';

export interface IGameSources {
  appid: number;
  name: string;
  schema: IRawSchemaAchievement[];
  player: IRawPlayerAchievement[];
  /** Current values of the player's stats. */
  stats: Record<string, number>;
  /** Achievement → stat that feeds its counter. */
  statMap: Map<string, string>;
  now?: number;
}

export function buildGameView({
  appid,
  name,
  schema,
  player,
  stats,
  statMap,
  now,
}: IGameSources): IGameView {
  const playerById = new Map(player.map((p) => [p.apiname, p]));

  const achievements = schema.map((s): IAchievement => {
    const mine = playerById.get(s.internal_name);
    const unlocked = mine?.achieved === 1;
    const rarity =
      s.player_percent_unlocked === undefined
        ? NaN
        : Number(s.player_percent_unlocked);

    let progress: IAchievement['progress'] = null;
    const target = s.max_progress_int;
    if (target !== undefined && target > 0) {
      const statName = statMap.get(s.internal_name);
      const current = unlocked
        ? target
        : statName === undefined
          ? undefined
          : stats[statName];
      if (current !== undefined)
        progress = { current: Math.min(current, target), target };
    }

    return {
      id: s.internal_name,
      name: s.localized_name || s.internal_name,
      description: s.localized_desc ?? '',
      hidden: s.hidden,
      icon: iconUrl(appid, s.icon),
      iconGray: iconUrl(appid, s.icon_gray),
      rarity: Number.isNaN(rarity) ? null : rarity,
      unlocked,
      unlockedAt:
        mine && unlocked && mine.unlocktime > 0 ? mine.unlocktime : null,
      progress,
    };
  });

  return {
    appid,
    name,
    total: achievements.length,
    unlockedCount: achievements.filter((a) => a.unlocked).length,
    achievements,
    fetchedAt: now ?? Date.now(),
  };
}

/** Achievements that became unlocked between two reads of the same game. */
export function newlyUnlocked(
  previous: IGameView,
  next: IGameView,
): IAchievement[] {
  const had = new Set(
    previous.achievements.filter((a) => a.unlocked).map((a) => a.id),
  );
  return next.achievements.filter((a) => a.unlocked && !had.has(a.id));
}

/** `howTo` is the search suffix in the user's language (e.g. "how to get"). */
export function guideUrl(
  site: GuideSite,
  appid: number,
  game: string,
  achievement: string,
  howTo: string,
): string {
  const q = encodeURIComponent;
  switch (site) {
    case 'steam':
      return `https://steamcommunity.com/app/${appid}/guides/?searchText=${q(achievement)}`;
    case 'youtube':
      return `https://www.youtube.com/results?search_query=${q(`${game} ${achievement} ${howTo}`)}`;
    case 'google':
      return `https://www.google.com/search?q=${q(`${game} "${achievement}" ${howTo}`)}`;
  }
}
