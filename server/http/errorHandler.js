import { errorBody, toAppError } from './errors.js'
import { log } from './logger.js'

export function errorHandler(err, req, res, next) {
  // Mid-stream the status line is already sent; let Express close the connection.
  if (res.headersSent) return next(err)
  const appError = toAppError(err)
  log.error('request_failed', { route: req.path, status: appError.status, code: appError.code })
  res.status(appError.status).json(errorBody(appError))
}
