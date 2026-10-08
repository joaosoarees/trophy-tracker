import { z } from 'zod';

import { API_KEY_PATTERN, STEAM_ID_PATTERN } from '@shared/validation';

export const accountStepSchema = z.object({
  steamId: z.string().trim().regex(STEAM_ID_PATTERN, 'steamIdFormat'),
  apiKey: z.string().trim().regex(API_KEY_PATTERN, 'apiKeyFormat'),
  /**
   * No typed field: filled in when Steam accepts the key for that SteamID and
   * lets the achievements be read. Required to move on.
   */
  verified: z.object(
    {
      name: z.string(),
      avatar: z.string(),
      gamesWithPlaytime: z.number().int().min(0),
    },
    'verificationRequired',
  ),
});
