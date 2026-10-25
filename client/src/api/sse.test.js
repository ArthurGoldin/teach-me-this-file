import { describe, it, expect, vi } from 'vitest'
import { createSseParser, readSseResponse } from './sse.js'
import { ApiError } from './errors.js'

function frame(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function responseFrom(chunks) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(stream)
}

describe('createSseParser', () => {
  it('emits two events from one push', () => {
    const onEvent = vi.fn()
    createSseParser(onEvent).push(frame('delta', { text: 'a' }) + frame('done', {}))
    expect(onEvent.mock.calls.map(([e]) => e)).toEqual([
      { event: 'delta', data: { text: 'a' } },
      { event: 'done', data: {} },
    ])
  })

  it('emits one event split across three pushes', () => {
    const onEvent = vi.fn()
    const parser = createSseParser(onEvent)
    parser.push('event: delta\nda')
    parser.push('ta: {"text":"hi"}\n')
    expect(onEvent).not.toHaveBeenCalled()
    parser.push('\n')
    expect(onEvent).toHaveBeenCalledWith({ event: 'delta', data: { text: 'hi' } })
  })

  it('accepts CRLF separators', () => {
    const onEvent = vi.fn()
    createSseParser(onEvent).push('event: delta\r\ndata: {"text":"x"}\r\n\r\n')
    expect(onEvent).toHaveBeenCalledWith({ event: 'delta', data: { text: 'x' } })
  })

  it('ignores comment lines', () => {
    const onEvent = vi.fn()
    createSseParser(onEvent).push(': keep-alive\n\n')
    createSseParser(onEvent).push(': c\nevent: done\ndata: {}\n\n')
    expect(onEvent).toHaveBeenCalledTimes(1)
    expect(onEvent).toHaveBeenCalledWith({ event: 'done', data: {} })
  })

  it('joins multi-line data', () => {
    const onEvent = vi.fn()
    createSseParser(onEvent).push('event: delta\ndata: {"text":\ndata: "ab"}\n\n')
    expect(onEvent).toHaveBeenCalledWith({ event: 'delta', data: { text: 'ab' } })
  })
})

describe('readSseResponse', () => {
  it('calls handlers in order and resolves on done', async () => {
    const calls = []
    const response = responseFrom([
      frame('delta', { text: 'Hello' }),
      frame('meta', { understanding: 'solid', passageIds: ['p1-1'] }),
      frame('done', {}),
    ])
    await readSseResponse(response, {
      onDelta: (text) => calls.push(['delta', text]),
      onMeta: (meta) => calls.push(['meta', meta]),
    })
    expect(calls).toEqual([
      ['delta', 'Hello'],
      ['meta', { understanding: 'solid', passageIds: ['p1-1'] }],
    ])
  })

  it('rejects with ApiError from an error event', async () => {
    const response = responseFrom([
      frame('error', { code: 'RATE_LIMITED', message: 'Slow down', retryAfterSeconds: 17 }),
    ])
    const err = await readSseResponse(response, {}).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe('RATE_LIMITED')
    expect(err.retryAfterSeconds).toBe(17)
  })

  it('rejects NETWORK when the body ends without done', async () => {
    const response = responseFrom([frame('delta', { text: 'cut' })])
    const err = await readSseResponse(response, { onDelta: () => {} }).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe('NETWORK')
  })
})
