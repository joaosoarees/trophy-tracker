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
  /** Last value known to be saved, for every key with unsaved edits. */
  const saved = new Map<string, T | undefined>();

  const commit = (key: string): void => {
    const entry = pending.get(key);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(key);

    save(key, entry.value).then(
      () => {
        // A newer edit is already waiting: what was just saved is its baseline.
        if (pending.has(key)) saved.set(key, entry.value);
        else saved.delete(key);
      },
      () => {
        // A newer edit carries the whole value and will be saved in its turn.
        if (pending.has(key)) return;
        const baseline = saved.get(key);
        saved.delete(key);
        onRollback(key, baseline);
      },
    );
  };

  return {
    /** `previous` is the value on screen before this edit. */
    schedule(key: string, value: T, previous: T | undefined): void {
      if (!saved.has(key)) saved.set(key, previous);

      const waiting = pending.get(key);
      if (waiting) clearTimeout(waiting.timer);
      pending.set(key, { value, timer: setTimeout(() => commit(key), delay) });
    },
    /** Writes everything that is waiting (when the window closes, for example). */
    flush(): void {
      for (const key of [...pending.keys()]) commit(key);
    },
  };
}
