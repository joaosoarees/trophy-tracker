import { vi } from 'vitest';

/**
 * `sonner` as the specs of the store see it: the part of `toast` the slices
 * call, each a `vi.fn`, to assert what the user was told. A spec that looks
 * at toasts puts it in the module's place:
 * `vi.mock('sonner', () => import('@tests/fakeSonner'))`. One shape for all
 * of them: a slice that comes to call another method gets it here, once.
 */
export const toast = Object.assign(vi.fn(), {
  error: vi.fn(),
  dismiss: vi.fn(),
});
