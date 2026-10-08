import { describe, expect, it } from 'vitest';

import { onboardingSchema } from '../src/renderer/src/ui/screens/Onboarding/schema';
import { accountStepSchema } from '../src/renderer/src/ui/screens/Onboarding/steps/AccountStep/schema';
import { languageStepSchema } from '../src/renderer/src/ui/screens/Onboarding/steps/LanguageStep/schema';
import { en } from '../src/shared/i18n/locales/en';

import { KEY, STEAM_ID } from './helpers';

const verified = { name: 'joao', avatar: '', gamesWithPlaytime: 3 };

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

  it('reject invalid values with a message key that exists in the translations', () => {
    const issues = (value: unknown) =>
      accountStepSchema
        .safeParse(value)
        .error?.issues.map(
          (issue) => `${issue.path.join('.')}: ${issue.message}`,
        );

    expect(
      languageStepSchema.safeParse({ language: 'xx' }).error?.issues[0].message,
    ).toBe('languageRequired');
    expect(issues({ steamId: '12345', apiKey: 'short' })).toEqual([
      'steamId: steamIdFormat',
      'apiKey: apiKeyFormat',
      'verified: verificationRequired',
    ]);
    for (const key of [
      'languageRequired',
      'steamIdFormat',
      'apiKeyFormat',
      'verificationRequired',
    ]) {
      expect(en.validation).toHaveProperty(key);
    }
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
