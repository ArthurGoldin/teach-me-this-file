import { useEffect, useRef, useSyncExternalStore } from 'react'
import Markdown from './Markdown.jsx'
import { originLabel, passageHeading } from './lessonFormat.js'

// Tailwind's `md` breakpoint: a side panel from here up, a bottom sheet below.
const WIDE = '(min-width: 48rem)'
const subscribe = (onChange) => {
  const query = window.matchMedia(WIDE)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
const useWide = () => useSyncExternalStore(subscribe, () => window.matchMedia(WIDE).matches)

function Passages({ passages, kind, onClose }) {
  return (
    <>
      <div className="flex items-center justify-between gap-4 border-b border-surface px-5 py-3">
        <h2 id="source-title" className="font-semibold">
          {passages.length === 1 ? 'Source' : 'Sources'}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close source"
          className="-me-2 rounded-full p-2 text-slate/70 hover:bg-surface hover:text-slate"
        >
          <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {/* English app chrome: dir="auto" keeps its full stop at the end in an RTL lesson. */}
        <p dir="auto" className="text-sm leading-relaxed text-slate/70">
          The part of your file the tutor based this message on.
        </p>
        <ul className="mt-4 flex flex-col gap-5">
          {passages.map((passage) => (
            <li key={passage.id}>
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-semibold text-teal">{passageHeading(passage, kind)}</span>
                <span className="text-slate/65">{originLabel(passage, kind)}</span>
              </p>
              <blockquote className="mt-2 border-s-[3px] border-teal-pale ps-4 leading-relaxed">
                {passage.origin === 'transcription' ? (
                  <Markdown text={passage.text} />
                ) : (
                  <p dir="auto" className="whitespace-pre-wrap">
                    {passage.text}
                  </p>
                )}
              </blockquote>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}

// Phones: a modal bottom sheet. The native <dialog> traps focus, closes on Escape and
// returns focus to the chip that opened it.
function SourceSheet({ onClose, ...props }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog.open) dialog.showModal()
  }, [])
  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="source-title"
      className="mx-0 mt-auto mb-0 flex max-h-[80dvh] w-full max-w-none flex-col rounded-t-2xl bg-white p-0 text-slate shadow-xl backdrop:bg-slate/50"
    >
      <span
        aria-hidden="true"
        className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate/15"
      />
      <Passages {...props} onClose={onClose} />
    </dialog>
  )
}

// Wide screens: a panel beside the chat, so the student can read the source and keep
// answering. Focus moves to it when it opens, Escape closes it, and focus goes back to the
// chip that opened it.
function SourceSide({ onClose, ...props }) {
  const panelRef = useRef(null)
  useEffect(() => {
    const opener = document.activeElement
    panelRef.current.focus()
    return () => {
      if (opener?.isConnected) opener.focus()
    }
  }, [])
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      aria-labelledby="source-title"
      className="flex w-[min(26rem,42vw)] shrink-0 flex-col border-s border-surface bg-white focus-visible:outline-none"
    >
      <Passages {...props} onClose={onClose} />
    </aside>
  )
}

export default function SourcePanel(props) {
  const wide = useWide()
  return wide ? <SourceSide {...props} /> : <SourceSheet {...props} />
}
