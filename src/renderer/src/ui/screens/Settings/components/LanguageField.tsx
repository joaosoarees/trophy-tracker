import { useT } from '@app/hooks/useT';
import { type Language, LANGUAGE_CODES, LANGUAGES } from '@shared/i18n';

interface ILanguageFieldProps {
  value: Language;
  onChange: (value: string) => void;
}

export function LanguageField({ value, onChange }: ILanguageFieldProps) {
  const t = useT();

  return (
    <label className="flex w-full flex-col gap-1.5">
      <span className="font-medium">{t.settings.language}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-muted text-foreground h-9 w-full rounded-md border px-2"
      >
        {LANGUAGE_CODES.map((code) => (
          <option key={code} value={code}>
            {LANGUAGES[code].label}
          </option>
        ))}
      </select>
      <small className="text-muted-foreground">{t.settings.languageHint}</small>
    </label>
  );
}
