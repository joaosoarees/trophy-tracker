import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { z } from 'zod'
import { isLanguage } from '../../shared/i18n'
import type { AppState } from '../../shared/types'
import { Stepper } from '@/components/Stepper'
import { AccountStep } from '@/components/steps/AccountStep'
import { accountStepSchema } from '@/components/steps/AccountStep/schema'
import { ApiKeyStep } from '@/components/steps/ApiKeyStep'
import { apiKeyStepSchema } from '@/components/steps/ApiKeyStep/schema'
import { DoneStep } from '@/components/steps/DoneStep'
import { LanguageStep } from '@/components/steps/LanguageStep'
import { languageStepSchema } from '@/components/steps/LanguageStep/schema'
import { PrivacyStep } from '@/components/steps/PrivacyStep'
import { privacyStepSchema } from '@/components/steps/PrivacyStep/schema'
import { useT } from '@/lib/i18n'
import { safeSessionStorageGetItem } from '@/lib/utils'
import { useStore } from '@/store'

const schema = z.object({
  languageStep: languageStepSchema,
  accountStep: accountStepSchema,
  apiKeyStep: apiKeyStepSchema,
  privacyStep: privacyStepSchema
})

export type OnboardingFormData = z.infer<typeof schema>

/** The draft survives a reload, but never stores the Web API key. */
type Draft = Pick<OnboardingFormData, 'languageStep' | 'accountStep'>

const DRAFT_KEY = 'onboarding-form'
const STEP_KEY = 'onboarding-step'
const API_KEY_STEP = 2

interface IOnboardingProps {
  state: AppState
  onDone: (state: AppState) => void
  onCancel?: () => void
}

export function Onboarding({ state, onDone, onCancel }: IOnboardingProps) {
  const t = useT()
  const setLanguage = useStore((store) => store.session.setLanguage)

  const draft = safeSessionStorageGetItem<Draft>(DRAFT_KEY)
  const form = useForm<OnboardingFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      languageStep: {
        language: isLanguage(draft?.languageStep?.language) ? draft.languageStep.language : state.language
      },
      accountStep: {
        steamId: draft?.accountStep?.steamId || state.profile?.steamId || ''
      },
      apiKeyStep: {
        apiKey: ''
      }
    }
  })

  useEffect(() => {
    const { unsubscribe } = form.watch((formData, { name }) => {
      const { languageStep, accountStep } = formData
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ languageStep, accountStep }))

      // Picking the language switches the screen right away, with no reload.
      if (name === 'languageStep.language' && isLanguage(languageStep?.language)) {
        setLanguage(languageStep.language)
        void window.api.setLanguage(languageStep.language)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [form, setLanguage])

  const handleStepChange = useCallback((step: number) => {
    sessionStorage.setItem(STEP_KEY, String(step))
  }, [])

  const handleSubmit = form.handleSubmit(async (formData) => {
    const next = await window.api.saveConfig(formData.accountStep.steamId, formData.apiKeyStep.apiKey)

    if (!next.configured) {
      form.setError('root', { type: 'server', message: 'saveFailed' })
      return
    }

    sessionStorage.removeItem(DRAFT_KEY)
    sessionStorage.removeItem(STEP_KEY)
    onDone(next)
  })

  // After a reload the key is gone, so the form cannot resume past the key step.
  const savedStep = Number(sessionStorage.getItem(STEP_KEY) ?? 0)
  const initialStep = Math.min(Number.isInteger(savedStep) ? savedStep : 0, API_KEY_STEP)

  return (
    <div className="mx-auto max-w-lg p-5">
      <FormProvider {...form}>
        <form onSubmit={handleSubmit} noValidate>
          <Stepper
            initialStep={initialStep}
            onStepChange={handleStepChange}
            steps={[
              {
                label: t.onboarding.steps.language,
                content: <LanguageStep notice={state.configError} onCancel={onCancel} />
              },
              {
                label: t.onboarding.steps.account,
                content: <AccountStep />
              },
              {
                label: t.onboarding.steps.apiKey,
                content: <ApiKeyStep />
              },
              {
                label: t.onboarding.steps.privacy,
                content: <PrivacyStep />
              },
              {
                label: t.onboarding.steps.done,
                content: <DoneStep />
              }
            ]}
          />
        </form>
      </FormProvider>
    </div>
  )
}
