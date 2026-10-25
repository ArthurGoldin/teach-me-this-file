import express from 'express'
import { errorHandler } from './http/errorHandler.js'

export function createApp({ env = process.env } = {}) {
  const app = express()

  app.get('/api/config', (req, res) => {
    res.json({ hasServerKey: Boolean(env.GEMINI_API_KEY) })
  })

  app.use(errorHandler)

  return app
}
