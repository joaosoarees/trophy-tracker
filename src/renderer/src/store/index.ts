import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Store } from './Store';
import { createDashboardSlice } from './slices/dashboardSlice';
import { createGamesSlice } from './slices/gamesSlice';
import { createSessionSlice } from './slices/sessionSlice';
import { createUserDataSlice } from './slices/userDataSlice';

// No `persist`: what must survive closing the app is already written by the main process.
export const useStore = create<Store>()(
  devtools(
    immer((...params) => ({
      session: { ...createSessionSlice(...params) },
      games: { ...createGamesSlice(...params) },
      userData: { ...createUserDataSlice(...params) },
      dashboard: { ...createDashboardSlice(...params) },
    })),
    { enabled: import.meta.env.DEV },
  ),
);

export type { Store } from './Store';
export { connectStore } from './connect';
