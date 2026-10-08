import type { StateCreator } from 'zustand';
import type { DashboardSlice } from './slices/dashboardSlice';
import type { GamesSlice } from './slices/gamesSlice';
import type { SessionSlice } from './slices/sessionSlice';
import type { UserDataSlice } from './slices/userDataSlice';

export type Store = {
  session: SessionSlice;
  games: GamesSlice;
  userData: UserDataSlice;
  dashboard: DashboardSlice;
};

export type StoreSlice<TSlice> = StateCreator<
  Store,
  [['zustand/devtools', never], ['zustand/immer', never]],
  [],
  TSlice
>;
