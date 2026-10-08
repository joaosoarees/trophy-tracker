import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import { createDashboardSlice } from './slices/dashboardSlice';
import { createGamesSlice } from './slices/gamesSlice';
import { createNavigationSlice } from './slices/navigationSlice';
import { createSessionSlice } from './slices/sessionSlice';
import { createSettingsSlice } from './slices/settingsSlice';
import { createUpdatesSlice } from './slices/updatesSlice';
import { createUserDataSlice } from './slices/userDataSlice';
import type { Store } from './Store';

// No `persist`: what must survive closing the app is already written by the main process.
export const useStore = create<Store>()(
  devtools(
    immer((...params) => ({
      session: { ...createSessionSlice(...params) },
      settings: { ...createSettingsSlice(...params) },
      navigation: { ...createNavigationSlice(...params) },
      games: { ...createGamesSlice(...params) },
      userData: { ...createUserDataSlice(...params) },
      dashboard: { ...createDashboardSlice(...params) },
      updates: { ...createUpdatesSlice(...params) },
    })),
    { enabled: import.meta.env.DEV },
  ),
);

export type { Store } from './Store';
export { connectStore } from './connect';
