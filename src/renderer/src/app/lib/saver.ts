/** Batches writes: only the latest version of each key is saved, after a pause. */
export function createSaver<T>(
  save: (key: string, value: T) => void,
  delay = 500,
) {
  const pending = new Map<
    string,
    { value: T; timer: ReturnType<typeof setTimeout> }
  >();

  const commit = (key: string): void => {
    const entry = pending.get(key);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(key);
    save(key, entry.value);
  };

  return {
    schedule(key: string, value: T): void {
      const previous = pending.get(key);
      if (previous) clearTimeout(previous.timer);
      pending.set(key, { value, timer: setTimeout(() => commit(key), delay) });
    },
    /** Writes everything that is waiting (when the window closes, for example). */
    flush(): void {
      for (const key of [...pending.keys()]) commit(key);
    },
  };
}
