import { useEffect, useState } from 'react'
import { messageFor } from './errorMessages.js'

const ACTION_LABELS = {
  retry: 'Try again',
  settings: 'Open settings',
  'pick-file': 'Choose another file',
}

// Seconds left before a rate-limited request may be retried. `error.at` is when it failed.
function useSecondsLeft(error) {
  const deadline = error.at + (error.retryAfterSeconds ?? 0) * 1000
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (deadline <= Date.now()) return undefined
    const timer = setInterval(() => {
      const time = Date.now()
      setNow(time)
      if (time >= deadline) clearInterval(timer)
    }, 1000)
    return () => clearInterval(timer)
  }, [deadline])
  return Math.max(0, Math.ceil((deadline - now) / 1000))
}

// An error with the one action that fixes it (design §9). `onAction` gets the action name.
export default function ErrorNotice({ error, onAction }) {
  const left = useSecondsLeft(error)
  const { text, action } = messageFor(error.code, { ...error, retryAfterSeconds: left })
  const waiting = action === 'retry' && left > 0

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl border-s-4 border-amber bg-amber/10 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-col gap-1">
        <p className="font-medium">{text}</p>
        {error.detail && (
          <p dir="auto" className="text-sm text-slate/75">
            {error.detail}
          </p>
        )}
      </div>
      {action && (
        <button
          type="button"
          onClick={() => onAction(action)}
          disabled={waiting}
          className="shrink-0 self-start rounded-lg border border-teal px-4 py-2 font-medium text-teal hover:bg-teal hover:text-white disabled:cursor-not-allowed disabled:border-slate/20 disabled:text-slate/50 disabled:hover:bg-transparent sm:self-center"
        >
          {waiting ? `${ACTION_LABELS.retry} in ${left} s` : ACTION_LABELS[action]}
        </button>
      )}
    </div>
  )
}
