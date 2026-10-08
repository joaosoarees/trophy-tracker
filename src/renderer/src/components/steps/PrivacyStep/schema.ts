import { z } from 'zod';

/** No typed field: the value is filled in when the check with Steam passes. */
export const privacyStepSchema = z.object({
  gamesWithPlaytime: z.number('privacyRequired').int().min(0),
});
