// Keeps the lesson across a page reload in the same tab (sessionStorage, never localStorage).
// Storage can be missing, blocked or full, so every access is guarded and failure is reported.

export const LESSON_KEY = 'tmtf.lesson'
// Bump when the LessonState shape changes: older saves are then ignored.
// 2: plan steps have keyPoints (D22); a version-1 lesson cannot be continued.
const VERSION = 2

// `storage` is injectable for tests. Reading the global inside `try` because merely accessing
// sessionStorage throws when the browser blocks site data.
export function saveLesson(state, storage) {
  try {
    const target = storage ?? globalThis.sessionStorage
    // No lesson (after "New lesson"): remove the entry instead of saving null.
    if (state === null) target.removeItem(LESSON_KEY)
    else target.setItem(LESSON_KEY, JSON.stringify({ version: VERSION, state }))
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

export function loadLesson(storage) {
  try {
    const source = storage ?? globalThis.sessionStorage
    const saved = JSON.parse(source.getItem(LESSON_KEY))
    if (saved?.version !== VERSION) return null
    // A turn that was streaming when the page closed can never finish: show it as stopped.
    const messages = saved.state.messages.map((message) =>
      message.state === 'streaming' ? { ...message, state: 'stopped' } : message,
    )
    return { ...saved.state, messages }
  } catch {
    return null
  }
}
