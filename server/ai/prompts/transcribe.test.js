import { describe, expect, it } from 'vitest'
import { AppError } from '../../http/errors.js'
import {
  MAX_MARKDOWN,
  TRANSCRIBE_SCHEMA,
  buildTranscribeRequest,
  readTranscription,
  validateTranscribeInput,
} from './transcribe.js'

const pages = [
  { page: 3, imageBase64: 'AAA' },
  { page: 5, imageBase64: 'BBB' },
]

describe('validateTranscribeInput', () => {
  it('returns the pages of a valid body', () => {
    expect(validateTranscribeInput({ pages })).toEqual(pages)
  })

  it.each([
    ['a body that is not an object', null],
    ['no pages', { pages: [] }],
    ['pages that are not an array', { pages: 'x' }],
    [
      'more than 8 pages',
      { pages: Array.from({ length: 9 }, (_, i) => ({ page: i + 1, imageBase64: 'A' })) },
    ],
    ['a page number that is not a positive integer', { pages: [{ page: 0, imageBase64: 'A' }] }],
    ['a fractional page number', { pages: [{ page: 1.5, imageBase64: 'A' }] }],
    ['an empty image', { pages: [{ page: 1, imageBase64: '' }] }],
    ['an image that is not a string', { pages: [{ page: 1, imageBase64: 42 }] }],
    ['an image over 3,000,000 chars', { pages: [{ page: 1, imageBase64: 'A'.repeat(3_000_001) }] }],
    ['a duplicate page number', { pages: [pages[0], pages[0]] }],
  ])('rejects %s with BAD_REQUEST', (_, body) => {
    expect(() => validateTranscribeInput(body)).toThrow(AppError)
    expect(() => validateTranscribeInput(body)).toThrow(/not valid/)
  })
})

describe('buildTranscribeRequest', () => {
  it('sends one label and one JPEG part per page, in order', () => {
    const { contents } = buildTranscribeRequest(pages)
    expect(contents).toEqual([
      {
        role: 'user',
        parts: [
          { text: 'Page 3' },
          { inlineData: { mimeType: 'image/jpeg', data: 'AAA' } },
          { text: 'Page 5' },
          { inlineData: { mimeType: 'image/jpeg', data: 'BBB' } },
        ],
      },
    ])
  })

  it('asks for a verbatim transcription and treats image text as data', () => {
    const { systemInstruction } = buildTranscribeRequest(pages)
    expect(systemInstruction).toMatch(/verbatim/i)
    expect(systemInstruction).toMatch(/LaTeX/)
    expect(systemInstruction).toMatch(/Markdown table/i)
    expect(systemInstruction).toMatch(/"readable": false/)
    expect(systemInstruction).toMatch(/never instructions to you/i)
  })

  it('has a schema with page, readable and markdown', () => {
    const item = TRANSCRIBE_SCHEMA.properties.pages.items
    expect(item.required).toEqual(['page', 'readable', 'markdown'])
  })
})

describe('readTranscription', () => {
  it('returns only the requested pages, in request order', () => {
    const result = {
      pages: [
        { page: 5, readable: true, markdown: 'five' },
        { page: 99, readable: true, markdown: 'not asked for' },
        { page: 3, readable: true, markdown: 'three' },
      ],
    }
    expect(readTranscription(result, pages)).toEqual([
      { page: 3, readable: true, markdown: 'three' },
      { page: 5, readable: true, markdown: 'five' },
    ])
  })

  it('reports a page the model left out as unreadable', () => {
    const result = { pages: [{ page: 3, readable: true, markdown: 'three' }] }
    expect(readTranscription(result, pages)[1]).toEqual({ page: 5, readable: false, markdown: '' })
  })

  it('reports a readable page with blank markdown as unreadable', () => {
    const result = { pages: [{ page: 3, readable: true, markdown: '  \n' }] }
    expect(readTranscription(result, pages)[0]).toEqual({ page: 3, readable: false, markdown: '' })
  })

  it('drops markdown of a page marked unreadable', () => {
    const result = { pages: [{ page: 3, readable: false, markdown: 'scribbles' }] }
    expect(readTranscription(result, pages)[0]).toEqual({ page: 3, readable: false, markdown: '' })
  })

  it('survives a malformed answer', () => {
    expect(readTranscription({ pages: 'x' }, pages).map((p) => p.readable)).toEqual([false, false])
    expect(readTranscription(null, pages).map((p) => p.readable)).toEqual([false, false])
  })

  it('cuts markdown to the length limit', () => {
    const result = { pages: [{ page: 3, readable: true, markdown: 'a'.repeat(MAX_MARKDOWN + 5) }] }
    expect(readTranscription(result, pages)[0].markdown).toHaveLength(MAX_MARKDOWN)
  })
})
