import type { Store } from './Store';

/**
 * An answer is taken only while its account is still in use. Called before
 * the main process is asked, it remembers the account in use; the function it
 * returns says, once the answer is there, whether that is still the account
 * in use. No answer names its account, and a late one would be shown as the
 * other account's. Dropping it is safe: `connectStore` asks again for the
 * account that took over.
 */
export function sameAccount(get: () => Store): () => boolean {
  const asked = get().settings.appState?.activeSteamId;
  return () => get().settings.appState?.activeSteamId === asked;
}
