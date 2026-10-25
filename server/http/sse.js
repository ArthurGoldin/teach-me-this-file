// Server-Sent Events over a plain POST response. `X-Accel-Buffering: no` and `no-transform`
// stop proxies from buffering or compressing the stream, so deltas arrive as they are sent.
export function openSse(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders()
  return {
    // After a disconnect there is nobody to write to, so late events are dropped.
    send(event, data) {
      if (res.writableEnded || res.destroyed) return
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    },
  }
}
