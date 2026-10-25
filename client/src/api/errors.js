// Error thrown by every API call. `code` is one of the shared error codes (global constraints).
export class ApiError extends Error {
  constructor(code, message, retryAfterSeconds) {
    super(message ?? code)
    this.name = 'ApiError'
    this.code = code
    this.retryAfterSeconds = retryAfterSeconds
  }
}
