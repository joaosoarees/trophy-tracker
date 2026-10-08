import { z } from 'zod';

import { accountStepSchema } from './steps/AccountStep/schema';
import { apiKeyStepSchema } from './steps/ApiKeyStep/schema';
import { languageStepSchema } from './steps/LanguageStep/schema';
import { privacyStepSchema } from './steps/PrivacyStep/schema';

/** One form for the whole onboarding, with one schema per step. */
export const onboardingSchema = z.object({
  languageStep: languageStepSchema,
  accountStep: accountStepSchema,
  apiKeyStep: apiKeyStepSchema,
  privacyStep: privacyStepSchema,
});

export type OnboardingFormData = z.infer<typeof onboardingSchema>;
