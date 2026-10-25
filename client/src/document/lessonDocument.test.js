import { describe, expect, it } from 'vitest'
import { buildLessonDocument } from './lessonDocument.js'

const base = { name: 'a.pdf', kind: 'pdf', pageCount: 3, range: { from: 1, to: 2 }, skipped: [] }

describe('buildLessonDocument', () => {
  it('chunks the pages into passages and keeps the metadata', () => {
    const doc = buildLessonDocument({
      ...base,
      pages: [{ page: 1, text: 'Hello there.', origin: 'text' }],
      skipped: [{ pages: [3], reason: 'outside-range' }],
    })
    expect(doc).toEqual({
      ...base,
      skipped: [{ pages: [3], reason: 'outside-range' }],
      passages: [{ id: 'p1-1', page: 1, text: 'Hello there.', origin: 'text' }],
    })
  })

  it('throws NO_CONTENT when there is no text', () => {
    const pages = [{ page: 1, text: '  \n ', origin: 'text' }]
    expect(() => buildLessonDocument({ ...base, pages })).toThrowError(
      expect.objectContaining({ name: 'DocumentError', code: 'NO_CONTENT' }),
    )
  })
})
