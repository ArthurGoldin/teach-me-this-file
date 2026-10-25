import express from 'express'

export function createApp({ env = process.env } = {}) {
  const app = express()

  app.get('/api/config', (req, res) => {
    res.json({ hasServerKey: Boolean(env.GEMINI_API_KEY) })
  })

  return app
}
