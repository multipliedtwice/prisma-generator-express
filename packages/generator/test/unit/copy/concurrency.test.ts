import { describe, expect, it, vi } from 'vitest'
import { mapLimited } from '../../../src/copy/concurrency'

describe('mapLimited', () => {
  it('processes every item with its original index', async () => {
    const calls: Array<[string, number]> = []

    await mapLimited(['a', 'b', 'c'], 2, async (item, index) => {
      calls.push([item, index])
    })

    expect(calls.sort((a, b) => a[1] - b[1])).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
    ])
  })

  it('never exceeds the configured concurrency', async () => {
    let active = 0
    let maximum = 0

    await mapLimited([1, 2, 3, 4, 5, 6], 3, async () => {
      active++
      maximum = Math.max(maximum, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active--
    })

    expect(maximum).toBe(3)
  })

  it('does not call the worker for an empty list', async () => {
    const worker = vi.fn(async () => {})

    await mapLimited([], 4, worker)

    expect(worker).not.toHaveBeenCalled()
  })

  it('propagates worker failures', async () => {
    await expect(
      mapLimited([1], 1, async () => {
        throw new Error('failed')
      }),
    ).rejects.toThrow('failed')
  })
})
