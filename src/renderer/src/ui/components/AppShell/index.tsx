import {
  CircleArrowUp,
  LayoutGrid,
  LoaderCircle,
  PictureInPicture2,
  Settings as SettingsIcon,
  Trophy,
} from 'lucide-react';

import { useT } from '@app/hooks/useT';
import { IconButton } from '@ui/components/IconButton';
import { Dashboard } from '@ui/screens/Dashboard';
import { Game } from '@ui/screens/Game';
import { Settings } from '@ui/screens/Settings';
import { cn } from '@ui/utils/cn';

import { GameOnAnotherAccount } from './GameOnAnotherAccount';
import { KeyTroubleNotice } from './KeyTroubleNotice';
import { NoGame } from './NoGame';
import { TabButton } from './TabButton';
import { useAppShellController } from './useAppShellController';

/** The frame of the configured app: tab bar on top, one screen below. */
export function AppShell() {
  const t = useT();
  const {
    tab,
    game,
    libraryError,
    isLibraryLoading,
    handleRetryLibrary,
    handleAddAccount,
    troubledAccount,
    alwaysOnTop,
    newVersion,
    isCheckingForUpdates,
    goTo,
    handleToggleAlwaysOnTop,
    handleUpdates,
  } = useAppShellController();

  return (
    <div className="flex h-screen flex-col">
      <nav
        aria-label={t.nav.label}
        className="window-drag window-buttons-inset flex items-center gap-1 border-b"
      >
        <TabButton isActive={tab === 'game'} onClick={() => goTo('game')}>
          <Trophy />
          {t.nav.game}
        </TabButton>
        <TabButton
          isActive={tab === 'dashboard'}
          onClick={() => goTo('dashboard')}
        >
          <LayoutGrid />
          {t.nav.dashboard}
        </TabButton>
        <span className="flex-1" />
        <IconButton
          label={
            newVersion !== null
              ? t.nav.updateAvailable(newVersion)
              : isCheckingForUpdates
                ? t.settings.checkingForUpdates
                : t.settings.checkForUpdates
          }
          disabled={isCheckingForUpdates}
          className={cn(
            'relative',
            newVersion !== null && 'text-primary hover:text-primary',
          )}
          onClick={handleUpdates}
        >
          {isCheckingForUpdates ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <CircleArrowUp />
          )}
          {newVersion !== null && (
            <span className="bg-primary absolute top-1 right-1 size-2 rounded-full" />
          )}
        </IconButton>
        <IconButton
          label={alwaysOnTop ? t.nav.unpinWindow : t.nav.pinWindow}
          aria-pressed={alwaysOnTop}
          className={cn(alwaysOnTop && 'text-primary hover:text-primary')}
          onClick={handleToggleAlwaysOnTop}
        >
          {/* A window over another: the pin is kept for pinned achievements. */}
          <PictureInPicture2 />
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

      {troubledAccount && tab !== 'settings' && (
        <KeyTroubleNotice
          account={troubledAccount}
          onFix={() => goTo('settings')}
        />
      )}

      {/* Clipped: a screen sliding in must not make the window itself scroll. */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Both screens stay mounted; switching tabs only hides one, with no reload and no lost scroll position. */}
        <div
          className={cn(
            'animate-screen-in flex min-h-0 flex-1 flex-col',
            tab !== 'game' && 'hidden',
          )}
        >
          {game.isOnAnotherAccount ? (
            <GameOnAnotherAccount onAddAccount={handleAddAccount} />
          ) : game.appid === null ? (
            <NoGame
              error={libraryError}
              isLoading={isLibraryLoading}
              onRetry={handleRetryLibrary}
            />
          ) : (
            <Game
              key={game.appid}
              appid={game.appid}
              isRunning={game.isRunning}
            />
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
