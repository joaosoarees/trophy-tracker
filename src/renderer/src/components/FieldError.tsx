import { ErrorMessage } from '@hookform/error-message'
import { useFormContext, type FieldPath } from 'react-hook-form'
import type { OnboardingFormData } from '@/Onboarding'
import { useT } from '@/lib/i18n'

/**
 * Erro de um campo do onboarding. Os schemas guardam a chave da mensagem (não o texto),
 * para o erro acompanhar a troca de idioma; o que vem da Steam já chega traduzido.
 */
export function FieldError({ name }: { name: FieldPath<OnboardingFormData> | 'root' }) {
  const { formState } = useFormContext<OnboardingFormData>()
  const t = useT()

  return (
    <ErrorMessage
      errors={formState.errors}
      name={name}
      render={({ message }) => (
        <small className="text-destructive mt-1.5 block">
          {message in t.validation ? t.validation[message as keyof typeof t.validation] : message}
        </small>
      )}
    />
  )
}
