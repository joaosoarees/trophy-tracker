import { describe, expect, it } from 'vitest';

import { en } from '@shared/i18n/locales/en';

import { languageStepSchema } from './schema';

describe('languageStepSchema', () => {
  it('should accept the language when the app has it', () => {
    const chosen = { language: 'pt-BR' };

    const values = languageStepSchema.parse(chosen);

    expect(values).toEqual({ language: 'pt-BR' });
  });

  it('should reject the language with the message key languageRequired when the app does not have it', () => {
    const chosen = { language: 'xx' };

    const result = languageStepSchema.safeParse(chosen);

    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: ['language'],
        message: 'languageRequired',
      }),
    ]);
  });

  it('should have a translation for the message key languageRequired', () => {
    const hasTranslation = 'languageRequired' in en.validation;

    expect(hasTranslation).toBe(true);
  });
});
