import { describe, expect, it } from 'vitest'
import { combinePages, selectPages } from './selectPages.js'

const pages = [
  { page: 1, text: 'Text of page one', isScan: false },
  { page: 2, text: '', isScan: true },
  { page: 3, text: 'Text of page three', isScan: false },
  { page: 4, text: '', isScan: true },
  { page: 5, text: '', isScan: true },
]

describe('selectPages', () => {
  it('splits the range into text pages and scanned pages to transcribe', () => {
    expect(selectPages(pages, { from: 1, to: 4 })).toEqual({
      textPages: [
        { page: 1, text: 'Text of page one', origin: 'text' },
        { page: 3, text: 'Text of page three', origin: 'text' },
      ],
      scanPages: [2, 4],
      skipped: [{ pages: [5], reason: 'outside-range' }],
    })
  })

  it('handles a range with only scanned pages', () => {
    expect(selectPages(pages, { from: 4, to: 5 })).toMatchObject({
      textPages: [],
      scanPages: [4, 5],
    })
  })
})

describe('combinePages', () => {
  const textPages = [{ page: 3, text: 'Text of page three', origin: 'text' }]

  it('merges readable transcriptions with text pages in page order', () => {
    const transcriptions = [
      { page: 4, readable: true, markdown: '| a | b |' },
      { page: 2, readable: true, markdown: '$E = mc^2$' },
    ]
    expect(combinePages({ textPages, transcriptions, notTranscribed: [] })).toEqual({
      pages: [
        { page: 2, text: '$E = mc^2$', origin: 'transcription' },
        { page: 3, text: 'Text of page three', origin: 'text' },
        { page: 4, text: '| a | b |', origin: 'transcription' },
      ],
      skipped: [],
    })
  })

  it('records pages that were never sent apart from unreadable ones', () => {
    const transcriptions = [
      { page: 2, readable: false, markdown: '', sent: false },
      { page: 4, readable: false, markdown: '' },
    ]
    expect(combinePages({ textPages, transcriptions, notTranscribed: [] }).skipped).toEqual([
      { pages: [4], reason: 'unreadable' },
      { pages: [2], reason: 'not-sent' },
    ])
  })

  it('records unreadable and not transcribed pages as skipped, sorted', () => {
    const transcriptions = [
      { page: 5, readable: false, markdown: '' },
      { page: 2, readable: false, markdown: '' },
    ]
    expect(combinePages({ textPages, transcriptions, notTranscribed: [8, 7] })).toEqual({
      pages: textPages,
      skipped: [
        { pages: [2, 5], reason: 'unreadable' },
        { pages: [7, 8], reason: 'not-transcribed' },
      ],
    })
  })
})
