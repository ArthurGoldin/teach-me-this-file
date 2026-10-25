import express from 'express'
import { createGemini as defaultCreateGemini } from './ai/gemini.js'
import { requireApiKey } from './http/apiKey.js'
import { errorHandler } from './http/errorHandler.js'
import { createPlanRoute } from './http/planRoute.js'
import { createTranscribeRoute } from './http/transcribeRoute.js'
import { createTutorRoute } from './http/tutorRoute.js'

// `createGemini` is injectable so route tests can use a fake model.
export function createApp({ createGemini = defaultCreateGemini, env = process.env } = {}) {
  const app = express()
  app.use(express.json({ limit: '4mb' }))

  app.get('/api/config', (req, res) => {
    res.json({ hasServerKey: Boolean(env.GEMINI_API_KEY) })
  })

  app.post('/api/transcribe', requireApiKey(env), createTranscribeRoute({ createGemini }))
  app.post('/api/plan', requireApiKey(env), createPlanRoute({ createGemini }))
  app.post('/api/tutor', requireApiKey(env), createTutorRoute({ createGemini }))

  app.use(errorHandler)

  return app
}
