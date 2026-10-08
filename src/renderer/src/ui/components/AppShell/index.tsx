import {
  LayoutGrid,
  Pin,
  Settings as SettingsIcon,
  Trophy,
} from 'lucide-react';

import { useT } from '@app/hooks/useT';
import { Empty } from '@ui/components/Empty';
import { IconButton } from '@ui/components/IconButton';
import { Dashboard } from '@ui/screens/Dashboard';
import { Game } from '@ui/screens/Game';
import { Settings } from '@ui/screens/Settings';
import { cn } from '@ui/utils/cn';

import { TabButton } from './TabButton';
import { useAppShellController } from './useAppShellController';

/** The frame of the configured app: tab bar on top, one screen below. */
export function AppShell() {
  const t = useT();
  const { tab, game, alwaysOnTop, goTo, handleToggleAlwaysOnTop } =
    useAppShellController();

  return (
    <div className="flex h-screen flex-col">
      <nav
        aria-label={t.nav.label}
        className="flex items-center gap-1 border-b px-2"
      >
        <TabButton active={tab === 'game'} onClick={() => goTo('game')}>
          <Trophy />
          {t.nav.game}
        </TabButton>
        <TabButton
          active={tab === 'dashboard'}
          onClick={() => goTo('dashboard')}
        >
          <LayoutGrid />
          {t.nav.dashboard}
        </TabButton>
        <span className="flex-1" />
        <IconButton
          label={alwaysOnTop ? t.nav.unpinWindow : t.nav.pinWindow}
          aria-pressed={alwaysOnTop}
          className={cn(alwaysOnTop && 'text-primary hover:text-primary')}
          onClick={handleToggleAlwaysOnTop}
        >
          <Pin className={cn(alwaysOnTop && 'fill-current')} />
        </IconButton>
        <IconButton
          label={t.nav.settings}
          aria-current={tab === 'settings' ? 'page' : undefined}
          className={cn(
            tab === 'settings' && 'text-primary hover:text-primary',
          )}
          onClick={() => goTo('settings')}
        >
          <SettingsIcon />
        </IconButton>
      </nav>

      {/* Clipped: a screen sliding in must not make the window itself scroll. */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Both screens stay mounted; switching tabs only hides one, with no reload and no lost scroll position. */}
        <div
          className={cn(
            'animate-screen-in flex min-h-0 flex-1 flex-col',
            tab !== 'game' && 'hidden',
          )}
        >
          {game.appid === null ? (
            <Empty>{t.game.none}</Empty>
          ) : (
            <Game key={game.appid} appid={game.appid} running={game.running} />
          )}
        </div>

        <div
          className={cn(
            'animate-screen-in flex min-h-0 flex-1 flex-col',
            tab !== 'dashboard' && 'hidden',
          )}
        >
          <Dashboard />
        </div>

        {tab === 'settings' && (
          <div className="animate-screen-in flex min-h-0 flex-1 flex-col">
            <Settings />
          </div>
        )}
      </main>
    </div>
  );
}
