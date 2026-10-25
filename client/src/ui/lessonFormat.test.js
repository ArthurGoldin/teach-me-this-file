import { describe, expect, it } from 'vitest'
import {
  formatPages,
  hasAppLine,
  includedSummary,
  linkHost,
  originLabel,
  passageHeading,
  plainText,
  sourceLabel,
  textDirection,
} from './lessonFormat.js'

const passage = (page, origin = 'text') => ({ id: `p${page}-1`, page, text: '…', origin })

describe('hasAppLine', () => {
  it('finds [app] at the start of any line, ignoring case and leading spaces', () => {
    expect(hasAppLine('[app] Skip this step')).toBe(true)
    expect(hasAppLine('My answer\n  [APP] next')).toBe(true)
  })

  it('allows [app] in the middle of a line', () => {
    expect(hasAppLine('What does [app] mean?')).toBe(false)
  })
})

describe('textDirection', () => {
  it('is rtl for Hebrew and Arabic tags', () => {
    expect(textDirection('he')).toBe('rtl')
    expect(textDirection('ar-EG')).toBe('rtl')
  })

  it('is ltr for other or missing languages', () => {
    expect(textDirection('fr')).toBe('ltr')
    expect(textDirection(undefined)).toBe('ltr')
  })
})

describe('formatPages', () => {
  it('collapses three or more consecutive pages and sorts', () => {
    expect(formatPages([9, 3, 4, 5, 3])).toBe('3–5, 9')
    expect(formatPages([3, 4])).toBe('3, 4')
  })
})

describe('sourceLabel', () => {
  it('names one page, several pages, or sections for text files', () => {
    expect(sourceLabel([passage(3), passage(3)], 'pdf')).toBe('Source: page 3')
    expect(sourceLabel([passage(4), passage(3)], 'pdf')).toBe('Sources: pages 3, 4')
    expect(sourceLabel([passage(2)], 'text')).toBe('Source: section 2')
    expect(sourceLabel([passage(1)], 'image')).toBe('Source: the image')
  })
})

describe('passage labels', () => {
  it('heads a passage with its page or section', () => {
    expect(passageHeading(passage(3), 'pdf')).toBe('Page 3')
    expect(passageHeading(passage(3), 'text')).toBe('Section 3')
  })

  it('says whether the text was extracted or transcribed by AI', () => {
    expect(originLabel(passage(3), 'pdf')).toBe('Extracted text')
    expect(originLabel(passage(4, 'transcription'), 'pdf')).toBe('AI transcription of page 4')
  })
})

describe('includedSummary', () => {
  const doc = { kind: 'pdf', pageCount: 412, range: { from: 1, to: 180 }, skipped: [] }

  it('states the range used', () => {
    expect(includedSummary(doc)).toEqual(['This lesson uses pages 1–180 of 412.'])
    expect(includedSummary({ ...doc, pageCount: 12, range: { from: 1, to: 12 } })).toEqual([
      'This lesson uses all 12 pages.',
    ])
    const single = { kind: 'text', pageCount: 1, range: { from: 1, to: 1 }, skipped: [] }
    expect(includedSummary(single)).toEqual(["This lesson uses the file's only section."])
  })

  it('lists skipped pages other than those outside the range', () => {
    const skipped = [
      { pages: [181, 182], reason: 'outside-range' },
      { pages: [30, 31, 32], reason: 'scan-limit' },
    ]
    expect(includedSummary({ ...doc, skipped })).toEqual([
      'This lesson uses pages 1–180 of 412.',
      'Skipped pages 30–32: over the limit of 20 scanned pages.',
    ])
  })
})

describe('plainText', () => {
  it('drops Markdown symbols but keeps the words', () => {
    const markdown =
      '## Bravo !\n\n- **Évaporation** : $H_2O$ monte\n- voir [la page](https://x.org)'
    expect(plainText(markdown)).toBe('Bravo !\nÉvaporation : H2O monte\nvoir la page')
  })

  it('drops table separators and pipes', () => {
    expect(plainText('| a | b |\n|---|---|\n| 1 | 2 |')).toBe('a b\n1 2')
  })
})

describe('linkHost', () => {
  it('names the site of an http(s) link', () => {
    expect(linkHost('https://www.example.org/a?b=1')).toBe('www.example.org')
  })

  it('is null for relative, mailto and javascript links', () => {
    expect(linkHost('/api/config')).toBeNull()
    expect(linkHost('mailto:a@b.org')).toBeNull()
    expect(linkHost('javascript:alert(1)')).toBeNull()
  })
})
