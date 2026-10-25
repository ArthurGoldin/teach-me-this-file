import { describe, expect, it } from 'vitest'
import { fitsInRequest, makeBatches } from './batches.js'

const item = (page, size) => ({ page, base64: 'A'.repeat(size) })

describe('makeBatches', () => {
  it('keeps small items together', () => {
    const items = [item(1, 10), item(2, 10)]
    expect(makeBatches(items, 1000)).toEqual([items])
  })

  it('counts 64 bytes of JSON overhead per item', () => {
    // 2 × (436 + 64) = 1000 fits exactly; one more byte does not.
    expect(makeBatches([item(1, 436), item(2, 436)], 1000)).toHaveLength(1)
    expect(makeBatches([item(1, 436), item(2, 437)], 1000)).toHaveLength(2)
  })

  it('starts a new batch when the next item would go over the limit, keeping order', () => {
    const items = [item(1, 500), item(2, 300), item(3, 300), item(4, 100)]
    expect(makeBatches(items, 1000).map((b) => b.map((i) => i.page))).toEqual([
      [1, 2],
      [3, 4],
    ])
  })

  it('puts an item over the limit in a batch of its own', () => {
    const items = [item(1, 10), item(2, 5000), item(3, 10)]
    expect(makeBatches(items, 1000).map((b) => b.map((i) => i.page))).toEqual([[1], [2], [3]])
  })

  it('puts at most 8 items in a batch', () => {
    const items = Array.from({ length: 10 }, (_, i) => item(i + 1, 1))
    expect(makeBatches(items).map((b) => b.length)).toEqual([8, 2])
  })

  it('defaults to a 3 MB limit', () => {
    expect(makeBatches([item(1, 1_500_000), item(2, 1_500_000)])).toHaveLength(2)
    expect(makeBatches([item(1, 1_400_000), item(2, 1_400_000)])).toHaveLength(1)
  })

  it('returns no batches for no items', () => {
    expect(makeBatches([])).toEqual([])
  })
})

describe('fitsInRequest', () => {
  it('is false for an image too large for any request', () => {
    expect(fitsInRequest(item(1, 2_999_936))).toBe(true)
    expect(fitsInRequest(item(1, 2_999_937))).toBe(false)
  })
})
