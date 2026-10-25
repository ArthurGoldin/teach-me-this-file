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

// The original page next to its AI transcription, so the student can check it. The image is
// held in memory only (App): after a reload it is gone and the panel says so.
function PageImage({ url, page, kind }) {
  if (!url) {
    return (
      <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-sm text-slate/70">
        Page image not available after reload.
      </p>
    )
  }
  const label = kind === 'image' ? 'The uploaded image' : `Page ${page} of the file`
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block overflow-hidden rounded-lg border border-slate/15 hover:border-teal"
    >
      <img src={url} alt={label} className="max-h-72 w-full bg-surface object-contain" />
      <span className="sr-only"> (opens full size in a new tab)</span>
    </a>
  )
}

function Passages({ passages, kind, pageImages = {}, onClose }) {
  // One image per page, above the first passage that comes from it.
  const firstOfPage = new Set()
  const shownPages = new Set()
  for (const passage of passages) {
    if (passage.origin === 'transcription' && !shownPages.has(passage.page)) {
      shownPages.add(passage.page)
      firstOfPage.add(passage.id)
    }
  }

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
              {firstOfPage.has(passage.id) && (
                <PageImage url={pageImages[passage.page]} page={passage.page} kind={kind} />
              )}
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
// returns focus to the chip that opened it. Every way out (Close, Escape, a tap on the
// backdrop) goes through dialog.close(), so that focus return happens before React unmounts it.
function SourceSheet({ onClose, ...props }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog.open) dialog.showModal()
  }, [])
  const close = () => dialogRef.current.close()
  return (
    // The click handler only catches taps on the backdrop (the dialog element itself, outside
    // its content); keyboard users close with Escape or the Close button.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) close()
      }}
      aria-labelledby="source-title"
      className="mx-0 mt-auto mb-0 flex max-h-[80dvh] w-full max-w-none flex-col rounded-t-2xl bg-white p-0 text-slate shadow-xl backdrop:bg-slate/50"
    >
      <span
        aria-hidden="true"
        className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate/15"
      />
      <Passages {...props} onClose={close} />
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
    // Only while focus is in the panel, and not when something inside already handled it.
    const onKey = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (panelRef.current?.contains(event.target)) onClose()
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
