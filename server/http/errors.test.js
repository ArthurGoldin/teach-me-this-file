import { describe, expect, it } from 'vitest'
import { AppError, errorBody, toAppError } from './errors.js'

describe('toAppError', () => {
  it('maps a 400 invalid-key message to INVALID_KEY', () => {
    const err = toAppError({ status: 400, message: '{"error":{"message":"API_KEY_INVALID"}}' })
    expect(err.code).toBe('INVALID_KEY')
  })

  it.each([401, 403])('maps %i to INVALID_KEY', (status) => {
    expect(toAppError({ status, message: 'nope' }).code).toBe('INVALID_KEY')
  })

  it('maps 429 to RATE_LIMITED and reads the retry delay', () => {
    const err = toAppError({ status: 429, message: '{"retryDelay":"17s"}' })
    expect(err.code).toBe('RATE_LIMITED')
    expect(err.retryAfterSeconds).toBe(17)
  })

  it.each([500, 502, 503, 504])('maps %i to MODEL_BUSY', (status) => {
    expect(toAppError({ status, message: 'busy' }).code).toBe('MODEL_BUSY')
  })

  it('maps a body-parser size error to PAYLOAD_TOO_LARGE with status 413', () => {
    const err = toAppError({ type: 'entity.too.large' })
    expect(err.code).toBe('PAYLOAD_TOO_LARGE')
    expect(err.status).toBe(413)
  })

  it('maps an AbortError to ABORTED', () => {
    expect(toAppError({ name: 'AbortError' }).code).toBe('ABORTED')
  })

  it('returns an existing AppError unchanged', () => {
    const original = new AppError('BLOCKED', 'x', { status: 422 })
    expect(toAppError(original)).toBe(original)
  })

  it('maps unknown errors to INTERNAL', () => {
    expect(toAppError(new Error('boom')).code).toBe('INTERNAL')
  })
})

describe('errorBody', () => {
  it('never leaks the original message for INTERNAL', () => {
    const body = errorBody(toAppError(new Error('secret detail')))
    expect(JSON.stringify(body)).not.toContain('secret detail')
    expect(body.error.code).toBe('INTERNAL')
  })

  it('includes retryAfterSeconds only when set', () => {
    expect(
      errorBody(toAppError({ status: 429, message: '"retryDelay":"5s"' })).error,
    ).toMatchObject({
      retryAfterSeconds: 5,
    })
    expect(errorBody(toAppError({ status: 503 })).error).not.toHaveProperty('retryAfterSeconds')
  })
})
