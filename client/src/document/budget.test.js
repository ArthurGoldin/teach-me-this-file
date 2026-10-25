import { describe, expect, it } from 'vitest'
import {
  MAX_SCAN_PAGES,
  PLAN_TOKEN_BUDGET,
  SCAN_PAGE_TOKENS,
  applyRange,
  checkRange,
  defaultRange,
  estimateTokens,
} from './budget.js'

const textPages = (n, chars = 2000) =>
  Array.from({ length: n }, (_, i) => ({ page: i + 1, text: 'a'.repeat(chars), isScan: false }))
const scanPages = (n) =>
  Array.from({ length: n }, (_, i) => ({ page: i + 1, text: '', isScan: true }))

describe('estimateTokens', () => {
  it('is characters / 3, rounded up', () => {
    expect(estimateTokens('abcd')).toBe(2)
    expect(estimateTokens('')).toBe(0)
  })
})

describe('defaultRange', () => {
  it('uses the whole document when it fits', () => {
    expect(defaultRange(textPages(5))).toEqual({ from: 1, to: 5, needsPicker: false })
  })

  it('stops inside the token budget for a long document', () => {
    const range = defaultRange(textPages(412))
    expect(range.needsPicker).toBe(true)
    expect(range.from).toBe(1)
    const used = checkRange(textPages(412), range)
    expect(used.tokens).toBeLessThanOrEqual(PLAN_TOKEN_BUDGET)
    expect(used.ok).toBe(true)
    expect(range.to).toBeLessThan(412)
  })

  it('stops at the scan page limit', () => {
    const range = defaultRange(scanPages(25))
    expect(range.to).toBeLessThanOrEqual(MAX_SCAN_PAGES)
    expect(range.needsPicker).toBe(true)
  })

  it('always includes at least the first page', () => {
    expect(defaultRange(textPages(2, 400_000)).to).toBe(1)
  })
})

describe('applyRange', () => {
  it('splits pages into in-range and skipped', () => {
    const { inRange, skipped } = applyRange(textPages(6), { from: 2, to: 4 })
    expect(inRange.map((p) => p.page)).toEqual([2, 3, 4])
    expect(skipped).toEqual([{ pages: [1, 5, 6], reason: 'outside-range' }])
  })

  it('reports nothing skipped when all pages are in range', () => {
    expect(applyRange(textPages(3), { from: 1, to: 3 }).skipped).toEqual([])
  })
})

describe('checkRange', () => {
  it('counts tokens, scan pages and flags a range that is too big', () => {
    const pages = [...textPages(2, 300), { page: 3, text: '', isScan: true }]
    const result = checkRange(pages, { from: 1, to: 3 })
    expect(result).toEqual({ tokens: 100 + 100 + SCAN_PAGE_TOKENS, scanPages: 1, ok: true })
    expect(checkRange(scanPages(21), { from: 1, to: 21 }).ok).toBe(false)
    expect(checkRange(textPages(200), { from: 1, to: 200 }).ok).toBe(false)
  })

  it('rejects a range with no pages in it', () => {
    expect(checkRange(textPages(3), { from: 3, to: 2 }).ok).toBe(false)
  })
})
