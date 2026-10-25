import { describe, expect, it } from 'vitest'
import { messageFor } from './errorMessages.js'

describe('messageFor', () => {
  it('puts the wait time in the rate-limit message', () => {
    expect(messageFor('RATE_LIMITED', { retryAfterSeconds: 12 })).toEqual({
      text: "Gemini's free-tier limit was reached. Try again in 12 s.",
      action: 'retry',
    })
  })

  it('says "shortly" when the wait time is unknown', () => {
    expect(messageFor('RATE_LIMITED').text).toContain('Try again shortly.')
  })

  it('tells the teacher to export a DOCX as PDF', () => {
    expect(messageFor('UNSUPPORTED_FILE', { fileType: 'DOCX' })).toEqual({
      text: "DOCX isn't supported yet. Export it as PDF and try again.",
      action: 'pick-file',
    })
  })

  it('names other unsupported types and lists what works', () => {
    expect(messageFor('UNSUPPORTED_FILE', { fileType: 'ZIP' }).text).toMatch(/^ZIP files aren't/)
  })

  it('only mentions passwords for a PDF that will not open', () => {
    expect(messageFor('CORRUPT_FILE', { fileType: 'PDF' }).text).toMatch(/^This PDF.*password/)
    expect(messageFor('CORRUPT_FILE', { fileType: 'TXT' }).text).not.toMatch(/PDF|password/)
  })

  it('offers a reload when part of the app failed to download', () => {
    expect(messageFor('NETWORK', { reloadNeeded: true })).toEqual({
      text: 'The app was updated or the connection dropped. Reload the page to continue.',
      action: 'reload',
    })
    expect(messageFor('NETWORK').action).toBe('retry')
  })

  it('sends key problems to the settings', () => {
    expect(messageFor('NO_KEY').action).toBe('settings')
    expect(messageFor('INVALID_KEY').action).toBe('settings')
  })

  it('falls back to a retryable generic message for unknown codes', () => {
    expect(messageFor('INTERNAL')).toEqual(messageFor('SOMETHING_NEW'))
    expect(messageFor('INTERNAL').action).toBe('retry')
  })

  it('says the scanned pages could not be read, with a retry', () => {
    expect(messageFor('TRANSCRIBE_INVALID')).toEqual({
      text: "Couldn't read the scanned pages. Try again.",
      action: 'retry',
    })
  })
})
