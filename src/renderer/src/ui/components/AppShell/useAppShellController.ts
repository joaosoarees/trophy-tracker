import { useShallow } from 'zustand/react/shallow';

import { useActiveGame } from '@app/hooks/useActiveGame';
import { useStore } from '@app/store';

export function useAppShellController() {
  const game = useActiveGame();
  const { tab, alwaysOnTop, hasUpdate, goTo, toggleAlwaysOnTop } = useStore(
    useShallow((state) => ({
      tab: state.navigation.tab,
      alwaysOnTop: state.settings.alwaysOnTop,
      hasUpdate: Boolean(state.updates.appInfo?.newVersion),
      goTo: state.navigation.goTo,
      toggleAlwaysOnTop: state.settings.toggleAlwaysOnTop,
    })),
  );

  return {
    tab,
    game,
    alwaysOnTop,
    hasUpdate,
    goTo,
    handleToggleAlwaysOnTop: () => void toggleAlwaysOnTop(),
  };
}
