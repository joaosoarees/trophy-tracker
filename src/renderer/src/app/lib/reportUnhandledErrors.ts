import { SystemService } from '@app/services/SystemService';

/** Sends errors that no screen caught to the local log file. Call once, at startup. */
export function reportUnhandledErrors(): void {
  window.addEventListener('error', (event) => {
    const error: unknown = event.error;
    SystemService.logError(
      'error',
      error instanceof Error ? (error.stack ?? error.message) : event.message,
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason: unknown = event.reason;
    SystemService.logError(
      'unhandledrejection',
      reason instanceof Error
        ? (reason.stack ?? reason.message)
        : String(reason),
    );
  });
}
