import { describe, expect, it } from 'vitest';

import { en } from '@shared/i18n/locales/en';
import { KEY, STEAM_ID } from '@test/helpers';
import { accountStepSchema } from '@ui/screens/Onboarding/steps/AccountStep/schema';
import { languageStepSchema } from '@ui/screens/Onboarding/steps/LanguageStep/schema';

describe('onboarding schemas', () => {
  it('accept valid values, trimming surrounding whitespace', () => {
    expect(languageStepSchema.parse({ language: 'pt-BR' })).toEqual({
      language: 'pt-BR',
    });
    expect(
      accountStepSchema.parse({
        steamId: ` ${STEAM_ID} `,
        apiKey: `${KEY}\n`,
      }),
    ).toEqual({ steamId: STEAM_ID, apiKey: KEY });
  });

  it('rejects an unknown language', () => {
    const result = languageStepSchema.safeParse({ language: 'xx' });

    expect(result.error?.issues[0].message).toBe('languageRequired');
  });

  it('rejects a badly formed account, naming each problem by its message key', () => {
    const result = accountStepSchema.safeParse({
      steamId: '12345',
      apiKey: 'short',
    });

    expect(
      result.error?.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      ),
    ).toEqual(['steamId: steamIdFormat', 'apiKey: apiKeyFormat']);
  });

  it.each([
    'languageRequired',
    'steamIdFormat',
    'apiKeyFormat',
    'verificationRequired',
  ])('the message key %s exists in the translations', (key) => {
    expect(en.validation).toHaveProperty(key);
  });
});
