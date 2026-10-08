import { useShallow } from 'zustand/react/shallow';

import { useActiveGame } from '@app/hooks/useActiveGame';
import { useStore } from '@app/store';

export function useAppShellController() {
  const game = useActiveGame();
  const { tab, alwaysOnTop, goTo, toggleAlwaysOnTop } = useStore(
    useShallow((state) => ({
      tab: state.navigation.tab,
      alwaysOnTop: state.settings.alwaysOnTop,
      goTo: state.navigation.goTo,
      toggleAlwaysOnTop: state.settings.toggleAlwaysOnTop,
    })),
  );

  return {
    tab,
    game,
    alwaysOnTop,
    goTo,
    handleToggleAlwaysOnTop: () => void toggleAlwaysOnTop(),
  };
}
