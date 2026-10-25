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
  TRANSCRIBE_INVALID: "Couldn't read the scanned pages. Try again.",
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

const STATUSES = {
  NO_KEY: 401,
  INVALID_KEY: 401,
  RATE_LIMITED: 429,
  MODEL_BUSY: 503,
  BLOCKED: 422,
  PAYLOAD_TOO_LARGE: 413,
  BAD_REQUEST: 400,
  PLAN_INVALID: 502,
  TRANSCRIBE_INVALID: 502,
  INTERNAL: 500,
}

// Builds an AppError with the user-facing copy and HTTP status for a code.
export function appError(code, extra) {
  return new AppError(code, MESSAGES[code], { status: STATUSES[code], ...extra })
}

// A 400 for a request body the server cannot use, saying what was wrong with it.
export function badRequest(reason) {
  return new AppError('BAD_REQUEST', `The request was not valid: ${reason}.`, { status: 400 })
}

// Gemini puts the retry delay inside the error message JSON, e.g. "retryDelay":"17s".
function parseRetryDelay(message = '') {
  const match = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(message)
  return match ? Math.ceil(Number(match[1])) : undefined
}

export function toAppError(err) {
  if (err instanceof AppError) return err
  if (err?.name === 'AbortError') return new AppError('ABORTED', 'Request aborted', { status: 499 })
  if (err?.type === 'entity.too.large') return appError('PAYLOAD_TOO_LARGE')

  const message = String(err?.message ?? '')
  switch (err?.status) {
    case 400:
      return message.includes('API_KEY_INVALID') ? appError('INVALID_KEY') : appError('BAD_REQUEST')
    case 401:
    case 403:
      return appError('INVALID_KEY')
    case 429:
      return appError('RATE_LIMITED', { retryAfterSeconds: parseRetryDelay(message) })
    case 500:
    case 502:
    case 503:
    case 504:
      return appError('MODEL_BUSY')
    default:
      return appError('INTERNAL')
  }
}

export function errorBody({ code, message, retryAfterSeconds }) {
  const error = { code, message }
  if (retryAfterSeconds !== undefined) error.retryAfterSeconds = retryAfterSeconds
  return { error }
}
