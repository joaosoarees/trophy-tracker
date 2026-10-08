import { LayoutGrid, Pin, Settings, Trophy } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useSessionState } from '@app/hooks/useSessionState';
import { useT } from '@app/hooks/useT';
import { connectStore, useStore } from '@app/store';
import { isLanguage, LANGUAGE_CODES, LANGUAGES } from '@shared/i18n';
import type { IAppState } from '@shared/types';

import { Empty } from './components/bits';
import { Button } from './primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './primitives/dialog';
import { Dashboard } from './screens/Dashboard';
import { GameScreen } from './screens/Game';
import { Onboarding } from './screens/Onboarding';
import { cn } from './utils/cn';

type Tab = 'game' | 'dashboard' | 'settings';

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        '-mb-px flex items-center gap-1.5 border-b-2 px-2.5 pt-2 pb-2 text-sm font-medium transition-colors [&_svg]:size-4',
        active
          ? 'border-primary text-foreground'
          : 'text-muted-foreground hover:text-foreground border-transparent',
      )}
    >
      {children}
    </button>
  );
}

export function App() {
  const t = useT();
  const [state, setState] = useState<IAppState | null>(null);
  /** Language in use when reconfiguration started, or `null` outside of it. */
  const [reconfiguring, setReconfiguring] = useState<string | null>(null);
  // Tab, picked game and already-seen running game survive the reload of a language change.
  const [tab, setTab] = useSessionState<Tab>('view-tab', 'game');
  const { current, failures, language, setLanguage } = useStore(
    useShallow((state) => ({
      current: state.session.current,
      failures: state.session.failures,
      language: state.session.language,
      setLanguage: state.session.setLanguage,
    })),
  );
  /** Game picked in the dashboard; holds until a game is opened on Steam. */
  const [picked, setPicked] = useSessionState<number | null>(
    'view-picked',
    null,
  );
  const [seenRunning, setSeenRunning] = useSessionState<number | null>(
    'view-seen-running',
    null,
  );
  const [onTop, setOnTop] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const applyState = useCallback(
    (next: IAppState) => {
      setLanguage(next.language);
      setState(next);
    },
    [setLanguage],
  );
  const refreshState = useCallback(
    () => window.api.getState().then(applyState),
    [applyState],
  );

  useEffect(() => {
    void refreshState();
    void window.api.getAlwaysOnTop().then(setOnTop);
  }, [refreshState]);

  useEffect(() => {
    document.title = t.appTitle;
    document.documentElement.lang = language;
  }, [t, language]);

  useEffect(() => {
    if (state?.configured) return connectStore();
  }, [state?.configured]);

  // A read failed: check whether the key stopped being valid.
  useEffect(() => {
    if (failures > 0) void refreshState();
  }, [failures, refreshState]);

  // Opening a game on Steam brings the app to it, once per opened game: reloading the window
  // with the same game still running does not undo what the user picked afterwards.
  const runningAppId =
    current === null ? undefined : current.running ? current.appid : null;
  useEffect(() => {
    if (runningAppId === undefined || runningAppId === seenRunning) return;
    setSeenRunning(runningAppId);
    if (runningAppId === null) return;
    setPicked(null);
    setTab('game');
  }, [runningAppId, seenRunning, setSeenRunning, setPicked, setTab]);

  if (!state) return null;

  if (!state.configured || reconfiguring !== null) {
    // Redoing the setup with the app already in use: if the language changed along the way, what is
    // loaded came from Steam in the old language, and only a reload guarantees none of it is left.
    const leave = (next?: IAppState): void => {
      if (reconfiguring !== null && language !== reconfiguring)
        return window.location.reload();
      setReconfiguring(null);
      if (next) applyState(next);
    };
    return (
      <Onboarding
        state={state}
        onCancel={
          reconfiguring !== null && state.configured ? () => leave() : undefined
        }
        onDone={leave}
      />
    );
  }

  // Achievement names and art come from Steam already translated; reloading guarantees nothing old stays on screen.
  const changeLanguage = async (value: string): Promise<void> => {
    if (!isLanguage(value) || value === language) return;
    await window.api.setLanguage(value);
    window.location.reload();
  };

  const appid = picked ?? current?.appid ?? null;
  const running = current?.running === true && appid === current.appid;

  return (
    <div className="flex h-screen flex-col">
      <nav className="flex items-center gap-1 border-b px-2">
        <TabButton active={tab === 'game'} onClick={() => setTab('game')}>
          <Trophy />
          {t.nav.game}
        </TabButton>
        <TabButton
          active={tab === 'dashboard'}
          onClick={() => setTab('dashboard')}
        >
          <LayoutGrid />
          {t.nav.dashboard}
        </TabButton>
        <span className="flex-1" />
        <Button
          size="icon-sm"
          variant="ghost"
          title={onTop ? t.nav.unpinWindow : t.nav.pinWindow}
          className={cn(onTop && 'text-primary hover:text-primary')}
          onClick={() => void window.api.setAlwaysOnTop(!onTop).then(setOnTop)}
        >
          <Pin className={cn(onTop && 'fill-current')} />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          title={t.nav.settings}
          className={cn(
            tab === 'settings' && 'text-primary hover:text-primary',
          )}
          onClick={() => setTab('settings')}
        >
          <Settings />
        </Button>
      </nav>

      {/* Both screens stay mounted; switching tabs only hides one, with no reload and no lost scroll position. */}
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col',
          tab !== 'game' && 'hidden',
        )}
      >
        {appid === null ? (
          <Empty>{t.game.none}</Empty>
        ) : (
          <GameScreen key={appid} appid={appid} running={running} />
        )}
      </div>

      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col',
          tab !== 'dashboard' && 'hidden',
        )}
      >
        <Dashboard
          onPick={(id) => {
            setPicked(id);
            setTab('game');
          }}
        />
      </div>

      {tab === 'settings' && (
        <section className="flex flex-1 flex-col items-start gap-3 overflow-y-auto p-4">
          <h1 className="text-xl font-semibold">{t.settings.title}</h1>
          {state.profile && (
            <div className="bg-card flex w-full items-center gap-3 rounded-lg border p-3">
              {state.profile.avatar && (
                <img
                  src={state.profile.avatar}
                  alt=""
                  className="size-12 rounded-md"
                />
              )}
              <div>
                <strong className="block">
                  {state.profile.name || t.settings.account}
                </strong>
                <small className="text-muted-foreground">
                  {t.settings.steamId(state.profile.steamId)}
                </small>
              </div>
            </div>
          )}

          <label className="flex w-full flex-col gap-1.5">
            <span className="font-medium">{t.settings.language}</span>
            <select
              value={language}
              onChange={(e) => void changeLanguage(e.target.value)}
              className="bg-muted text-foreground h-9 w-full rounded-md border px-2"
            >
              {LANGUAGE_CODES.map((code) => (
                <option key={code} value={code}>
                  {LANGUAGES[code].label}
                </option>
              ))}
            </select>
            <small className="text-muted-foreground">
              {t.settings.languageHint}
            </small>
          </label>

          <Button
            variant="secondary"
            onClick={() => setReconfiguring(language)}
          >
            {t.settings.redo}
          </Button>
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirmingReset(true)}
          >
            {t.settings.erase}
          </Button>

          <Dialog open={confirmingReset} onOpenChange={setConfirmingReset}>
            <DialogContent className="max-w-[min(24rem,calc(100vw-2rem))]">
              <DialogHeader>
                <DialogTitle>{t.settings.eraseTitle}</DialogTitle>
                <DialogDescription>
                  {t.settings.eraseDescription}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setConfirmingReset(false)}
                >
                  {t.common.cancel}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setConfirmingReset(false);
                    void window.api.resetConfig().then(applyState);
                  }}
                >
                  {t.settings.eraseConfirm}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </section>
      )}
    </div>
  );
}
