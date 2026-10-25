import { describe, expect, it } from 'vitest'
import { resolveApiKey } from './apiKey.js'

const req = (key) => ({ get: (name) => (name.toLowerCase() === 'x-gemini-key' ? key : undefined) })

describe('resolveApiKey', () => {
  it('prefers the header over the environment', () => {
    expect(resolveApiKey(req(' header-key '), { GEMINI_API_KEY: 'env-key' })).toBe('header-key')
  })

  it('falls back to the environment when the header is blank', () => {
    expect(resolveApiKey(req('   '), { GEMINI_API_KEY: 'env-key' })).toBe('env-key')
  })

  it('returns null when neither is set', () => {
    expect(resolveApiKey(req(undefined), {})).toBeNull()
  })
})
