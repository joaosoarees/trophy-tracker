import { useShallow } from 'zustand/react/shallow';

import { useStore } from '@app/store';

/** The game on screen: the one picked in the dashboard or, without a pick, the current one. */
export function useActiveGame(): {
  appid: number | null;
  running: boolean;
  /** The running game belongs to a Steam account the app does not have. */
  isOnAnotherAccount: boolean;
} {
  return useStore(
    useShallow((state) => {
      const { current } = state.session;
      const appid = state.navigation.pickedAppId ?? current?.appid ?? null;

      const isCurrent = current !== null && appid === current.appid;

      return {
        appid,
        running: isCurrent && current.running,
        isOnAnotherAccount: isCurrent && current.otherAccount === true,
      };
    }),
  );
}
