import { ApiError } from './errors.js'

// Turns one SSE block ("event: x\ndata: {...}") into { event, data }; null for comment-only blocks.
function parseBlock(block) {
  let event = 'message'
  const dataLines = []
  for (const line of block.split('\n')) {
    if (line.startsWith(':')) continue
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
  }
  if (dataLines.length === 0) return null
  return { event, data: JSON.parse(dataLines.join('\n')) }
}

// Chunks can cut an event anywhere, so text is buffered until a blank line ends a block.
export function createSseParser(onEvent) {
  let buffer = ''
  return {
    push(text) {
      buffer += text.replace(/\r\n/g, '\n')
      let end
      while ((end = buffer.indexOf('\n\n')) !== -1) {
        const parsed = parseBlock(buffer.slice(0, end))
        buffer = buffer.slice(end + 2)
        if (parsed) onEvent(parsed)
      }
    },
  }
}

// Reads a streamed tutor response. Resolves only after the `done` event, so a connection that
// drops mid-answer is reported as NETWORK instead of looking like a finished message.
export async function readSseResponse(response, { onDelta, onMeta }) {
  let finished = false
  let failure = null
  const parser = createSseParser(({ event, data }) => {
    if (event === 'delta') onDelta?.(data.text)
    else if (event === 'meta') onMeta?.(data)
    else if (event === 'error') {
      failure = new ApiError(data.code, data.message, data.retryAfterSeconds)
    } else if (event === 'done') finished = true
  })

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    parser.push(decoder.decode(value, { stream: true }))
    if (failure) {
      await reader.cancel()
      throw failure
    }
  }
  if (failure) throw failure
  if (!finished) throw new ApiError('NETWORK', 'The connection dropped before the answer finished.')
}
