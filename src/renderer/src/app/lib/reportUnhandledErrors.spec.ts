import { afterEach, describe, expect, it, vi } from 'vitest';

import { reportUnhandledErrors } from './reportUnhandledErrors';

type Listener = (event: object) => void;

/**
 * A window that keeps who listens to it, over a main process that takes the
 * errors to log. `fire` tells the listeners of an event that happened.
 */
function setup() {
  const listeners = new Map<string, Listener>();
  const logErrorMock = vi.fn((_source: string, _detail: string) =>
    Promise.resolve(),
  );
  vi.stubGlobal('window', {
    api: { logError: logErrorMock },
    addEventListener: (type: string, listener: Listener) =>
      void listeners.set(type, listener),
  });
  reportUnhandledErrors();

  return {
    logErrorMock,
    fire: (type: string, event: object) => listeners.get(type)?.(event),
  };
}

/** An error with a known stack, as the engine would fill it in. */
function makeError(): Error {
  const error = new Error('boom');
  error.stack = 'Error: boom\n    at render (App.tsx:1:1)';
  return error;
}

describe('reportUnhandledErrors', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should log the stack of an error when no screen caught it', () => {
    const { logErrorMock, fire } = setup();

    fire('error', { error: makeError(), message: 'Uncaught Error: boom' });

    expect(logErrorMock).toHaveBeenCalledExactlyOnceWith(
      'error',
      'Error: boom\n    at render (App.tsx:1:1)',
    );
  });

  it('should log the message of an error when it has no stack', () => {
    const { logErrorMock, fire } = setup();
    const error = makeError();
    error.stack = undefined;

    fire('error', { error, message: 'Uncaught Error: boom' });

    expect(logErrorMock).toHaveBeenCalledExactlyOnceWith('error', 'boom');
  });

  it('should log what the window says when what was thrown is not an error', () => {
    const { logErrorMock, fire } = setup();

    fire('error', { error: null, message: 'Script error.' });

    expect(logErrorMock).toHaveBeenCalledExactlyOnceWith(
      'error',
      'Script error.',
    );
  });

  it('should log the stack of the reason when a promise is rejected and nothing handles it', () => {
    const { logErrorMock, fire } = setup();

    fire('unhandledrejection', { reason: makeError() });

    expect(logErrorMock).toHaveBeenCalledExactlyOnceWith(
      'unhandledrejection',
      'Error: boom\n    at render (App.tsx:1:1)',
    );
  });

  it('should log the message of the reason when a rejected promise carries an error with no stack', () => {
    const { logErrorMock, fire } = setup();
    const reason = makeError();
    reason.stack = undefined;

    fire('unhandledrejection', { reason });

    expect(logErrorMock).toHaveBeenCalledExactlyOnceWith(
      'unhandledrejection',
      'boom',
    );
  });

  it('should log the reason as text when a promise is rejected with something that is not an error', () => {
    const { logErrorMock, fire } = setup();

    fire('unhandledrejection', { reason: 404 });

    expect(logErrorMock).toHaveBeenCalledExactlyOnceWith(
      'unhandledrejection',
      '404',
    );
  });
});
