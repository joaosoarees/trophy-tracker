import { RefreshCw } from 'lucide-react';

import { useT } from '@app/hooks/useT';
import { Button } from '@ui/primitives/button';
import { cn } from '@ui/utils/cn';

import { EraseDialog } from './components/EraseDialog';
import { LanguageField } from './components/LanguageField';
import { ProfileCard } from './components/ProfileCard';
import { UpdateNotice } from './components/UpdateNotice';
import { useSettingsController } from './useSettingsController';

export function Settings() {
  const t = useT();
  const {
    profile,
    language,
    appInfo,
    isConfirmingErase,
    setIsConfirmingErase,
    handleChangeLanguage,
    handleErase,
    handleRedoSetup,
    handleDownload,
    handleInstallUpdate,
    handleLearnAboutBlock,
    updateCheck,
    handleCheckForUpdates,
  } = useSettingsController();

  return (
    <section className="flex flex-1 flex-col items-start gap-3 overflow-y-auto p-4">
      <h1 className="text-xl font-semibold">{t.settings.title}</h1>

      {appInfo?.newVersion && (
        <UpdateNotice
          version={appInfo.newVersion}
          status={appInfo.updateStatus}
          onDownload={handleDownload}
          onInstall={handleInstallUpdate}
          onLearnMore={handleLearnAboutBlock}
        />
      )}

      {profile && <ProfileCard profile={profile} />}

      <LanguageField value={language} onChange={handleChangeLanguage} />

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={handleRedoSetup}>
          {t.settings.redo}
        </Button>
        <Button
          variant="outline"
          // Red on the usual hover tint fails contrast; a red tint keeps it readable.
          className="border-destructive/50 text-destructive hover:bg-destructive/15 hover:text-destructive dark:border-destructive/50 dark:bg-transparent dark:hover:bg-destructive/15"
          onClick={() => setIsConfirmingErase(true)}
        >
          {t.settings.erase}
        </Button>
      </div>

      <EraseDialog
        open={isConfirmingErase}
        onOpenChange={setIsConfirmingErase}
        onConfirm={handleErase}
      />

      <footer className="mt-auto flex w-full flex-col gap-2 pt-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            variant="outline"
            size="sm"
            disabled={updateCheck === 'checking'}
            onClick={handleCheckForUpdates}
          >
            <RefreshCw
              className={cn(updateCheck === 'checking' && 'animate-spin')}
            />
            {updateCheck === 'checking'
              ? t.settings.checkingForUpdates
              : t.settings.checkForUpdates}
          </Button>
          {/* Announced when it changes; a version that was found shows in the notice instead. */}
          <span role="status" className="text-muted-foreground text-xs">
            {updateCheck === 'failed' && t.settings.updateCheckFailed}
            {updateCheck === 'upToDate' &&
              !appInfo?.newVersion &&
              t.settings.upToDate}
          </span>
        </div>
        <p className="text-muted-foreground text-xs">
          {t.appTitle}
          {appInfo && ` · ${t.settings.version(appInfo.version)}`} ·{' '}
          {t.notAffiliated}
        </p>
      </footer>
    </section>
  );
}
