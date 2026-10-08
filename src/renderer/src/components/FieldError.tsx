import { ErrorMessage } from '@hookform/error-message';
import { useFormContext, type FieldPath } from 'react-hook-form';
import type { OnboardingFormData } from '@/Onboarding';
import { useT } from '@/lib/i18n';

/**
 * Error of an onboarding field. The schemas hold the message key (not the text),
 * so the error follows a language change; what comes from Steam is already translated.
 */
export function FieldError({
  name,
}: {
  name: FieldPath<OnboardingFormData> | 'root';
}) {
  const { formState } = useFormContext<OnboardingFormData>();
  const t = useT();

  return (
    <ErrorMessage
      errors={formState.errors}
      name={name}
      render={({ message }) => (
        <small className="text-destructive mt-1.5 block">
          {message in t.validation
            ? t.validation[message as keyof typeof t.validation]
            : message}
        </small>
      )}
    />
  );
}
