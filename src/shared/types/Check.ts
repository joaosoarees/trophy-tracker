/** Outcome of an operation that may fail with a message for the user. */
export type CheckResult<T = undefined> =
  { ok: true; value: T } | { ok: false; error: string };
