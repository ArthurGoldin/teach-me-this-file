// The API key lives in memory. It is copied to sessionStorage only if the user asks to
// remember it for this tab. sessionStorage can throw (private mode), so every access is guarded.
const STORAGE_KEY = 'tmtf.apiKey'
let memoryKey = null

function readStored() {
  try {
    return sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStored(key) {
  try {
    if (key === null) sessionStorage.removeItem(STORAGE_KEY)
    else sessionStorage.setItem(STORAGE_KEY, key)
  } catch {
    // Storage unavailable: the key simply stays in memory only.
  }
}

export function getKey() {
  return memoryKey ?? readStored()
}

export function setKey(key, { remember }) {
  memoryKey = key
  writeStored(remember ? key : null)
}

export function clearKey() {
  memoryKey = null
  writeStored(null)
}

export function isRemembered() {
  return readStored() !== null
}
