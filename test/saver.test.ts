import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSaver } from '../src/renderer/src/lib/saver'

describe('createSaver', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('saves only the latest version after the pause', () => {
    const save = vi.fn()
    const saver = createSaver<string>(save, 500)
    for (const text of ['a', 'ab', 'abc']) {
      saver.schedule('nota', text)
      vi.advanceTimersByTime(100)
    }
    expect(save).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(save.mock.calls).toEqual([['nota', 'abc']])
  })

  it('handles different keys independently', () => {
    const save = vi.fn()
    const saver = createSaver<string>(save, 500)
    saver.schedule('a', '1')
    saver.schedule('b', '2')
    vi.advanceTimersByTime(500)
    expect(save.mock.calls).toEqual([
      ['a', '1'],
      ['b', '2']
    ])
  })

  it('saves pending work right away on close, only once', () => {
    const save = vi.fn()
    const saver = createSaver<string>(save, 500)
    saver.schedule('a', '1')
    saver.flush()
    expect(save.mock.calls).toEqual([['a', '1']])
    vi.advanceTimersByTime(1000)
    saver.flush()
    expect(save).toHaveBeenCalledTimes(1)
  })
})
