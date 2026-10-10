import { vi } from 'vitest';

import { type IApi } from '@shared/types/Api';

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

interface IMakeStoreOptions {
  /** The part of the main process the test needs; any other call throws. */
  api?: Partial<IApi>;
  /** What is already in `sessionStorage` (it survives a window reload). */
  session?: Record<string, string>;
}

/**
 * A fresh interface store talking to a fake main process. The store is a
 * module-level singleton that reads `sessionStorage` when it is created, so
 * each call loads the modules again.
 */
export async function makeStore({
  api = {},
  session = {},
}: IMakeStoreOptions = {}) {
  vi.resetModules();

  const storage = new Map(Object.entries(session));
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
  });

  const reload = vi.fn();
  vi.stubGlobal('window', {
    api: new Proxy(api, {
      get(target, name: string) {
        if (name in target) return target[name as keyof IApi];
        throw new Error(`The test did not expect a call to window.api.${name}`);
      },
    }),
    location: { reload },
    addEventListener: () => {},
    removeEventListener: () => {},
  });

  const { useStore } = await import('@app/store');
  const { toast } = await import('sonner');

  return { store: useStore, storage, reload, toast: vi.mocked(toast) };
}
