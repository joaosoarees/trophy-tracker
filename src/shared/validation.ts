/** Formats checked both in the form and in the main process. */
export const API_KEY_PATTERN = /^[0-9A-Fa-f]{32}$/;

/**
 * A SteamID64 is this number plus the account's own 32-bit number, so every
 * personal account lies in the range right above it. The leading digits are
 * not fixed: they roll over as accounts are created.
 */
export const STEAM_ID_BASE = 76561197960265728n;
const STEAM_ID_LAST = STEAM_ID_BASE + 0xffffffffn;

/** Whether the text is the SteamID64 of a personal account. */
export function isSteamId(value: string): boolean {
  if (!/^\d{17}$/.test(value)) return false;
  const id = BigInt(value);
  return id > STEAM_ID_BASE && id <= STEAM_ID_LAST;
}
