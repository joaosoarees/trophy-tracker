import { type Language, type Messages, messagesFor } from '@shared/i18n';
import { type IAppState } from '@shared/types/AppState';
import { type CheckResult, type SteamIdCheck } from '@shared/types/Check';
import { type IProfile } from '@shared/types/Profile';

import {
  type SteamClient,
  SteamError,
  steamErrorMessage,
} from '../steam/client';
import { type Store } from '../storage/Store';

import { checkApiKey, checkPrivacy, checkSteamId } from './onboardingChecks';

/** Whether the app is set up, in which language, and the checks that get it there. */
export class SetupService {
  /** Set when Steam starts rejecting the saved key; forces the onboarding again. */
  private configError: string | null = null;

  constructor(
    private store: Store,
    private client: SteamClient,
  ) {
    this.client.language = this.store.getLanguage();
  }

  /** Messages in the user's language. */
  get messages(): Messages {
    return messagesFor(this.store.getLanguage());
  }

  get isConfigured(): boolean {
    return this.store.getCredentials() !== null && this.configError === null;
  }

  getState(): IAppState {
    return {
      configured: this.isConfigured,
      language: this.store.getLanguage(),
      profile: this.store.getProfile(),
      configError: this.configError,
      achievementSort: this.store.getAchievementSort(),
      dashboardSort: this.store.getDashboardSort(),
    };
  }

  /** Runs a read against Steam and turns a failure into a message for the user. */
  async attempt<T>(run: () => Promise<T>): Promise<CheckResult<T>> {
    try {
      return { ok: true, value: await run() };
    } catch (e) {
      return { ok: false, error: this.noticeFailure(e) };
    }
  }

  /**
   * Takes note of a failed read (a rejected key sends the user back to the
   * onboarding) and returns the message to show for it.
   */
  noticeFailure(e: unknown): string {
    if (e instanceof SteamError) {
      const error = steamErrorMessage(this.messages, e);
      if (e.kind === 'invalid-key') this.configError = error;
      return error;
    }
    console.error(e);
    return this.messages.errors.unexpected;
  }

  async checkSteamId(steamId: string): Promise<SteamIdCheck> {
    const result = await checkSteamId(this.messages, steamId);
    if (result.status === 'unconfirmed') {
      console.warn(`SteamID ${result.steamId} not confirmed: ${result.reason}`);
    }
    return result;
  }

  checkApiKey(steamId: string, apiKey: string): Promise<CheckResult<IProfile>> {
    return checkApiKey(this.messages, this.client, steamId, apiKey);
  }

  checkPrivacy(
    steamId: string,
    apiKey: string,
  ): Promise<CheckResult<{ gamesWithPlaytime: number }>> {
    return checkPrivacy(this.messages, this.client, steamId, apiKey);
  }

  /** Saves the credentials only if Steam accepts them. */
  async saveConfig(steamId: string, apiKey: string): Promise<IAppState> {
    const check = await this.checkApiKey(steamId, apiKey);
    if (check.ok) {
      this.store.setCredentials(
        { steamId, apiKey: apiKey.trim() },
        check.value,
      );
      this.configError = null;
    }
    return this.getState();
  }

  resetConfig(): IAppState {
    this.store.clearCredentials();
    this.configError = null;
    return this.getState();
  }

  /** Changing the language also changes what is asked of Steam from now on. */
  setLanguage(language: Language): IAppState {
    this.store.setLanguage(language);
    this.client.language = language;
    return this.getState();
  }
}
