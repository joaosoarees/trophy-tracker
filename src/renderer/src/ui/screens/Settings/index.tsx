import { ExternalLink } from 'lucide-react';
import { useId } from 'react';

import { useT } from '@app/hooks/useT';
import { LANGUAGE_CODES, LANGUAGES } from '@shared/i18n';
import { AccountCard, AddAccountCard } from '@ui/components/AccountCard';
import { DetailGroup, DetailRow } from '@ui/components/DetailList';
import { OptionSelect } from '@ui/components/OptionSelect';
import { Switch } from '@ui/components/Switch';
import { Button } from '@ui/primitives/button';

import { AccountDetails } from './components/AccountDetails';
import { UpdateNotice } from './components/UpdateNotice';
import { useSettingsController } from './useSettingsController';

export function Settings() {
  const t = useT();
  const accountsId = useId();
  const {
    accounts,
    activeAccount,
    language,
    appInfo,
    checkState,
    alwaysOnTop,
    preferences,
    dataFolder,
    handleChangeLanguage,
    handleSwitchAccount,
    handleAddAccount,
    handleToggleAlwaysOnTop,
    handleRememberWindowChange,
    handleOpenDataFolder,
    handleCheckForUpdates,
    handleInstallUpdate,
    handleOpenPage,
  } = useSettingsController();

  // What the last check found, said where the version is.
  const versionState =
    checkState === 'checking'
      ? t.settings.checkingForUpdates
      : checkState === 'failed'
        ? t.settings.updateCheckFailed
        : checkState === 'upToDate' && !appInfo?.newVersion
          ? t.settings.upToDate
          : undefined;

  return (
    <section className="relative flex flex-1 flex-col gap-6 overflow-y-auto p-4">
      <h1 className="text-xl font-semibold">{t.settings.title}</h1>

      {appInfo?.newVersion && (
        <UpdateNotice
          version={appInfo.newVersion}
          status={appInfo.updateStatus}
          onDownload={() => handleOpenPage('download')}
          onInstall={handleInstallUpdate}
          onLearnMore={() => handleOpenPage('smartAppControl')}
        />
      )}

      {/* Not a group of rows: each account is a card that holds everything about it. */}
      <section aria-labelledby={accountsId}>
        <h2 id={accountsId} className="pb-2 font-semibold">
          {t.accounts.title}
        </h2>
        <ul className="flex flex-col gap-2">
          {accounts.map((account) => {
            const isActive = account.steamId === activeAccount?.steamId;

            return (
              <AccountCard
                key={account.steamId}
                account={account}
                isActive={isActive}
                onSelect={() => handleSwitchAccount(account.steamId)}
              >
                {isActive && <AccountDetails account={account} />}
              </AccountCard>
            );
          })}
          <AddAccountCard onAdd={handleAddAccount} />
        </ul>
      </section>

      <DetailGroup title={t.settings.groups.window}>
        <DetailRow
          label={t.settings.language}
          description={t.settings.languageHint}
        >
          <OptionSelect
            label={t.settings.language}
            value={language}
            onChange={handleChangeLanguage}
            options={LANGUAGE_CODES.map((code) => ({
              value: code,
              label: LANGUAGES[code].label,
            }))}
            className="w-44"
          />
        </DetailRow>
        <DetailRow
          label={t.settings.alwaysOnTop}
          description={t.settings.alwaysOnTopHint}
        >
          <Switch
            label={t.settings.alwaysOnTop}
            checked={alwaysOnTop}
            onChange={handleToggleAlwaysOnTop}
          />
        </DetailRow>
        <DetailRow label={t.settings.rememberWindow}>
          <Switch
            label={t.settings.rememberWindow}
            checked={preferences.rememberWindow}
            onChange={handleRememberWindowChange}
          />
        </DetailRow>
      </DetailGroup>

      <DetailGroup title={t.settings.groups.data}>
        <DetailRow label={t.settings.privacy} />
        {dataFolder && (
          <DetailRow
            label={t.settings.dataFolder}
            description={
              <span className="break-all select-text">{dataFolder.path}</span>
            }
          >
            <Button
              size="sm"
              variant="secondary"
              onClick={handleOpenDataFolder}
            >
              {dataFolder.canOpen ? t.settings.openFolder : t.settings.copyPath}
            </Button>
          </DetailRow>
        )}
        <DetailRow
          label={t.settings.errorLog}
          description={t.settings.errorLogHint}
        />
      </DetailGroup>

      <DetailGroup title={t.settings.groups.about}>
        <DetailRow
          label={t.settings.versionLabel}
          description={
            // Announced when it changes; a version that was found shows in the notice above.
            <span role="status">{versionState}</span>
          }
        >
          {appInfo?.version}
          <Button
            size="sm"
            variant="secondary"
            disabled={checkState === 'checking'}
            onClick={handleCheckForUpdates}
          >
            {t.settings.checkForUpdates}
          </Button>
        </DetailRow>
        <DetailRow
          label={t.settings.source}
          onClick={() => handleOpenPage('source')}
        >
          <ExternalLink className="size-4" />
        </DetailRow>
        <DetailRow
          label={t.settings.reportIssue}
          onClick={() => handleOpenPage('issues')}
        >
          <ExternalLink className="size-4" />
        </DetailRow>
        <DetailRow
          label={t.settings.license}
          onClick={() => handleOpenPage('license')}
        >
          MIT
          <ExternalLink className="size-4" />
        </DetailRow>
      </DetailGroup>

      <footer className="text-muted-foreground mt-auto pt-2 text-center text-xs">
        {t.appTitle}
        {appInfo && ` · ${t.settings.version(appInfo.version)}`} ·{' '}
        {t.notAffiliated}
      </footer>
    </section>
  );
}
