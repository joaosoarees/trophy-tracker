import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSaver } from '@app/lib/saver';

/** A `save` whose outcome each test decides, call by call. */
function setup() {
  const outcomes: ('ok' | 'fail')[] = [];
  const save = vi.fn((_key: string, _value: string) =>
    (outcomes.shift() ?? 'ok') === 'ok'
      ? Promise.resolve()
      : Promise.reject(new Error('disk full')),
  );
  const onRollback = vi.fn();
  const saver = createSaver<string>({ save, onRollback, delay: 500 });

  return {
    saver,
    save,
    onRollback,
    next: (o: 'ok' | 'fail') => outcomes.push(o),
  };
}

const settle = () => vi.advanceTimersByTimeAsync(0);

describe('createSaver', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('saves only the latest version after the pause', async () => {
    const { saver, save } = setup();
    let previous = '';
    for (const text of ['a', 'ab', 'abc']) {
      saver.schedule('note', text, previous);
      previous = text;
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(save.mock.calls).toEqual([['note', 'abc']]);
  });

  it('handles different keys independently', async () => {
    const { saver, save } = setup();
    saver.schedule('a', '1', undefined);
    saver.schedule('b', '2', undefined);
    await vi.advanceTimersByTimeAsync(500);
    expect(save.mock.calls).toEqual([
      ['a', '1'],
      ['b', '2'],
    ]);
  });

  it('saves pending work right away on close, only once', async () => {
    const { saver, save } = setup();
    saver.schedule('a', '1', undefined);
    saver.flush();
    expect(save.mock.calls).toEqual([['a', '1']]);

    await vi.advanceTimersByTimeAsync(1000);
    saver.flush();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('rolls back to what was saved before the edits when the save fails', async () => {
    const { saver, onRollback, next } = setup();
    next('fail');
    saver.schedule('note', 'new', 'old');
    saver.schedule('note', 'newer', 'new');
    await vi.advanceTimersByTimeAsync(500);

    expect(onRollback).toHaveBeenCalledExactlyOnceWith('note', 'old');
  });

  it('rolls back to nothing when there was no saved value', async () => {
    const { saver, onRollback, next } = setup();
    next('fail');
    saver.schedule('note', 'first', undefined);
    await vi.advanceTimersByTimeAsync(500);

    expect(onRollback).toHaveBeenCalledExactlyOnceWith('note', undefined);
  });

  it('does not roll back when a newer edit is waiting to be saved', async () => {
    const { saver, save, onRollback, next } = setup();
    next('fail');
    next('ok');
    saver.schedule('note', 'one', 'old');
    await vi.advanceTimersByTimeAsync(499);
    saver.flush();
    saver.schedule('note', 'two', 'one');
    await settle();
    expect(onRollback).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(save.mock.calls).toEqual([
      ['note', 'one'],
      ['note', 'two'],
    ]);
    expect(onRollback).not.toHaveBeenCalled();
  });

  it('after a successful save, a later failure rolls back to that saved value', async () => {
    const { saver, onRollback, next } = setup();
    next('ok');
    next('fail');
    saver.schedule('note', 'one', 'old');
    await vi.advanceTimersByTimeAsync(500);

    saver.schedule('note', 'two', 'one');
    await vi.advanceTimersByTimeAsync(500);

    expect(onRollback).toHaveBeenCalledExactlyOnceWith('note', 'one');
  });
});
