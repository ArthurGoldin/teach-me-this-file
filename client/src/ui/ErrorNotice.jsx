import { useEffect, useRef } from 'react'
import { messageFor } from './errorMessages.js'

const ACTION_LABELS = {
  retry: 'Try again',
  settings: 'Open settings',
  'pick-file': 'Choose another file',
  reload: 'Reload page',
}

// An error with the one action that fixes it (design §9). `onAction` gets the action name.
// `secondsLeft` (from useSecondsLeft) holds the retry back while a rate limit lasts. The alert
// text is fixed (computed from the original wait), so screen readers hear it once; the
// per-second countdown lives only on the button, outside the alert (as in MessageBubble).
// When the notice appears, focus moves to its button, so a keyboard user can act at once; the
// button is aria-disabled (not disabled) during a wait, so it can still take that focus.
export default function ErrorNotice({ error, secondsLeft: left = 0, onAction }) {
  const { text, action } = messageFor(error.code, error)
  const waiting = action === 'retry' && left > 0
  const waited = action === 'retry' && error.retryAfterSeconds > 0 && left === 0
  const buttonRef = useRef(null)

  useEffect(() => {
    buttonRef.current?.focus()
  }, [error])

  return (
    <div className="flex flex-col gap-3 rounded-xl border-s-4 border-amber bg-amber/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div role="alert" className="flex flex-col gap-1">
        <p className="font-medium">{waited ? 'You can try again now.' : text}</p>
        {error.detail && (
          <p dir="auto" className="text-sm text-slate/75">
            {error.detail}
          </p>
        )}
      </div>
      {action && (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => !waiting && onAction(action)}
          aria-disabled={waiting}
          className="shrink-0 self-start rounded-lg border border-teal px-4 py-2 font-medium text-teal hover:bg-teal hover:text-white aria-disabled:cursor-not-allowed aria-disabled:border-slate/20 aria-disabled:text-slate/50 aria-disabled:hover:bg-transparent sm:self-center"
        >
          {waiting ? `${ACTION_LABELS.retry} in ${left} s` : ACTION_LABELS[action]}
        </button>
      )}
    </div>
  )
}
