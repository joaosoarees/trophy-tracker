import { z } from 'zod';

import { accountStepSchema } from './steps/AccountStep/schema';
import { languageStepSchema } from './steps/LanguageStep/schema';

/** One form for the whole onboarding, with one schema per step. */
export const onboardingSchema = z.object({
  languageStep: languageStepSchema,
  accountStep: accountStepSchema,
});

export type OnboardingFormData = z.infer<typeof onboardingSchema>;
