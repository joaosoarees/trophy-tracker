import { useT } from '@app/hooks/useT';
import { type Language, LANGUAGE_CODES, LANGUAGES } from '@shared/i18n';
import { NativeSelect } from '@ui/components/NativeSelect';

interface ILanguageFieldProps {
  value: Language;
  onChange: (value: string) => void;
}

export function LanguageField({ value, onChange }: ILanguageFieldProps) {
  const t = useT();

  return (
    <label className="flex w-full flex-col gap-1.5">
      <span className="font-medium">{t.settings.language}</span>
      <NativeSelect
        label={t.settings.language}
        value={value}
        onChange={onChange}
        options={LANGUAGE_CODES.map((code) => ({
          value: code,
          label: LANGUAGES[code].label,
        }))}
        className="h-9 w-full text-sm"
      />
      <small className="text-muted-foreground">{t.settings.languageHint}</small>
    </label>
  );
}
