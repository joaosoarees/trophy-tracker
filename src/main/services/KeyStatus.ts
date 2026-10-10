import { type Messages, messagesFor } from '@shared/i18n';
import { type AccountStatus } from '@shared/types/Account';
import { type CheckResult } from '@shared/types/Check';

import {
  type ICredentials,
  type SteamClient,
  SteamError,
} from '../steam/SteamClient';
import { type Store } from '../storage/Store';
import { ErrorLog } from '../system/ErrorLog';

/**
 * The part of `Store` that keeps what Steam said about each account's key,
 * and the language a failure is described in.
 */
type SavedKeys = Pick<
  Store,
  | 'getLanguage'
  | 'getActiveSteamId'
  | 'getAccounts'
  | 'getCredentialsOf'
  | 'setAccountStatus'
>;

/** The part of `SteamClient` that says whether a key still works. */
type KeyProbe = Pick<SteamClient, 'getPlayerSummary'>;

/** What a failed read says about the key it was made with, when it says anything. */
const STATUS_OF: Partial<Record<SteamError['kind'], AccountStatus>> = {
  'invalid-key': 'rejected',
  'rate-limited': 'rateLimited',
};

/** What a failure means, whichever call met it. */
interface IFailure {
  /** What it says about the key the call was made with, when it says anything. */
  status: AccountStatus | undefined;
  /** What to show the user for it. */
  message: string;
}

/**
 * What Steam last said about each account's key: every read is a chance to
 * learn it, and a failure is turned here into a status and a message.
 */
export class KeyStatus {
  constructor(
    private store: SavedKeys,
    private client: KeyProbe,
    /** Told when a status changes without the interface having asked for it. */
    private onChange: () => void = () => {},
    private logError: (source: string, detail: string) => void = () => {},
  ) {}

  /** Messages in the user's language. */
  private get messages(): Messages {
    return messagesFor(this.store.getLanguage());
  }

  /**
   * Runs a read and turns a failure into a message for the user. A read that
   * works says nothing about the key by itself, since it may have been
   * answered from the cache: the read calls `onAnswer` when Steam answered a
   * request made with the key, and only then is the account marked `valid`.
   * It is the account the read started for, and the call may come after this
   * has answered, from a refresh that goes on behind the scenes. A failure of
   * such a refresh has nobody to be answered to: the read hands it to
   * `onFailure`, which notes it for that same account, whichever is in use
   * by then.
   */
  async attempt<T>(
    run: (onAnswer: () => void, onFailure: (e: unknown) => void) => Promise<T>,
  ): Promise<CheckResult<T>> {
    const steamId = this.store.getActiveSteamId();
    try {
      const value = await run(
        () => this.mark(steamId, 'valid'),
        (e) => void this.noticeFailure(e, steamId),
      );
      return { ok: true, value };
    } catch (e) {
      return { ok: false, error: this.noticeFailure(e, steamId) };
    }
  }

  /**
   * Takes note of a failed read and returns the message to show for it. A
   * refused or limited key is recorded on the account the read started for:
   * the app stays open with what it had, and says which key needs attention.
   */
  private noticeFailure(e: unknown, steamId: string | null): string {
    const { status, message } = this.interpret(e);
    if (status) this.mark(steamId, status);
    return message;
  }

  /**
   * The one place a failure is described. Steam's own failures are expected
   * and have their message; anything else is a fault of the app, which goes
   * to the error log while the user is told only that it happened.
   */
  interpret(e: unknown): IFailure {
    if (e instanceof SteamError) {
      return { status: STATUS_OF[e.kind], message: e.describe(this.messages) };
    }
    this.logError('main: steam read', ErrorLog.detailOf(e));
    return { status: undefined, message: this.messages.errors.unexpected };
  }

  /**
   * Asks Steam again about a saved account's key. Steam being unreachable
   * changes nothing. The user asked for this and is shown what the app holds
   * afterwards: an answer the disk refuses to write is not swallowed as a
   * read's is (`mark`), it rejects, so the interface says the check failed
   * instead of showing the old status as if it were the answer.
   */
  async recheck(steamId: string): Promise<void> {
    const credentials = this.store.getCredentialsOf(steamId);
    if (!credentials) return;
    const status = await this.ask(credentials);
    // Outside what catches Steam's failures: a refused write is not one.
    if (status) this.write(steamId, status);
  }

  /** What Steam says about a key right now; nothing when it does not say. */
  private async ask(
    credentials: ICredentials,
  ): Promise<AccountStatus | undefined> {
    try {
      await this.client.getPlayerSummary(credentials);
      return 'valid';
    } catch (e) {
      return this.interpret(e).status;
    }
  }

  /**
   * Records what a read has just learnt about an account's key, and tells
   * the interface if it is news. Nobody asked for the status, so one the
   * disk refuses fails nothing: it is not kept (the store keeps nothing it
   * could not write), the read it was learnt from stands, with what Steam
   * answered, the error log says the write failed, and the next answer from
   * Steam tries again.
   */
  private mark(steamId: string | null, status: AccountStatus): void {
    let hasChanged: boolean;
    try {
      hasChanged = this.write(steamId, status);
    } catch (e) {
      this.logError('main: key status', ErrorLog.detailOf(e));
      return;
    }
    if (hasChanged) this.onChange();
  }

  /**
   * Writes an account's key status down when it differs; answers whether it
   * did. Throws when the disk refuses it: who asked decides what that means.
   */
  private write(steamId: string | null, status: AccountStatus): boolean {
    const account = this.store.getAccounts().find((a) => a.steamId === steamId);
    if (!account || account.status === status) return false;
    this.store.setAccountStatus(account.steamId, status);
    return true;
  }
}
