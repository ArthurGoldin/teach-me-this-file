import { ApiError } from './errors.js'
import { readSseResponse } from './sse.js'
import { getKey } from './keyStore.js'

// One place for fetch: adds the key header, maps failures to ApiError, leaves aborts alone.
async function request(path, { method = 'GET', body, signal } = {}) {
  const headers = {}
  const key = getKey()
  if (key) headers['X-Gemini-Key'] = key
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let response
  try {
    response = await fetch(path, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new ApiError('NETWORK', 'Could not reach the server. Check your connection.')
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const { code = 'INTERNAL', message, retryAfterSeconds } = payload?.error ?? {}
    throw new ApiError(code, message, retryAfterSeconds)
  }
  return response
}

async function requestJson(path, options) {
  const response = await request(path, options)
  return response.json()
}

export function getConfig() {
  return requestJson('/api/config')
}

export function transcribePages(pages, { signal } = {}) {
  return requestJson('/api/transcribe', { method: 'POST', body: { pages }, signal })
}

export function createPlan({ teacherPrompt, document }, { signal } = {}) {
  return requestJson('/api/plan', { method: 'POST', body: { teacherPrompt, document }, signal })
}

export async function streamTutor(input, { signal, onDelta, onMeta } = {}) {
  const response = await request('/api/tutor', { method: 'POST', body: input, signal })
  try {
    await readSseResponse(response, { onDelta, onMeta })
  } catch (err) {
    // A reader error mid-stream (not an AbortError) means the connection dropped.
    if (err instanceof ApiError || err?.name === 'AbortError') throw err
    throw new ApiError('NETWORK', 'The connection dropped before the answer finished.')
  }
}
