import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSaver } from './saver';

const PAUSE = 500;

type Outcome = 'ok' | 'fail';

/**
 * A saver of texts with a pause of half a second. `outcomes` decides how each
 * save ends, call by call; the ones it does not name succeed.
 */
function setup(outcomes: Outcome[] = []) {
  const remaining = [...outcomes];
  const saveMock = vi.fn((_key: string, _value: string) =>
    (remaining.shift() ?? 'ok') === 'ok'
      ? Promise.resolve()
      : Promise.reject(new Error('disk full')),
  );
  const onRollbackMock =
    vi.fn<(key: string, saved: string | undefined) => void>();
  const sut = createSaver<string>({
    save: saveMock,
    onRollback: onRollbackMock,
    delay: PAUSE,
  });

  return { sut, saveMock, onRollbackMock };
}

describe('createSaver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('schedule', () => {
    it('should not save when the pause has not passed', async () => {
      const { sut, saveMock } = setup();
      sut.schedule('note', 'a', '');

      await vi.advanceTimersByTimeAsync(PAUSE - 1);

      expect(saveMock).not.toHaveBeenCalled();
    });

    it('should not save when a newer edit restarted the pause', async () => {
      const { sut, saveMock } = setup();
      sut.schedule('note', 'a', '');
      await vi.advanceTimersByTimeAsync(PAUSE - 1);
      sut.schedule('note', 'ab', 'a');

      await vi.advanceTimersByTimeAsync(PAUSE - 1);

      expect(saveMock).not.toHaveBeenCalled();
    });

    it('should save only the latest version when the pause has passed', async () => {
      const { sut, saveMock } = setup();
      sut.schedule('note', 'a', '');
      sut.schedule('note', 'ab', 'a');
      sut.schedule('note', 'abc', 'ab');

      await vi.advanceTimersByTimeAsync(PAUSE);

      expect(saveMock).toHaveBeenCalledExactlyOnceWith('note', 'abc');
    });

    it('should save each key when edits to different keys are waiting', async () => {
      const { sut, saveMock } = setup();
      sut.schedule('a', '1', undefined);
      sut.schedule('b', '2', undefined);

      await vi.advanceTimersByTimeAsync(PAUSE);

      expect(saveMock).toHaveBeenCalledTimes(2);
      expect(saveMock).toHaveBeenNthCalledWith(1, 'a', '1');
      expect(saveMock).toHaveBeenNthCalledWith(2, 'b', '2');
    });

    it('should save the newer edit when the save before it failed', async () => {
      const { sut, saveMock } = setup(['fail', 'ok']);
      sut.schedule('note', 'one', 'old');
      sut.flush();
      sut.schedule('note', 'two', 'one');

      await vi.advanceTimersByTimeAsync(PAUSE);

      expect(saveMock).toHaveBeenCalledTimes(2);
      expect(saveMock).toHaveBeenNthCalledWith(1, 'note', 'one');
      expect(saveMock).toHaveBeenNthCalledWith(2, 'note', 'two');
    });
  });

  describe('flush', () => {
    it('should save what is waiting right away when it is called', () => {
      const { sut, saveMock } = setup();
      sut.schedule('a', '1', undefined);

      sut.flush();

      expect(saveMock).toHaveBeenCalledExactlyOnceWith('a', '1');
    });

    it('should not save again when the pause passes after it', async () => {
      const { sut, saveMock } = setup();
      sut.schedule('a', '1', undefined);
      sut.flush();

      await vi.advanceTimersByTimeAsync(PAUSE);

      expect(saveMock).toHaveBeenCalledExactlyOnceWith('a', '1');
    });

    it('should not save again when it is called a second time', () => {
      const { sut, saveMock } = setup();
      sut.schedule('a', '1', undefined);
      sut.flush();

      sut.flush();

      expect(saveMock).toHaveBeenCalledExactlyOnceWith('a', '1');
    });
  });

  describe('rollback', () => {
    it('should roll back to what was saved before the edits when the save fails', async () => {
      const { sut, onRollbackMock } = setup(['fail']);
      sut.schedule('note', 'new', 'old');
      sut.schedule('note', 'newer', 'new');

      await vi.advanceTimersByTimeAsync(PAUSE);

      expect(onRollbackMock).toHaveBeenCalledExactlyOnceWith('note', 'old');
    });

    it('should roll back to nothing when there was no saved value', async () => {
      const { sut, onRollbackMock } = setup(['fail']);
      sut.schedule('note', 'first', undefined);

      await vi.advanceTimersByTimeAsync(PAUSE);

      expect(onRollbackMock).toHaveBeenCalledExactlyOnceWith('note', undefined);
    });

    it('should not roll back when a newer edit is waiting to be saved', async () => {
      const { sut, onRollbackMock } = setup(['fail', 'ok']);
      sut.schedule('note', 'one', 'old');
      sut.flush();
      sut.schedule('note', 'two', 'one');

      await vi.advanceTimersByTimeAsync(PAUSE);

      expect(onRollbackMock).not.toHaveBeenCalled();
    });

    it('should roll back to what the save before wrote when an edit made while it was being written cannot be saved', async () => {
      const { sut, onRollbackMock } = setup(['ok', 'fail']);
      sut.schedule('note', 'one', 'old');
      sut.flush();
      sut.schedule('note', 'two', 'one');

      await vi.advanceTimersByTimeAsync(PAUSE);

      expect(onRollbackMock).toHaveBeenCalledExactlyOnceWith('note', 'one');
    });

    it('should roll back to the last saved value when a save fails after one succeeded', async () => {
      const { sut, onRollbackMock } = setup(['ok', 'fail']);
      sut.schedule('note', 'one', 'old');
      await vi.advanceTimersByTimeAsync(PAUSE);
      sut.schedule('note', 'two', 'one');

      await vi.advanceTimersByTimeAsync(PAUSE);

      expect(onRollbackMock).toHaveBeenCalledExactlyOnceWith('note', 'one');
    });
  });
});
