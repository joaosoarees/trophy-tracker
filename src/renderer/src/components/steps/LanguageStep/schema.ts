import { z } from 'zod';
import { LANGUAGE_CODES } from '../../../../../shared/i18n';

export const languageStepSchema = z.object({
  language: z.enum(LANGUAGE_CODES, 'languageRequired'),
});
