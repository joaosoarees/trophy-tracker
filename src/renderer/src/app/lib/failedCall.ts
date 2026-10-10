import { SystemService } from '@app/services/SystemService';
import { type Messages } from '@shared/i18n';

/**
 * What to show for a call to the main process that rejected: a write the
 * disk refused, or the call itself failing. What Steam refuses is not this:
 * the checks answer it as a result, with its own words. The error is written
 * to the log, as one nobody caught would be, and the answer is the text for
 * whoever asked to show where the user is looking.
 */
export function explainFailedCall(error: unknown, messages: Messages): string {
  SystemService.logError(
    'failed call',
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
  return messages.errors.unexpected;
}
