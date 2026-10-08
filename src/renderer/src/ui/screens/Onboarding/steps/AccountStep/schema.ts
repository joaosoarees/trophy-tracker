import { z } from 'zod';

import { STEAM_ID_PATTERN } from '@shared/validation';

export const accountStepSchema = z.object({
  steamId: z.string().trim().regex(STEAM_ID_PATTERN, 'steamIdFormat'),
});
