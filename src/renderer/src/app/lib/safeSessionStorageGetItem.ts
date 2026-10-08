/** Reads JSON from sessionStorage; returns `null` if it is missing or corrupted. */
export function safeSessionStorageGetItem<T>(key: string): T | null {
  try {
    const item = sessionStorage.getItem(key);
    return item === null ? null : (JSON.parse(item) as T);
  } catch {
    return null;
  }
}
