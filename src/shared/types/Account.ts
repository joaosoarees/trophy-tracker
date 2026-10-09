import { type IProfile } from './Profile';

/**
 * What is known about an account's Web API key. Steam answers a revoked key
 * and a mistyped one the same way, so both are `rejected`.
 */
export type AccountStatus = 'valid' | 'rejected' | 'rateLimited' | 'unchecked';

/**
 * One Steam account the app can follow, as the interface sees it. The key
 * itself stays in the main process: only its last characters come out.
 */
export interface IAccount extends IProfile {
  /** The last four characters of the key, to tell one key from another. */
  keyEnding: string;
  /** Whether the key is kept encrypted by the system's keyring; without one it is only private to the user. */
  isKeyEncrypted: boolean;
  status: AccountStatus;
  /** When Steam was last asked about the key (epoch in milliseconds); `null` if never. */
  checkedAt: number | null;
}
