import { useShallow } from 'zustand/react/shallow';

import { useStore } from '@app/store';

/** The game on screen: the one picked in the dashboard or, without a pick, the current one. */
export function useActiveGame(): { appid: number | null; running: boolean } {
  return useStore(
    useShallow((state) => {
      const { current } = state.session;
      const appid = state.navigation.pickedAppId ?? current?.appid ?? null;

      return {
        appid,
        running: current?.running === true && appid === current.appid,
      };
    }),
  );
}
