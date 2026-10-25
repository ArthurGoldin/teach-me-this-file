import { createMetaSplitter, parseMeta, validateMeta } from '../ai/meta.js'
import { buildGradeRequest } from '../ai/prompts/grade.js'
import { buildTutorRequest, validateTutorInput } from '../ai/prompts/tutor.js'
import { appError, errorBody, toAppError } from './errors.js'
import { log } from './logger.js'
import { openSse } from './sse.js'

// The tutor sometimes leaves out its hidden meta block. One JSON call grades the turn instead
// (D8); if that fails too, the turn simply has no meta, as before.
async function gradeTurn(gemini, input, reply, signal, passageIds) {
  try {
    const data = await gemini.generateJson({
      ...buildGradeRequest(input, reply.trim()),
      signal,
      invalidCode: 'MODEL_BUSY',
    })
    return validateMeta(data, passageIds)
  } catch {
    return null
  }
}

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
    let metaSource = 'none'
    try {
      const gemini = createGemini({ apiKey: res.locals.apiKey })
      const splitter = createMetaSplitter()
      // Trailing whitespace is held until more text follows, so the newline before the meta
      // marker (or at the very end) is never sent.
      let heldSpace = ''
      let sentText = false
      let reply = ''
      const emit = (text) => {
        reply += text
        const body = text.trimEnd()
        if (body) {
          sse.send('delta', { text: heldSpace + body })
          sentText = true
        }
        heldSpace = body ? text.slice(body.length) : heldSpace + text
      }
      const stream = gemini.streamText({ ...buildTutorRequest(input), signal: controller.signal })
      for await (const chunk of stream) emit(splitter.push(chunk))
      // A stream can end quietly after an abort; the client is gone, so write nothing more.
      if (controller.signal.aborted) {
        code = 'ABORTED'
        return
      }
      const { text, metaRaw } = splitter.end()
      emit(text)
      // Gemini sometimes ends a turn with no visible text (only the meta block, or nothing). An
      // empty bubble would look like a finished answer, so it is a failed turn the student can
      // retry; MODEL_BUSY is the closest code (a passing problem on Gemini's side).
      if (!sentText) throw appError('MODEL_BUSY')
      const passageIds = input.step.passages.map((p) => p.id)
      let meta = parseMeta(metaRaw, passageIds)
      if (meta) metaSource = 'block'
      else {
        meta = await gradeTurn(gemini, input, reply, controller.signal, passageIds)
        if (meta) metaSource = 'fallback'
      }
      if (controller.signal.aborted) {
        code = 'ABORTED'
        return
      }
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
        metaSource,
      })
    }
  }
}
