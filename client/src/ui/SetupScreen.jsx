import { useEffect, useRef, useState } from 'react'
import { checkRange } from '../document/budget.js'
import BuildProgress from './BuildProgress.jsx'
import ErrorNotice from './ErrorNotice.jsx'
import FilePicker from './FilePicker.jsx'
import RangePicker from './RangePicker.jsx'
import { messageFor } from './errorMessages.js'
import { formatPages } from './lessonFormat.js'
import { useLessonBuilder } from './useLessonBuilder.js'
import { useSecondsLeft } from './useSecondsLeft.js'

const EXAMPLE_PROMPT =
  'Teach this to 7th graders, in French. Be Socratic. Keep it under 15 minutes.'
const MAX_PROMPT = 1000
const KEY_ERRORS = ['NO_KEY', 'INVALID_KEY']

// What screen readers hear when the stage changes (once per stage, not per page).
const STAGE_ANNOUNCEMENTS = {
  reading: 'Reading the file',
  transcribing: 'Reading scanned pages',
  waiting: "Gemini's free-tier limit was reached. Waiting before trying again.",
  planning: 'Planning the lesson',
  'choose-range': 'File read. Choose the part to teach.',
}

function fileSummary(raw) {
  const unit = raw.kind === 'text' ? 'section' : 'page'
  const count = `${raw.pageCount} ${unit}${raw.pageCount === 1 ? '' : 's'}`
  if (raw.kind === 'image') return 'Image'
  const scanned = raw.pages.filter((p) => p.isScan).length
  return scanned > 0 ? `${count}, ${scanned} scanned` : count
}

// One stop on the setup route. `state` colours the marker: done (teal), current (amber, "you
// are here"), todo (pale). The line to the next stop is drawn unless it is the last one.
function Stop({ number, title, state, last, children }) {
  const marker = {
    done: 'border-teal bg-teal text-white',
    current: 'border-amber bg-amber text-slate',
    todo: 'border-teal-pale bg-white text-slate/60',
  }[state]
  return (
    <li className="relative ps-11 pb-9 last:pb-0">
      {!last && (
        <span
          aria-hidden="true"
          className="absolute start-[13px] top-8 bottom-1 w-0.5 bg-teal-pale"
        />
      )}
      <span
        aria-hidden="true"
        className={`absolute start-0 top-0 flex size-7 items-center justify-center rounded-full border-2 text-sm font-semibold ${marker}`}
      >
        {state === 'done' ? (
          <svg viewBox="0 0 16 16" className="size-3.5">
            <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        ) : (
          number
        )}
      </span>
      <h2 className="mb-3 text-lg leading-7 font-semibold">{title}</h2>
      {children}
    </li>
  )
}

export default function SetupScreen({ hasKey, onOpenSettings, onLessonReady }) {
  const builder = useLessonBuilder()
  const { stage, raw, range, error } = builder
  const [prompt, setPrompt] = useState('')
  const fileInputRef = useRef(null)

  // Key problems open the settings dialog, which shows the reason (so no inline notice).
  useEffect(() => {
    if (KEY_ERRORS.includes(error?.code)) onOpenSettings(messageFor(error.code).text)
  }, [error, onOpenSettings])

  const building = ['transcribing', 'waiting', 'planning'].includes(stage)
  const busy = stage === 'reading' || building
  const waitSeconds = useSecondsLeft(error)
  const rateWaitSeconds = useSecondsLeft(builder.rateWait)
  const rangeCheck = raw && range ? checkRange(raw.pages, range) : null
  const canBuild = rangeCheck?.ok && hasKey && !busy && waitSeconds === 0
  const shownError = stage === 'error' && !KEY_ERRORS.includes(error.code) ? error : null
  const fileError = shownError && !raw
  const buildError = shownError && raw
  let announcement = STAGE_ANNOUNCEMENTS[stage] ?? ''
  if (stage === 'idle' && raw) announcement = 'File read.'

  // Exactly one amber "you are here" stop: the first one that is not done.
  const stopState = (done, current) => (done ? 'done' : current ? 'current' : 'todo')
  const promptDone = prompt.trim() !== ''

  async function handleBuild(options) {
    const teacherPrompt = prompt.trim()
    const result = await builder.build(teacherPrompt, options)
    if (result) onLessonReady({ ...result, teacherPrompt })
  }

  // The build stage's progress line: page images being transcribed, a rate-limit wait, or the
  // plan call.
  function buildLabel() {
    if (stage === 'waiting') {
      return `Gemini's free-tier limit was reached. Trying again in ${rateWaitSeconds} s.`
    }
    if (stage === 'planning') return 'Planning the lesson…'
    if (raw.kind === 'image') return 'Gemini is transcribing the image…'
    const { done = 0, total = 0 } = builder.progress ?? {}
    return done === total
      ? 'Reading scanned pages…'
      : `Reading scanned pages: ${done} of ${total} done`
  }
  const notTranscribed = buildError ? (error.notTranscribed ?? []) : []

  function handleAction(action) {
    // Only a failed build offers retry: read failures are about the file (or need a reload).
    if (action === 'retry') handleBuild()
    if (action === 'reload') window.location.reload()
    if (action === 'settings') onOpenSettings(null)
    if (action === 'pick-file') fileInputRef.current?.click()
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <h1 className="text-3xl leading-tight font-semibold text-balance sm:text-4xl">
        Turn a file into a lesson
      </h1>
      <p className="mt-3 max-w-prose text-lg leading-relaxed text-slate/75">
        Pick the material, say how it should be taught, and a tutor teaches it to your student one
        step at a time, checking understanding as it goes.
      </p>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <ol className="mt-10">
        <Stop number={1} title="Your file" state={stopState(Boolean(raw), !raw)}>
          <div className="flex flex-col gap-3">
            <FilePicker
              inputRef={fileInputRef}
              fileName={raw?.name}
              summary={raw && fileSummary(raw)}
              disabled={busy}
              onFile={builder.readSelectedFile}
            />
            {stage === 'reading' && (
              <BuildProgress
                label={
                  builder.progress
                    ? `Reading page ${builder.progress.done + 1} of ${builder.progress.total}`
                    : 'Reading file…'
                }
                progress={builder.progress}
                onCancel={builder.cancel}
              />
            )}
            {fileError && <ErrorNotice error={error} onAction={handleAction} />}
            {range?.needsPicker && (
              <RangePicker
                raw={raw}
                range={range}
                onChange={builder.setRange}
                unit={raw.kind === 'text' ? 'section' : 'page'}
              />
            )}
            {rangeCheck?.inBounds && rangeCheck.scanPages > 0 && (
              <p className="rounded-xl bg-surface px-4 py-3 text-sm leading-relaxed">
                {rangeCheck.scanPages === 1 && raw.kind === 'image'
                  ? 'Gemini will transcribe the image before planning the lesson.'
                  : `${rangeCheck.scanPages} scanned page${rangeCheck.scanPages === 1 ? '' : 's'} will be transcribed by Gemini before planning the lesson.`}
              </p>
            )}
          </div>
        </Stop>

        <Stop
          number={2}
          title="How to teach it"
          state={stopState(Boolean(raw) && promptDone, Boolean(raw) && !promptDone)}
        >
          <label htmlFor="teacher-prompt" className="sr-only">
            Teacher prompt
          </label>
          <textarea
            id="teacher-prompt"
            dir="auto"
            rows={4}
            maxLength={MAX_PROMPT}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={EXAMPLE_PROMPT}
            aria-describedby="teacher-prompt-hint"
            className="w-full resize-y rounded-xl border border-slate/25 bg-white px-4 py-3 text-base leading-relaxed placeholder:text-slate/45 focus-visible:border-teal focus-visible:outline-offset-0"
          />
          <div
            id="teacher-prompt-hint"
            className="mt-1.5 flex justify-between gap-4 text-sm text-slate/65"
          >
            <span>Audience, language, style, length. Optional.</span>
            <span className="shrink-0 tabular-nums">
              {prompt.length} / {MAX_PROMPT}
            </span>
          </div>
        </Stop>

        <Stop
          number={3}
          title="Build the lesson"
          state={raw && promptDone ? 'current' : 'todo'}
          last
        >
          <div className="flex flex-col gap-3">
            {building ? (
              <BuildProgress
                label={buildLabel()}
                progress={stage === 'transcribing' ? builder.progress : null}
                onCancel={builder.cancel}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <button
                  type="button"
                  onClick={handleBuild}
                  disabled={!canBuild}
                  className="rounded-xl bg-teal px-6 py-3 text-base font-medium text-white hover:bg-teal/90 disabled:cursor-not-allowed disabled:bg-slate/10 disabled:text-slate/45"
                >
                  Build lesson
                </button>
                {!hasKey ? (
                  <p className="text-sm text-slate/70">
                    Needs a Gemini API key.{' '}
                    <button
                      type="button"
                      onClick={() => onOpenSettings(null)}
                      className="font-medium text-teal underline underline-offset-2"
                    >
                      Add API key
                    </button>
                  </p>
                ) : (
                  !raw && <p className="text-sm text-slate/70">Choose a file first.</p>
                )}
              </div>
            )}
            {buildError && (
              <ErrorNotice error={error} secondsLeft={waitSeconds} onAction={handleAction} />
            )}
            {notTranscribed.length > 0 && (
              <button
                type="button"
                onClick={() => handleBuild({ skipUntranscribed: true })}
                className="self-start rounded-lg px-4 py-2 font-medium text-teal underline underline-offset-2 hover:bg-surface"
              >
                Continue without {notTranscribed.length === 1 ? 'page' : 'pages'}{' '}
                {formatPages(notTranscribed)}
              </button>
            )}
          </div>
        </Stop>
      </ol>
    </main>
  )
}
