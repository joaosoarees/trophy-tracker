import { useShallow } from 'zustand/react/shallow';

import { activeGame, type IActiveGame } from '@app/lib/activeGame';
import { useStore } from '@app/store';

/** The game on screen, as `activeGame` decides it from the store. */
export function useActiveGame(): IActiveGame {
  return useStore(
    useShallow((state) =>
      activeGame(state.session.current, state.navigation.pickedAppId),
    ),
  );
}
