import { describe, expect, it } from 'vitest';

import { en } from '@shared/i18n/locales/en';
import { KEY, STEAM_ID } from '@tests/helpers';

import { accountStepSchema } from './schema';

describe('accountStepSchema', () => {
  it('should accept the account, trimming surrounding whitespace, when it is well formed', () => {
    const typed = { steamId: ` ${STEAM_ID} `, apiKey: `${KEY}\n` };

    const account = accountStepSchema.parse(typed);

    expect(account).toEqual({ steamId: STEAM_ID, apiKey: KEY });
  });

  it.each([
    { field: 'steamId', value: '12345', message: 'steamIdFormat' },
    { field: 'apiKey', value: 'short', message: 'apiKeyFormat' },
  ])(
    'should reject the account with the message key $message when $field is badly formed',
    ({ field, value, message }) => {
      const typed = { steamId: STEAM_ID, apiKey: KEY, [field]: value };

      const result = accountStepSchema.safeParse(typed);

      expect(result.error?.issues).toEqual([
        expect.objectContaining({ path: [field], message }),
      ]);
    },
  );

  it.each(['steamIdFormat', 'apiKeyFormat', 'verificationRequired'])(
    'should have a translation for the message key %s',
    (key) => {
      const hasTranslation = key in en.validation;

      expect(hasTranslation).toBe(true);
    },
  );
});
