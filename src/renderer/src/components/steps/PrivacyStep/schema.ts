import { z } from 'zod'

/** Sem campo digitado: o valor é preenchido quando a verificação com a Steam passa. */
export const privacyStepSchema = z.object({
  gamesWithPlaytime: z.number('privacyRequired').int().min(0)
})
