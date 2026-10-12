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

/**
 * A saver whose saves end when the test says so, so two can be under way at
 * once: `end(n, outcome)` ends the nth save that was started.
 */
function setupHeldSaves() {
  const held: { resolve: () => void; reject: (e: Error) => void }[] = [];
  const onRollbackMock =
    vi.fn<(key: string, saved: string | undefined) => void>();
  const sut = createSaver<string>({
    save: () =>
      new Promise<void>((resolve, reject) => {
        held.push({ resolve, reject });
      }),
    onRollback: onRollbackMock,
    delay: PAUSE,
  });
  const end = async (nth: number, outcome: Outcome): Promise<void> => {
    if (outcome === 'ok') held[nth - 1].resolve();
    else held[nth - 1].reject(new Error('disk full'));
    await vi.advanceTimersByTimeAsync(0);
  };
  /** "one" and then "two" are written over "old", neither save having ended. */
  const writeTwice = (): void => {
    sut.schedule('note', 'one', 'old');
    sut.flush();
    sut.schedule('note', 'two', 'one');
    sut.flush();
  };

  return { sut, onRollbackMock, end, writeTwice };
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

    it('should roll back to what the earlier save wrote when the later of two under way fails', async () => {
      const { onRollbackMock, end, writeTwice } = setupHeldSaves();
      writeTwice();
      await end(1, 'ok');

      await end(2, 'fail');

      expect(onRollbackMock).toHaveBeenCalledExactlyOnceWith('note', 'one');
    });

    it('should not roll back when the earlier of two saves under way fails and the later one is written', async () => {
      const { onRollbackMock, end, writeTwice } = setupHeldSaves();
      writeTwice();
      await end(1, 'fail');

      await end(2, 'ok');

      expect(onRollbackMock).not.toHaveBeenCalled();
    });

    it('should roll back once, to the value before both, when two saves under way fail', async () => {
      const { onRollbackMock, end, writeTwice } = setupHeldSaves();
      writeTwice();
      await end(1, 'fail');

      await end(2, 'fail');

      expect(onRollbackMock).toHaveBeenCalledExactlyOnceWith('note', 'old');
    });

    it('should roll back to what the later of two saves wrote when the earlier one answered after it', async () => {
      const { sut, onRollbackMock, end, writeTwice } = setupHeldSaves();
      writeTwice();
      sut.schedule('note', 'three', 'two');
      sut.flush();
      await end(2, 'ok');
      await end(1, 'ok');

      await end(3, 'fail');

      expect(onRollbackMock).toHaveBeenCalledExactlyOnceWith('note', 'two');
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

  describe('write', () => {
    it('should save at once, without the pause', () => {
      const { sut, saveMock } = setup();

      void sut.write('order', 'name', 'recent');

      expect(saveMock).toHaveBeenCalledExactlyOnceWith('order', 'name');
    });

    it('should not resolve while its save is under way', async () => {
      const { sut } = setupHeldSaves();
      let hasResolved = false;
      void sut.write('note', 'one', 'old').then(() => {
        hasResolved = true;
      });

      await vi.advanceTimersByTimeAsync(PAUSE);

      expect(hasResolved).toBe(false);
    });

    it('should have rolled back by the time it resolves when the save fails', async () => {
      const { sut, onRollbackMock } = setup(['fail']);

      await sut.write('order', 'name', 'recent');

      expect(onRollbackMock).toHaveBeenCalledExactlyOnceWith('order', 'recent');
    });
  });
});
