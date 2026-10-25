import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createApp } from '../app.js'

const body = {
  pages: [
    { page: 1, imageBase64: 'AAA' },
    { page: 2, imageBase64: 'BBB' },
  ],
}

let server
let url

async function start(generateJson) {
  const createGemini = vi.fn(() => ({ generateJson }))
  server = createApp({ createGemini, env: {} }).listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  url = `http://localhost:${server.address().port}/api/transcribe`
  return createGemini
}

function post(options = {}) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Gemini-Key': 'test-key' },
    body: JSON.stringify(body),
    ...options,
  })
}

beforeEach(() => {
  vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  vi.spyOn(process.stderr, 'write').mockReturnValue(true)
})

afterEach(async () => {
  vi.restoreAllMocks()
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
})

it('returns only the requested pages, with missing ones unreadable', async () => {
  const generateJson = vi.fn().mockResolvedValue({
    pages: [
      { page: 1, readable: true, markdown: '# Le cycle' },
      { page: 7, readable: true, markdown: 'invented page' },
    ],
  })
  const createGemini = await start(generateJson)
  const res = await post()
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({
    pages: [
      { page: 1, readable: true, markdown: '# Le cycle' },
      { page: 2, readable: false, markdown: '' },
    ],
  })
  expect(createGemini).toHaveBeenCalledWith({ apiKey: 'test-key' })
  const request = generateJson.mock.calls[0][0]
  expect(request.schema).toBeDefined()
  expect(request.contents[0].parts).toHaveLength(4)
})

it('passes a rate limit through as 429 RATE_LIMITED', async () => {
  const quota = Object.assign(new Error('quota "retryDelay":"20s"'), { status: 429 })
  await start(vi.fn().mockRejectedValue(quota))
  const res = await post()
  expect(res.status).toBe(429)
  expect((await res.json()).error).toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 20 })
})

it('reports an unreadable model answer as 502 TRANSCRIBE_INVALID', async () => {
  const generateJson = vi.fn().mockResolvedValue({ pages: [] })
  await start(generateJson)
  await post()
  expect(generateJson.mock.calls[0][0].invalidCode).toBe('TRANSCRIBE_INVALID')
})

it('rejects a bad body with 400 BAD_REQUEST without calling Gemini', async () => {
  const generateJson = vi.fn()
  await start(generateJson)
  const res = await post({ body: JSON.stringify({ pages: [] }) })
  expect(res.status).toBe(400)
  expect((await res.json()).error.code).toBe('BAD_REQUEST')
  expect(generateJson).not.toHaveBeenCalled()
})

it('rejects a request without a key with 401 NO_KEY', async () => {
  await start(vi.fn())
  const res = await post({ headers: { 'Content-Type': 'application/json' } })
  expect(res.status).toBe(401)
  expect((await res.json()).error.code).toBe('NO_KEY')
})
