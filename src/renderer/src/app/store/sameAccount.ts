import type { Store } from './Store';

/**
 * How many times the store was wired for an account. An account can be left
 * and followed again while a read is waiting, so its SteamID alone does not
 * tell one stay on it from the next. No screen reads this, which is why it is
 * not in the store.
 */
let stays = 0;

/** A stay on an account begins: `connectStore` wires the store for it. */
export function nextStay(): void {
  stays += 1;
}

/**
 * An answer is taken only for the stay on the account it was asked in. Called
 * before the main process is asked, it remembers the account in use and the
 * stay; the function it returns says, once the answer is there, whether both
 * are still the same. No answer names its account, and a late one would be
 * shown as the other account's, or beside the read asked again since the
 * account came back. Dropping it is safe: `connectStore` asks again each time
 * it wires the store.
 */
export function sameAccount(get: () => Store): () => boolean {
  const asked = get().settings.appState?.activeSteamId;
  const stay = stays;
  return () =>
    stays === stay && get().settings.appState?.activeSteamId === asked;
}
