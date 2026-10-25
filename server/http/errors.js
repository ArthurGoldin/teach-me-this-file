// User-facing copy per error code (design §9). Raw provider messages are never forwarded.
const MESSAGES = {
  NO_KEY: 'Paste a Gemini API key to start.',
  INVALID_KEY: 'Gemini rejected this API key.',
  RATE_LIMITED: "Gemini's free-tier limit was reached.",
  MODEL_BUSY: 'Gemini is busy right now.',
  BLOCKED: 'Gemini declined to answer this. Try rephrasing.',
  PAYLOAD_TOO_LARGE: 'This page image is too large.',
  BAD_REQUEST: 'The request was not valid.',
  PLAN_INVALID: "Couldn't build a lesson from this file. Try again.",
  INTERNAL: 'Something went wrong on our side.',
}

export class AppError extends Error {
  constructor(code, message, { status = 500, retryAfterSeconds } = {}) {
    super(message)
    this.code = code
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

function make(code, status, extra) {
  return new AppError(code, MESSAGES[code], { status, ...extra })
}

// Gemini puts the retry delay inside the error message JSON, e.g. "retryDelay":"17s".
function parseRetryDelay(message = '') {
  const match = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(message)
  return match ? Math.ceil(Number(match[1])) : undefined
}

export function toAppError(err) {
  if (err instanceof AppError) return err
  if (err?.name === 'AbortError') return new AppError('ABORTED', 'Request aborted', { status: 499 })
  if (err?.type === 'entity.too.large') return make('PAYLOAD_TOO_LARGE', 413)

  const message = String(err?.message ?? '')
  switch (err?.status) {
    case 400:
      return message.includes('API_KEY_INVALID')
        ? make('INVALID_KEY', 401)
        : make('BAD_REQUEST', 400)
    case 401:
    case 403:
      return make('INVALID_KEY', 401)
    case 429:
      return make('RATE_LIMITED', 429, { retryAfterSeconds: parseRetryDelay(message) })
    case 500:
    case 503:
      return make('MODEL_BUSY', 503)
    default:
      return make('INTERNAL', 500)
  }
}

export function errorBody({ code, message, retryAfterSeconds }) {
  const error = { code, message }
  if (retryAfterSeconds !== undefined) error.retryAfterSeconds = retryAfterSeconds
  return { error }
}
