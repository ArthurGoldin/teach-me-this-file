import { describe, expect, it } from 'vitest'
import { chunkPages } from './chunk.js'

const para = (n) => `Paragraph ${n}. ` + 'The water moves around the planet. '.repeat(10).trim()

describe('chunkPages', () => {
  it('gives stable ids p{page}-{n} starting at 1, per page', () => {
    const pages = [
      { page: 1, text: [para(1), para(2), para(3), para(4)].join('\n\n'), origin: 'text' },
      { page: 2, text: para(5), origin: 'text' },
    ]
    const ids = chunkPages(pages).map((p) => p.id)
    expect(ids.slice(-1)).toEqual(['p2-1'])
    expect(ids.slice(0, 2)).toEqual(['p1-1', 'p1-2'])
  })

  it('keeps passages within 1,200 characters and on their own page', () => {
    const pages = [
      { page: 3, text: 'A long sentence goes here. '.repeat(200), origin: 'text' },
      { page: 4, text: 'x'.repeat(3000), origin: 'text' },
    ]
    const passages = chunkPages(pages)
    for (const p of passages) expect(p.text.length).toBeLessThanOrEqual(1200)
    for (const p of passages) expect(p.id.startsWith(`p${p.page}-`)).toBe(true)
    expect(new Set(passages.map((p) => p.page))).toEqual(new Set([3, 4]))
  })

  it('packs short paragraphs together up to the limit', () => {
    const text = Array.from({ length: 30 }, (_, i) => `Line ${i} of the page.`).join('\n')
    const passages = chunkPages([{ page: 1, text, origin: 'text' }])
    expect(passages).toHaveLength(1)
    expect(passages[0].text).toBe(text)
  })

  it('preserves origin and skips empty pages', () => {
    const passages = chunkPages([
      { page: 1, text: '   \n ', origin: 'text' },
      { page: 2, text: 'Transcribed $x^2$ text.', origin: 'transcription' },
    ])
    expect(passages).toEqual([
      { id: 'p2-1', page: 2, text: 'Transcribed $x^2$ text.', origin: 'transcription' },
    ])
  })

  it('keeps Hebrew text unchanged', () => {
    const he = 'מחזור המים הוא תהליך מתמשך.\nהמים מתאדים מן הים ועולים לשמיים.'
    const [passage] = chunkPages([{ page: 1, text: he, origin: 'text' }])
    expect(passage.text).toBe(he)
    expect(new TextEncoder().encode(passage.text)).toEqual(new TextEncoder().encode(he))
  })
})
