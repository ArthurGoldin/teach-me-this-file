// Error thrown while reading a document. `code` is one of the shared error codes:
// UNSUPPORTED_FILE, FILE_TOO_LARGE, CORRUPT_FILE, NO_CONTENT.
export class DocumentError extends Error {
  constructor(code, message) {
    super(message ?? code)
    this.name = 'DocumentError'
    this.code = code
  }
}
