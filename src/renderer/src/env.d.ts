import { type IApi } from '../../shared/types/Api';

declare global {
  interface Window {
    api: IApi;
  }
}
