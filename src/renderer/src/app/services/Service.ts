import { type IApi } from '@shared/types/Api';

/**
 * Base of every service. Services are the only code allowed to reach the
 * main process: everything else goes through them.
 */
export abstract class Service {
  protected static get api(): IApi {
    return window.api;
  }
}
