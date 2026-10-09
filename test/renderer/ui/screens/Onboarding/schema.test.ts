import { describe, expect, it } from 'vitest';

import { en } from '@shared/i18n/locales/en';
import { KEY, STEAM_ID } from '@test/helpers';
import { onboardingSchema } from '@ui/screens/Onboarding/schema';
import { accountStepSchema } from '@ui/screens/Onboarding/steps/AccountStep/schema';
import { languageStepSchema } from '@ui/screens/Onboarding/steps/LanguageStep/schema';

const verified = { name: 'player', avatar: '', gamesWithPlaytime: 3 };

describe('onboarding schemas', () => {
  it('accept valid values, trimming surrounding whitespace', () => {
    expect(languageStepSchema.parse({ language: 'pt-BR' })).toEqual({
      language: 'pt-BR',
    });
    expect(
      accountStepSchema.parse({
        steamId: ` ${STEAM_ID} `,
        apiKey: `${KEY}\n`,
        verified,
      }),
    ).toEqual({ steamId: STEAM_ID, apiKey: KEY, verified });
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
    ).toEqual([
      'steamId: steamIdFormat',
      'apiKey: apiKeyFormat',
      'verified: verificationRequired',
    ]);
  });

  it.each([
    'languageRequired',
    'steamIdFormat',
    'apiKeyFormat',
    'verificationRequired',
  ])('the message key %s exists in the translations', (key) => {
    expect(en.validation).toHaveProperty(key);
  });

  it('the form cannot be finished with a well-formed key that was never verified', () => {
    const form = {
      languageStep: { language: 'en' },
      accountStep: { steamId: STEAM_ID, apiKey: KEY },
    };
    expect(onboardingSchema.safeParse(form).success).toBe(false);
    expect(
      onboardingSchema.safeParse({
        ...form,
        accountStep: { ...form.accountStep, verified },
      }).success,
    ).toBe(true);
  });
});
