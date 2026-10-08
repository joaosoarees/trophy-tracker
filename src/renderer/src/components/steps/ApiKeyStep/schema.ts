import { z } from 'zod';
import { API_KEY_PATTERN } from '../../../../../shared/validation';

export const apiKeyStepSchema = z.object({
  apiKey: z.string().trim().regex(API_KEY_PATTERN, 'apiKeyFormat'),
});
