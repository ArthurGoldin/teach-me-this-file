import {
  TRANSCRIBE_SCHEMA,
  buildTranscribeRequest,
  readTranscription,
  validateTranscribeInput,
} from '../ai/prompts/transcribe.js'
import { log } from './logger.js'

// POST /api/transcribe: one JSON call that turns up to 8 page images into Markdown (design
// §6.1). The client batches pages so the body stays under 3 MB; errors go to the JSON handler.
export function createTranscribeRoute({ createGemini }) {
  return async (req, res) => {
    const pages = validateTranscribeInput(req.body)
    const started = Date.now()

    // The client went away (Cancel): stop waiting for Gemini.
    const controller = new AbortController()
    res.on('close', () => {
      if (!res.writableEnded) controller.abort()
    })

    const gemini = createGemini({ apiKey: res.locals.apiKey })
    const result = await gemini.generateJson({
      ...buildTranscribeRequest(pages),
      schema: TRANSCRIBE_SCHEMA,
      invalidCode: 'TRANSCRIBE_INVALID',
      signal: controller.signal,
    })
    log.info('pages_transcribed', {
      route: '/api/transcribe',
      durationMs: Date.now() - started,
      pages: pages.length,
    })
    res.json({ pages: readTranscription(result, pages) })
  }
}
