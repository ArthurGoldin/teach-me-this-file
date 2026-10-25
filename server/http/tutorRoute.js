import { createMetaSplitter, parseMeta } from '../ai/meta.js'
import { buildTutorRequest, validateTutorInput } from '../ai/prompts/tutor.js'
import { errorBody, toAppError } from './errors.js'
import { log } from './logger.js'
import { openSse } from './sse.js'

// POST /api/tutor: one tutor turn, streamed as SSE (design §8). Validation errors happen before
// the stream opens and go to the JSON error handler; later errors become an `error` event.
export function createTutorRoute({ createGemini }) {
  return async (req, res) => {
    const input = validateTutorInput(req.body)
    const started = Date.now()
    const sse = openSse(res)

    // The client pressed Stop or went away: stop reading from Gemini.
    const controller = new AbortController()
    res.on('close', () => {
      if (!res.writableEnded) controller.abort()
    })

    let code
    try {
      const gemini = createGemini({ apiKey: res.locals.apiKey })
      const splitter = createMetaSplitter()
      // Trailing whitespace is held until more text follows, so the newline before the meta
      // marker (or at the very end) is never sent.
      let heldSpace = ''
      const emit = (text) => {
        const body = text.trimEnd()
        if (body) sse.send('delta', { text: heldSpace + body })
        heldSpace = body ? text.slice(body.length) : heldSpace + text
      }
      const stream = gemini.streamText({ ...buildTutorRequest(input), signal: controller.signal })
      for await (const chunk of stream) emit(splitter.push(chunk))
      const { text, metaRaw } = splitter.end()
      emit(text)
      const meta = parseMeta(
        metaRaw,
        input.step.passages.map((p) => p.id),
      )
      if (meta) sse.send('meta', meta)
      sse.send('done', {})
    } catch (err) {
      const appError = toAppError(err)
      code = appError.code
      if (code !== 'ABORTED') sse.send('error', errorBody(appError).error)
    } finally {
      res.end()
      log.info('tutor_turn', {
        route: '/api/tutor',
        mode: input.mode,
        durationMs: Date.now() - started,
        code,
      })
    }
  }
}
