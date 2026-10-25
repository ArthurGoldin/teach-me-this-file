import { appError } from './errors.js'

export function resolveApiKey(req, env) {
  const fromHeader = req.get('x-gemini-key')?.trim()
  return fromHeader || env.GEMINI_API_KEY || null
}

export function requireApiKey(env) {
  return (req, res, next) => {
    const apiKey = resolveApiKey(req, env)
    if (!apiKey) {
      return next(appError('NO_KEY'))
    }
    res.locals.apiKey = apiKey
    next()
  }
}
