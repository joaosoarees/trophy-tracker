import { useT } from '@app/hooks/useT';
import { Button } from '@ui/primitives/button';

import { EraseDialog } from './components/EraseDialog';
import { LanguageField } from './components/LanguageField';
import { ProfileCard } from './components/ProfileCard';
import { useSettingsController } from './useSettingsController';

export function Settings() {
  const t = useT();
  const {
    profile,
    language,
    isConfirmingErase,
    setIsConfirmingErase,
    handleChangeLanguage,
    handleErase,
    handleRedoSetup,
  } = useSettingsController();

  return (
    <section className="flex flex-1 flex-col items-start gap-3 overflow-y-auto p-4">
      <h1 className="text-xl font-semibold">{t.settings.title}</h1>

      {profile && <ProfileCard profile={profile} />}

      <LanguageField value={language} onChange={handleChangeLanguage} />

      <Button variant="secondary" onClick={handleRedoSetup}>
        {t.settings.redo}
      </Button>
      <Button
        variant="ghost"
        className="text-destructive hover:text-destructive"
        onClick={() => setIsConfirmingErase(true)}
      >
        {t.settings.erase}
      </Button>

      <EraseDialog
        open={isConfirmingErase}
        onOpenChange={setIsConfirmingErase}
        onConfirm={handleErase}
      />
    </section>
  );
}
