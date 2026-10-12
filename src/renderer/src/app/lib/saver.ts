interface ISaverOptions<T> {
  /** Persists the value; rejects when it could not be saved. */
  save: (key: string, value: T) => Promise<unknown>;
  /**
   * A save failed and nothing newer is waiting: the screen is showing
   * something that was never saved. `saved` is the last value known to be
   * saved (`undefined` when there was none) and is what should be put back.
   */
  onRollback: (key: string, saved: T | undefined) => void;
  delay?: number;
}

/**
 * Optimistic, batched writes. The caller updates the screen right away and
 * schedules the save; only the latest version of each key is written, after a
 * pause. If the write fails, the caller is told what to roll back to.
 */
export function createSaver<T>({
  save,
  onRollback,
  delay = 500,
}: ISaverOptions<T>) {
  const pending = new Map<
    string,
    { value: T; timer: ReturnType<typeof setTimeout> }
  >();
  /**
   * What is known of every key with an edit not settled yet: the last value
   * known to be saved, and the saves of it, which are numbered as they start.
   * More than one can be under way (an edit flushed while the one before is
   * being written), and each carries the whole value, so only the answer of
   * the newest one decides what the screen goes back to.
   */
  const unsettled = new Map<
    string,
    { saved: T | undefined; started: number; written: number; ended: number }
  >();

  /** Resolves once the save ended, whatever became of it. */
  const commit = (key: string): Promise<void> => {
    const entry = pending.get(key);
    const state = unsettled.get(key);
    if (!entry || !state) return Promise.resolve();
    clearTimeout(entry.timer);
    pending.delete(key);
    state.started += 1;
    const turn = state.started;

    return save(key, entry.value)
      .then(
        () => {
          // The baseline of whatever comes after, unless a later save was
          // written before this one answered.
          if (turn > state.written) {
            state.written = turn;
            state.saved = entry.value;
          }
        },
        () => {
          // A newer edit, waiting or being written, carries the whole value
          // and is answered in its turn.
          if (pending.has(key) || turn < state.started) return;
          onRollback(key, state.saved);
        },
      )
      .finally(() => {
        state.ended += 1;
        const isSettled = !pending.has(key) && state.ended === state.started;
        if (isSettled) unsettled.delete(key);
      });
  };

  /** `previous` is the value on screen before this edit. */
  const schedule = (key: string, value: T, previous: T | undefined): void => {
    if (!unsettled.has(key)) {
      unsettled.set(key, { saved: previous, started: 0, written: 0, ended: 0 });
    }

    const waiting = pending.get(key);
    if (waiting) clearTimeout(waiting.timer);
    pending.set(key, {
      value,
      timer: setTimeout(() => void commit(key), delay),
    });
  };

  return {
    schedule,
    /** Writes everything that is waiting (when the window closes, for example). */
    flush(): void {
      for (const key of [...pending.keys()]) void commit(key);
    },
    /**
     * An edit that does not wait for the pause, such as a choice made in one
     * click. Resolves once its save ended, whatever became of it.
     */
    write(key: string, value: T, previous: T | undefined): Promise<void> {
      schedule(key, value, previous);
      return commit(key);
    },
  };
}
