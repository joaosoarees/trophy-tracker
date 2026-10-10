import { describe, expect, it, vi } from 'vitest';

import { deferred } from '@tests/makeAppStore';

import { singleFlight } from './singleFlight';

/** A task that ends when the test says so, and counts how often it started. */
function setup() {
  const sut = singleFlight();
  const answer = deferred<void>();
  const taskMock = vi.fn(() => answer.promise);
  return { sut, answer, taskMock };
}

describe('singleFlight', () => {
  it('should run the task once when it is asked for again before it finished', async () => {
    const { sut, answer, taskMock } = setup();

    const runs = [sut(taskMock), sut(taskMock), sut(taskMock)];
    answer.resolve();
    await Promise.all(runs);

    expect(taskMock).toHaveBeenCalledTimes(1);
  });

  it('should run the task again when the previous run finished', async () => {
    const { sut, answer, taskMock } = setup();
    answer.resolve();
    await sut(taskMock);

    await sut(taskMock);

    expect(taskMock).toHaveBeenCalledTimes(2);
  });

  it('should run the next task when the previous one failed', async () => {
    const { sut } = setup();
    const nextMock = vi.fn(() => Promise.resolve());
    const failure = new Error('the disk is full');
    await sut(() => Promise.reject(failure)).catch(() => {});

    await sut(nextMock);

    expect(nextMock).toHaveBeenCalledTimes(1);
  });

  it('should hand the failure of the task to whoever asked for it', async () => {
    const { sut } = setup();
    const failure = new Error('the disk is full');

    const run = sut(() => Promise.reject(failure));

    await expect(run).rejects.toBe(failure);
  });

  it('should keep the runs of two guards apart', async () => {
    const { sut, answer, taskMock } = setup();
    const other = singleFlight();

    const runs = [sut(taskMock), other(taskMock)];
    answer.resolve();
    await Promise.all(runs);

    expect(taskMock).toHaveBeenCalledTimes(2);
  });
});
