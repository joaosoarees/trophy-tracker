import { z } from 'zod';

import { API_KEY_PATTERN, isSteamId } from '@shared/validation';

/**
 * The account being typed. Whether Steam accepts it is not a form value: an
 * account that was verified is saved at once and leaves the form for the
 * list above it.
 */
export const accountStepSchema = z.object({
  steamId: z.string().trim().refine(isSteamId, 'steamIdFormat'),
  apiKey: z.string().trim().regex(API_KEY_PATTERN, 'apiKeyFormat'),
});
