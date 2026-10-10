import { describe, expect, it } from 'vitest';

import { KEY, STEAM_ID } from '@tests/helpers';

import { onboardingSchema } from './schema';

/** The whole form filled in validly. */
const makeForm = () => ({
  languageStep: { language: 'pt-BR' },
  accountStep: { steamId: STEAM_ID, apiKey: KEY },
});

describe('onboardingSchema', () => {
  it('should accept the form when both steps are well filled in', () => {
    const typed = makeForm();

    const form = onboardingSchema.parse(typed);

    expect(form).toEqual({
      languageStep: { language: 'pt-BR' },
      accountStep: { steamId: STEAM_ID, apiKey: KEY },
    });
  });

  it('should reject the form, naming the step and its field, when the language is not one the app has', () => {
    const typed = { ...makeForm(), languageStep: { language: 'xx' } };

    const result = onboardingSchema.safeParse(typed);

    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: ['languageStep', 'language'],
        message: 'languageRequired',
      }),
    ]);
  });

  it('should reject the form, naming the step and its field, when the key of the account is badly formed', () => {
    const typed = {
      ...makeForm(),
      accountStep: { steamId: STEAM_ID, apiKey: 'short' },
    };

    const result = onboardingSchema.safeParse(typed);

    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: ['accountStep', 'apiKey'],
        message: 'apiKeyFormat',
      }),
    ]);
  });
});
