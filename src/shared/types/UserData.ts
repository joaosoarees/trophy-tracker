export interface IChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface IAchievementUserData {
  note: string;
  pinned: boolean;
  /** Items the user lists to know which ones are missing (e.g. collectibles). */
  checklist?: IChecklistItem[];
}

export type GameUserData = Record<string, IAchievementUserData>;
