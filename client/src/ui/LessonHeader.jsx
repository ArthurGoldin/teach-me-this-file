import { useEffect, useRef, useState } from 'react'
import { currentStep, elapsedMinutes, progressLabel } from '../lesson/selectors.js'
import RouteLine from './RouteLine.jsx'
import { includedSummary } from './lessonFormat.js'

// Re-renders once a minute: the clock only shows whole minutes.
function useMinuteClock() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

// "What's included" and "New lesson" behind one button, so the header stays one line on a
// phone. A disclosure (button + panel), not an ARIA menu: it holds text as well as actions.
function LessonMenu({ file, onNewLesson }) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const rootRef = useRef(null)
  const buttonRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = () => {
      setOpen(false)
      setConfirming(false)
    }
    // Only while focus is in the menu, and not when something inside already handled it.
    const onKey = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (!rootRef.current?.contains(event.target)) return
      close()
      buttonRef.current?.focus()
    }
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="lesson-menu"
        aria-label="Lesson menu"
        onClick={() => {
          setOpen(!open)
          setConfirming(false)
        }}
        className="-me-2 rounded-full p-2 text-slate/70 hover:bg-surface hover:text-slate"
      >
        <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
          <circle cx="4.5" cy="10" r="1.6" fill="currentColor" />
          <circle cx="10" cy="10" r="1.6" fill="currentColor" />
          <circle cx="15.5" cy="10" r="1.6" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div
          id="lesson-menu"
          className="absolute end-0 top-full z-20 mt-1 w-72 rounded-2xl border border-slate/10 bg-white text-sm shadow-lg"
        >
          {/* App chrome is English: left to right even in an RTL lesson (the panel itself
              stays in the lesson's direction so it opens towards the page). */}
          <div dir="ltr" className="p-4">
            <h2 className="font-semibold">What&rsquo;s included</h2>
            <p className="mt-1 truncate text-slate/70" dir="auto" title={file.name}>
              {file.name}
            </p>
            <ul className="mt-2 flex flex-col gap-1 leading-relaxed">
              {includedSummary(file).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="mt-4 border-t border-surface pt-3">
              {confirming ? (
                <div className="flex flex-col gap-3">
                  <p className="leading-relaxed">
                    End this lesson? Its progress and chat are lost.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={onNewLesson}
                      className="rounded-lg bg-teal px-3.5 py-2 font-medium text-white hover:bg-teal/90"
                    >
                      End lesson
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(false)}
                      className="rounded-lg px-3.5 py-2 font-medium text-slate/80 hover:bg-surface"
                    >
                      Keep teaching
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="-mx-2 rounded-lg px-2 py-1.5 font-medium text-teal hover:bg-surface"
                >
                  New lesson
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function LessonHeader({ lesson, onNewLesson }) {
  const now = useMinuteClock()
  const { plan, progress } = lesson
  const minutes = Math.round(elapsedMinutes(lesson, now))
  const planned = plan.brief?.durationMinutes
  const complete = progress.status === 'complete'

  return (
    <header className="mx-auto w-full max-w-2xl px-4 py-3 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <h1 dir="auto" className="line-clamp-2 min-w-0 text-lg leading-snug font-semibold">
          {plan.title}
        </h1>
        <LessonMenu file={lesson.document} onNewLesson={onNewLesson} />
      </div>
      <div className="mt-3">
        <RouteLine steps={plan.steps} progress={progress} />
      </div>
      <div className="mt-2.5 flex items-baseline justify-between gap-3 text-sm">
        <p className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 font-medium text-teal">
            {complete ? 'Lesson complete' : progressLabel(lesson)}
          </span>
          {!complete && (
            <span dir="auto" className="truncate text-slate/75">
              {currentStep(lesson).title}
            </span>
          )}
        </p>
        <p dir="ltr" className="shrink-0 text-slate/65 tabular-nums">
          <span className="sr-only">Time: </span>~{minutes}
          {planned ? ` / ${planned}` : ''} min
        </p>
      </div>
    </header>
  )
}
