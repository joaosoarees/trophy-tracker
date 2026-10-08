import { describe, expect, it } from 'vitest'
import { accountStepSchema } from '../src/renderer/src/components/steps/AccountStep/schema'
import { apiKeyStepSchema } from '../src/renderer/src/components/steps/ApiKeyStep/schema'
import { languageStepSchema } from '../src/renderer/src/components/steps/LanguageStep/schema'
import { privacyStepSchema } from '../src/renderer/src/components/steps/PrivacyStep/schema'
import { en } from '../src/shared/i18n/locales/en'
import { KEY, STEAM_ID } from './helpers'

const firstMessage = (result: { success: boolean; error?: { issues: { message: string }[] } }): string | undefined =>
  result.error?.issues[0]?.message

describe('schemas do onboarding', () => {
  it('aceitam valores válidos, tirando espaços das pontas', () => {
    expect(languageStepSchema.parse({ language: 'pt-BR' })).toEqual({ language: 'pt-BR' })
    expect(accountStepSchema.parse({ steamId: ` ${STEAM_ID} ` })).toEqual({ steamId: STEAM_ID })
    expect(apiKeyStepSchema.parse({ apiKey: `${KEY}\n` })).toEqual({ apiKey: KEY })
    expect(privacyStepSchema.parse({ gamesWithPlaytime: 0 })).toEqual({ gamesWithPlaytime: 0 })
  })

  it('recusam valores inválidos com uma chave de mensagem que existe nas traduções', () => {
    const failures = [
      languageStepSchema.safeParse({ language: 'fr' }),
      accountStepSchema.safeParse({ steamId: '12345' }),
      apiKeyStepSchema.safeParse({ apiKey: 'curta' }),
      privacyStepSchema.safeParse({})
    ]
    const keys = failures.map(firstMessage)
    expect(keys).toEqual(['languageRequired', 'steamIdFormat', 'apiKeyFormat', 'privacyRequired'])
    for (const key of keys) expect(en.validation).toHaveProperty(key!)
  })
})
