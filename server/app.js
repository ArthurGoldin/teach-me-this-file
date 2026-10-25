import express from 'express'
import { errorBody, toAppError } from './http/errors.js'
import { log } from './http/logger.js'

export function createApp({ env = process.env } = {}) {
  const app = express()

  app.get('/api/config', (req, res) => {
    res.json({ hasServerKey: Boolean(env.GEMINI_API_KEY) })
  })

  // Express recognises error handlers by their four parameters, so `next` must stay.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const appError = toAppError(err)
    log.error('request_failed', { route: req.path, status: appError.status, code: appError.code })
    res.status(appError.status).json(errorBody(appError))
  })

  return app
}
