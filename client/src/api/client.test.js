import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getConfig, transcribePages, createPlan, streamTutor } from './client.js'
import { ApiError } from './errors.js'
import { setKey, clearKey } from './keyStore.js'

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function stubFetch(impl) {
  const fetchMock = vi.fn(impl)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => clearKey())
afterEach(() => vi.unstubAllGlobals())

describe('api client', () => {
  it('sends X-Gemini-Key only when a key is set', async () => {
    const fetchMock = stubFetch(async () => json({ hasServerKey: false }))
    await getConfig()
    expect(fetchMock.mock.calls[0][1].headers['X-Gemini-Key']).toBeUndefined()
    setKey('AIza-test', { remember: false })
    await getConfig()
    expect(fetchMock.mock.calls[1][1].headers['X-Gemini-Key']).toBe('AIza-test')
  })

  it('posts JSON to transcribe and plan and returns the parsed body', async () => {
    const fetchMock = stubFetch(async () => json({ ok: true, pages: [] }))
    expect(await transcribePages([{ page: 1, image: 'x' }], {})).toEqual({ ok: true, pages: [] })
    await createPlan({ teacherPrompt: 'p', document: {} }, {})
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/transcribe', '/api/plan'])
    expect(fetchMock.mock.calls[1][1].method).toBe('POST')
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      teacherPrompt: 'p',
      document: {},
    })
  })

  it('turns a non-2xx JSON error into ApiError with code and retryAfterSeconds', async () => {
    stubFetch(async () =>
      json({ error: { code: 'RATE_LIMITED', message: 'Limit', retryAfterSeconds: 9 } }, 429),
    )
    const err = await getConfig().catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe('RATE_LIMITED')
    expect(err.retryAfterSeconds).toBe(9)
  })

  it('maps a fetch TypeError to NETWORK', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    const err = await getConfig().catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe('NETWORK')
  })

  it('rethrows AbortError untouched', async () => {
    const abort = new DOMException('Aborted', 'AbortError')
    stubFetch(async () => {
      throw abort
    })
    const err = await getConfig().catch((e) => e)
    expect(err).toBe(abort)
    expect(err.name).toBe('AbortError')
  })

  it('streamTutor resolves after done and calls onDelta and onMeta', async () => {
    const body =
      'event: delta\ndata: {"text":"Hi"}\n\n' +
      'event: meta\ndata: {"understanding":"solid","passageIds":[]}\n\n' +
      'event: done\ndata: {}\n\n'
    stubFetch(async () => new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }))
    const onDelta = vi.fn()
    const onMeta = vi.fn()
    await streamTutor({ stepNumber: 1 }, { onDelta, onMeta })
    expect(onDelta).toHaveBeenCalledWith('Hi')
    expect(onMeta).toHaveBeenCalledWith({ understanding: 'solid', passageIds: [] })
  })

  it('maps a non-JSON 200 body to INTERNAL', async () => {
    stubFetch(async () => new Response('<html>oops</html>'))
    const err = await getConfig().catch((e) => e)
    expect(err.code).toBe('INTERNAL')
  })

  it('rethrows AbortError when the error body read fails after an abort', async () => {
    const controller = new AbortController()
    controller.abort()
    stubFetch(async () => new Response('not json', { status: 500 }))
    const err = await getConfig({ signal: controller.signal }).catch((e) => e)
    expect(err.name).toBe('AbortError')
  })

  it('surfaces an abort mid-stream as AbortError through streamTutor', async () => {
    const abort = new DOMException('Aborted', 'AbortError')
    stubFetch(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(abort)
            },
          }),
        ),
    )
    const err = await streamTutor({}, {}).catch((e) => e)
    expect(err.name).toBe('AbortError')
  })

  it('rejects with the code of an error event that follows deltas', async () => {
    const body =
      'event: delta\ndata: {"text":"Hi"}\n\n' +
      'event: error\ndata: {"code":"MODEL_BUSY","message":"Busy"}\n\n'
    stubFetch(async () => new Response(body))
    const onDelta = vi.fn()
    const err = await streamTutor({}, { onDelta }).catch((e) => e)
    expect(onDelta).toHaveBeenCalledWith('Hi')
    expect(err.code).toBe('MODEL_BUSY')
  })
})
