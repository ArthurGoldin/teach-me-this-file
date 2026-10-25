// User-facing copy for every error code (design §9). One place, plain verbs, no apologies.
// `action` tells the UI which button to offer next to the message.

const UNSUPPORTED_COPY = {
  DOCX: "DOCX isn't supported yet. Export it as PDF and try again.",
  DOC: "DOC isn't supported yet. Export it as PDF and try again.",
  PPTX: "PPTX isn't supported yet. Export it as PDF and try again.",
}

function unsupported(fileType) {
  if (UNSUPPORTED_COPY[fileType]) return UNSUPPORTED_COPY[fileType]
  const name = fileType ? `${fileType} files aren't` : "This file type isn't"
  return `${name} supported. Use a PDF, an image (JPG, PNG, WebP) or a text file (TXT, MD).`
}

function rateLimited(retryAfterSeconds) {
  const wait = retryAfterSeconds > 0 ? `Try again in ${retryAfterSeconds} s.` : 'Try again shortly.'
  return `Gemini's free-tier limit was reached. ${wait}`
}

/**
 * @param {string} code one of the shared error codes
 * @param {{ retryAfterSeconds?: number, fileType?: string, reloadNeeded?: boolean }} [details]
 *   reloadNeeded: part of the app's own code failed to download (see readFile.js)
 * @returns {{ text: string, action: 'retry' | 'settings' | 'pick-file' | 'reload' | null }}
 */
export function messageFor(code, { retryAfterSeconds, fileType, reloadNeeded } = {}) {
  if (reloadNeeded) {
    return {
      text: 'The app was updated or the connection dropped. Reload the page to continue.',
      action: 'reload',
    }
  }
  switch (code) {
    case 'NO_KEY':
      return { text: 'Paste a Gemini API key to start.', action: 'settings' }
    case 'INVALID_KEY':
      return { text: 'Gemini rejected this API key. Check it and try again.', action: 'settings' }
    case 'RATE_LIMITED':
      return { text: rateLimited(retryAfterSeconds), action: 'retry' }
    case 'MODEL_BUSY':
      return { text: 'Gemini is busy right now. Try again in a moment.', action: 'retry' }
    case 'BLOCKED':
      return { text: 'Gemini declined to answer this. Try rephrasing the prompt.', action: null }
    case 'NETWORK':
      return { text: 'Connection lost. Check your connection and try again.', action: 'retry' }
    case 'PAYLOAD_TOO_LARGE':
      return { text: 'This page image is too large to send.', action: 'pick-file' }
    case 'UNSUPPORTED_FILE':
      return { text: unsupported(fileType), action: 'pick-file' }
    case 'FILE_TOO_LARGE':
      return { text: 'This file is over 50 MB. Pick a smaller file.', action: 'pick-file' }
    case 'CORRUPT_FILE':
      return {
        text:
          fileType === 'PDF'
            ? "This PDF couldn't be opened. It may be damaged or password-protected."
            : "This file couldn't be read. It may be damaged.",
        action: 'pick-file',
      }
    case 'NO_CONTENT':
      return { text: 'No readable text was found in this file.', action: 'pick-file' }
    case 'TRANSCRIBE_INVALID':
      return { text: "Couldn't read the scanned pages. Try again.", action: 'retry' }
    case 'PLAN_INVALID':
      return { text: "Couldn't build a lesson from this file. Try again.", action: 'retry' }
    default:
      return { text: 'Something went wrong on our side. Try again.', action: 'retry' }
  }
}
