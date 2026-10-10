import { completedAt, lastUnlockOf } from '@shared/completion';
import { type IGameSummary, type IGameView } from '@shared/types/Game';

import {
  type IRawOwnedGame,
  type IRawPlayerAchievement,
  type IStoreArt,
} from '../steam/SteamClient';
import { type ISummaryEntry } from '../storage/Store';

const ICONS =
  'https://media.steampowered.com/steamcommunity/public/images/apps';

/**
 * The steps of the dashboard that need neither Steam nor the disk: which games
 * of a library it is about, what is kept of each one, whether what was kept
 * still stands, and how a game is listed.
 */
export class Dashboard {
  /** The games of a library that were opened at least once. */
  static played(library: IRawOwnedGame[]): IRawOwnedGame[] {
    return library.filter((game) => game.playtime_forever > 0);
  }

  /** The same games, from the one played last to the one played longest ago. */
  static mostRecentFirst(games: IRawOwnedGame[]): IRawOwnedGame[] {
    return [...games].sort(
      (a, b) => (b.rtime_last_played ?? 0) - (a.rtime_last_played ?? 0),
    );
  }

  /** Whether what was kept of a game still says what Steam would say now. */
  static isCurrent(cached: ISummaryEntry, game: IRawOwnedGame): boolean {
    return cached.playtime === game.playtime_forever;
  }

  /** What is kept of a game, from what Steam says the player has in it. */
  static entry(list: IRawPlayerAchievement[], playtime: number): ISummaryEntry {
    return {
      total: list.length,
      unlocked: list.filter((a) => a.achieved === 1).length,
      playtime,
      lastUnlockAt: Math.max(0, ...list.map((a) => a.unlocktime)),
    };
  }

  /** The same, from a game that was read whole. */
  static entryOfView(view: IGameView, playtime: number): ISummaryEntry {
    return {
      total: view.total,
      unlocked: view.unlockedCount,
      playtime,
      lastUnlockAt: lastUnlockOf(view),
    };
  }

  /** A game as the dashboard lists it. */
  static summary(
    game: IRawOwnedGame,
    entry: ISummaryEntry,
    art: IStoreArt | undefined,
  ): IGameSummary {
    return {
      appid: game.appid,
      name: game.name,
      icon: game.img_icon_url
        ? `${ICONS}/${game.appid}/${game.img_icon_url}.jpg`
        : '',
      capsule: art?.capsule ?? '',
      playtimeMinutes: game.playtime_forever,
      lastPlayed: game.rtime_last_played ?? 0,
      total: entry.total,
      unlocked: entry.unlocked,
      completedAt: completedAt(entry),
    };
  }

  /**
   * From the closest to 100% to the furthest, the one played last first among
   * equals; complete games last.
   */
  static closestFirst(games: IGameSummary[]): IGameSummary[] {
    const ratio = (game: IGameSummary): number => game.unlocked / game.total;
    return [...games].sort((a, b) => {
      const isDoneA = a.unlocked === a.total;
      const isDoneB = b.unlocked === b.total;
      if (isDoneA !== isDoneB) return isDoneA ? 1 : -1;
      return ratio(b) - ratio(a) || b.lastPlayed - a.lastPlayed;
    });
  }
}
