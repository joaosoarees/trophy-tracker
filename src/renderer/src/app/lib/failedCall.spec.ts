import { afterEach, describe, expect, it, vi } from 'vitest';

import { messagesFor } from '@shared/i18n';

import { explainFailedCall } from './failedCall';

/** `sut` over a main process that takes the errors to log. */
function setup() {
  const logErrorMock = vi.fn((_source: string, _detail: string) =>
    Promise.resolve(),
  );
  vi.stubGlobal('window', { api: { logError: logErrorMock } });

  return { sut: explainFailedCall, logErrorMock };
}

describe('explainFailedCall', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ['en', 'Unexpected error. Try again.'],
    ['pt-BR', 'Erro inesperado. Tente de novo.'],
  ] as const)(
    'should answer that something unexpected happened, in %s, when a call failed',
    (language, text) => {
      const { sut } = setup();

      const shown = sut(new Error('disk full'), messagesFor(language));

      expect(shown).toBe(text);
    },
  );

  it('should log the stack of the error when a call failed', () => {
    const { sut, logErrorMock } = setup();
    const failure = new Error('disk full');
    failure.stack = 'Error: disk full\n    at saveConfig (Store.ts:1:1)';

    sut(failure, messagesFor('en'));

    expect(logErrorMock).toHaveBeenCalledExactlyOnceWith(
      'failed call',
      'Error: disk full\n    at saveConfig (Store.ts:1:1)',
    );
  });

  it('should log the message when the error has no stack', () => {
    const { sut, logErrorMock } = setup();
    const failure = new Error('disk full');
    delete failure.stack;

    sut(failure, messagesFor('en'));

    expect(logErrorMock).toHaveBeenCalledExactlyOnceWith(
      'failed call',
      'disk full',
    );
  });

  it('should log what was thrown when it is not an error', () => {
    const { sut, logErrorMock } = setup();

    sut('the pipe is closed', messagesFor('en'));

    expect(logErrorMock).toHaveBeenCalledExactlyOnceWith(
      'failed call',
      'the pipe is closed',
    );
  });
});
