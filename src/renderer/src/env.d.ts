import type { IApi } from '../../shared/types';

declare global {
  interface Window {
    api: IApi;
  }
}
