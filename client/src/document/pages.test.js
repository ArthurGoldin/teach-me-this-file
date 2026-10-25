import { describe, expect, it } from 'vitest'
import { isScanPage, splitTextIntoSections } from './pages.js'

describe('isScanPage', () => {
  it('treats a page with only a page number as a scan', () => {
    expect(isScanPage('  12  ')).toBe(true)
    expect(isScanPage('')).toBe(true)
  })

  it('ignores whitespace when counting characters', () => {
    expect(isScanPage(' a '.repeat(79))).toBe(true)
    expect(isScanPage(' a '.repeat(80))).toBe(false)
  })

  it('treats a page with real text as text', () => {
    expect(isScanPage('Water evaporates from the ocean. '.repeat(5))).toBe(false)
  })
})

describe('splitTextIntoSections', () => {
  it('returns one section for short text', () => {
    expect(splitTextIntoSections('Hello world.')).toEqual(['Hello world.'])
  })

  it('returns nothing for blank text', () => {
    expect(splitTextIntoSections('  \n\n ')).toEqual([])
  })

  it('never exceeds the size and keeps paragraphs whole when possible', () => {
    const paragraphs = Array.from({ length: 10 }, (_, i) => `P${i} ` + 'word '.repeat(150).trim())
    const sections = splitTextIntoSections(paragraphs.join('\n\n'), 1000)
    expect(sections.length).toBeGreaterThan(1)
    for (const s of sections) expect(s.length).toBeLessThanOrEqual(1000)
    const rejoined = sections.join('\n\n')
    for (const p of paragraphs) expect(rejoined).toContain(p)
  })

  it('splits an oversize paragraph at sentences, then hard', () => {
    const sentences = 'This is a sentence of moderate length. '.repeat(20).trim()
    const bySentence = splitTextIntoSections(sentences, 200)
    for (const s of bySentence) {
      expect(s.length).toBeLessThanOrEqual(200)
      expect(s.endsWith('.')).toBe(true)
    }
    const hard = splitTextIntoSections('x'.repeat(450), 200)
    expect(hard.map((s) => s.length)).toEqual([200, 200, 50])
  })
})
