import { vi } from 'vitest';

import { type IApi } from '@shared/types/Api';
import { type IAppState } from '@shared/types/AppState';

/** A promise settled from outside, to control when a call to the main process answers. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

interface IMakeAppStoreOptions {
  /** The part of the main process the test needs; any other call throws. */
  api?: Partial<IApi>;
  /** What is already in `sessionStorage` (it survives a window reload). */
  session?: Record<string, string>;
}

/**
 * A fresh interface store (`sut`) talking to a fake main process. The store is
 * a module-level singleton that reads `sessionStorage` when it is created, so
 * each call loads the modules again; `sonner`, which the spec mocks, is loaded
 * again too, so `toastMock` starts with no calls.
 */
export async function makeAppStore({
  api = {},
  session = {},
}: IMakeAppStoreOptions = {}) {
  vi.resetModules();

  const storage = new Map(Object.entries(session));
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
  });

  const reloadMock = vi.fn();
  vi.stubGlobal('window', {
    api: new Proxy(api, {
      get(target, name: string) {
        if (name in target) return target[name as keyof IApi];
        throw new Error(`The test did not expect a call to window.api.${name}`);
      },
    }),
    location: { reload: reloadMock },
    addEventListener: () => {},
    removeEventListener: () => {},
  });

  const { useStore, connectStore } = await import('@app/store');
  const { toast } = await import('sonner');

  let disconnect: (() => void) | null = null;
  /**
   * Puts the store on the account of `appState` as `useAppController` does:
   * the state is taken, the store is unwired from the account that was left,
   * which drops what was read for it, and wired for the one in use.
   */
  const follow = (appState: IAppState): void => {
    useStore.getState().settings.apply(appState);
    disconnect?.();
    disconnect = connectStore();
  };

  return {
    sut: useStore,
    follow,
    storage,
    reloadMock,
    toastMock: vi.mocked(toast),
  };
}
