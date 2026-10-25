import Markdown from './Markdown.jsx'
import { messageFor } from './errorMessages.js'
import { sourceLabel } from './lessonFormat.js'
import { useSecondsLeft } from './useSecondsLeft.js'

function TypingDots() {
  return (
    <span className="flex h-6 items-center gap-1" role="img" aria-label="Tutor is typing">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-teal"
          style={{ animation: `typing 1.2s ${i * 0.15}s infinite ease-in-out` }}
        />
      ))}
    </span>
  )
}

const AUTO_MODES = ['introduce', 'wrap-up']

const ACTION_LABELS = { retry: 'Try again', settings: 'Open settings' }

// Why a turn failed, with the one action that fixes it. Only the latest message offers it:
// an older failure has already been followed by something else (e.g. its retry).
function FailedNote({ error, canAct, onRetry, onOpenSettings }) {
  const left = useSecondsLeft(error)
  const { text, action } = canAct
    ? messageFor(error.code, { ...error, retryAfterSeconds: left })
    : { text: "This answer didn't arrive.", action: null }
  const label = ACTION_LABELS[action]
  const waiting = action === 'retry' && left > 0
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm" role="alert">
      <p dir="auto" className="text-slate/80">
        {text}
      </p>
      {canAct && label && (
        <button
          type="button"
          disabled={waiting}
          onClick={action === 'retry' ? onRetry : onOpenSettings}
          className="rounded-lg border border-teal px-3 py-1.5 font-medium text-teal hover:bg-teal hover:text-white disabled:cursor-not-allowed disabled:border-slate/20 disabled:text-slate/50 disabled:hover:bg-transparent"
        >
          {waiting ? `Try again in ${left} s` : label}
        </button>
      )}
    </div>
  )
}

function SourceLine({ passages, kind, active, onShow }) {
  if (passages.length === 0) {
    return <p className="mt-1.5 ps-1 text-xs text-slate/55">No source for this message</p>
  }
  return (
    <button
      type="button"
      onClick={onShow}
      aria-pressed={active}
      className={`mt-1.5 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        active ? 'bg-teal text-white' : 'text-teal hover:bg-surface'
      }`}
    >
      <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
        <path
          d="M4 2h5l3 3v9H4z M9 2v3h3 M6 8.5h4 M6 11h4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
      {sourceLabel(passages, kind)}
    </button>
  )
}

export default function MessageBubble({
  message,
  passages,
  kind,
  isLast,
  sourceOpen,
  onShowSource,
  onRetry,
  onOpenSettings,
}) {
  if (message.role === 'student') {
    return (
      <li className="flex justify-end">
        <p
          dir="auto"
          className="max-w-[85%] rounded-2xl rounded-ee-md bg-teal px-4 py-2.5 leading-relaxed break-words whitespace-pre-wrap text-white"
        >
          {message.text}
        </p>
      </li>
    )
  }

  const { state, text } = message
  const waiting = state === 'streaming' && text === ''
  return (
    <li className="flex flex-col items-start">
      <div className="max-w-[92%] rounded-2xl rounded-ss-md bg-surface px-4 py-2.5 leading-relaxed break-words sm:max-w-[85%]">
        {waiting && <TypingDots />}
        {text !== '' && <Markdown text={text} />}
        {text === '' && state === 'stopped' && (
          <p dir="auto" className="text-slate/60 italic">
            Stopped before the answer started.
          </p>
        )}
        {state === 'failed' && text !== '' && <hr className="my-2 border-slate/10" />}
        {state === 'failed' && (
          <FailedNote
            error={message.error}
            canAct={isLast}
            onRetry={() => onRetry(message.id)}
            onOpenSettings={onOpenSettings}
          />
        )}
      </div>
      {state === 'stopped' && text !== '' && (
        <p className="mt-1.5 ps-1 text-xs text-slate/55">Stopped</p>
      )}
      {/* A stopped introduction or wrap-up leaves the student without a question (and a
          stopped wrap-up would never end the lesson), so it can be asked for again. */}
      {state === 'stopped' && isLast && AUTO_MODES.includes(message.mode) && (
        <button
          type="button"
          onClick={() => onRetry(message.id)}
          className="mt-1.5 rounded-lg border border-teal px-3 py-1.5 text-sm font-medium text-teal hover:bg-teal hover:text-white"
        >
          Continue the lesson
        </button>
      )}
      {state === 'done' && (
        <SourceLine
          passages={passages}
          kind={kind}
          active={sourceOpen}
          onShow={() => onShowSource(message.id)}
        />
      )}
    </li>
  )
}
