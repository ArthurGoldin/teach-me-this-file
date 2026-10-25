import { useState } from 'react'
import { hasAppLine } from './lessonFormat.js'

const MAX_MESSAGE = 2000

// The student's reply box. Enter sends, Shift+Enter adds a line. While the tutor answers,
// Stop takes the place of Send (one turn in flight, design §7.3).
export default function Composer({ streaming, disabled, onSend, onStop }) {
  const [draft, setDraft] = useState('')
  const blocked = hasAppLine(draft)
  const canSend = !disabled && !streaming && draft.trim() !== '' && !blocked

  function submit() {
    if (!canSend) return
    onSend(draft.trim())
    setDraft('')
  }

  function handleKeyDown(event) {
    // isComposing: Enter that confirms an IME candidate (Japanese, Chinese…) must not send.
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    submit()
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className="mx-auto w-full max-w-2xl px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6"
    >
      <div className="flex items-end gap-2 rounded-2xl border border-slate/20 bg-white p-1.5 ps-4 focus-within:border-teal">
        <label htmlFor="student-message" className="sr-only">
          Your answer
        </label>
        <textarea
          id="student-message"
          dir="auto"
          rows={1}
          maxLength={MAX_MESSAGE}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          enterKeyHint="send"
          placeholder={disabled ? 'Wait for the tutor…' : 'Type your answer'}
          aria-invalid={blocked}
          aria-describedby={blocked ? 'student-message-hint' : undefined}
          className="field-sizing-content max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2 leading-relaxed placeholder:text-slate/45 focus-visible:outline-none disabled:cursor-not-allowed"
        />
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-slate px-4 font-medium text-white hover:bg-slate/85"
          >
            <span aria-hidden="true" className="size-2.5 rounded-[2px] bg-white" />
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            className="h-10 shrink-0 rounded-xl bg-teal px-4 font-medium text-white hover:bg-teal/90 disabled:cursor-not-allowed disabled:bg-slate/10 disabled:text-slate/45"
          >
            Send
          </button>
        )}
      </div>
      {blocked && (
        <p id="student-message-hint" dir="auto" className="mt-1.5 ps-1 text-sm text-slate/75">
          Lines can&rsquo;t start with [app]: the app uses that for its own notes.
        </p>
      )}
    </form>
  )
}
