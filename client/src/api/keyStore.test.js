import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getKey, setKey, clearKey, isRemembered } from './keyStore.js'

function fakeStorage() {
  const data = new Map()
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
  }
}

let storage
beforeEach(() => {
  storage = fakeStorage()
  vi.stubGlobal('sessionStorage', storage)
  clearKey()
})
afterEach(() => vi.unstubAllGlobals())

describe('keyStore', () => {
  it('keeps the key in memory only by default', () => {
    setKey('k1', { remember: false })
    expect(getKey()).toBe('k1')
    expect(isRemembered()).toBe(false)
    expect(storage.getItem('tmtf.apiKey')).toBeNull()
  })

  it('writes to sessionStorage when remember is set, and clearKey removes it', () => {
    setKey('k2', { remember: true })
    expect(isRemembered()).toBe(true)
    expect(storage.getItem('tmtf.apiKey')).toBe('k2')
    clearKey()
    expect(getKey()).toBeNull()
    expect(storage.getItem('tmtf.apiKey')).toBeNull()
  })

  it('still works when sessionStorage throws', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    })
    expect(() => setKey('k3', { remember: true })).not.toThrow()
    expect(getKey()).toBe('k3')
    expect(() => clearKey()).not.toThrow()
  })
})
