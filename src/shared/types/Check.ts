import { type IProfile } from './Profile';

/** Outcome of an operation that may fail with a message for the user. */
export type CheckResult<T = undefined> =
  { ok: true; value: T } | { ok: false; error: string };

/** Result of the SteamID step: only "Steam said it does not exist" blocks. */
export type SteamIdCheck =
  | { status: 'found'; profile: IProfile }
  | { status: 'invalid' | 'not-found'; error: string }
  | { status: 'unconfirmed'; steamId: string; reason: string };
