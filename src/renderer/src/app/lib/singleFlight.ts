/**
 * Runs one task at a time: a call made while the previous task has not
 * finished is dropped, not queued. For a submit that a held Enter key, or a
 * second click, would otherwise start again: the pending flag a component
 * keeps in state is only seen by the next render, and a key repeats sooner.
 * A task that fails does not hold the next one back.
 */
export function singleFlight(): (task: () => Promise<void>) => Promise<void> {
  let isRunning = false;

  return async (task) => {
    if (isRunning) return;
    isRunning = true;
    try {
      await task();
    } finally {
      isRunning = false;
    }
  };
}
