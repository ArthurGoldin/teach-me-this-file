import { useEffect, useRef, useState } from 'react'
import { createPlan } from '../api/client.js'
import { applyRange, defaultRange } from '../document/budget.js'
import { buildLessonDocument } from '../document/lessonDocument.js'
import { readFile } from '../document/readFile.js'

const extensionOf = (name) => (name.includes('.') ? name.split('.').pop().toUpperCase() : '')

// The pages that go into the lesson, and what was left out.
// Scanned pages are not transcribed yet: they are skipped with reason 'scan-limit'.
function selectPages(raw, range) {
  const { inRange, skipped } = applyRange(raw.pages, range)
  const scanned = inRange.filter((p) => p.isScan).map((p) => p.page)
  const pages = inRange
    .filter((p) => !p.isScan)
    .map(({ page, text }) => ({ page, text, origin: 'text' }))
  return {
    pages,
    skipped: scanned.length > 0 ? [...skipped, { pages: scanned, reason: 'scan-limit' }] : skipped,
  }
}

// Drives the create-lesson flow (design §6.1): read the file, choose a page range, plan the
// lesson. Holds only setup state; the finished lesson goes to the lesson reducer via App.
export function useLessonBuilder() {
  const [stage, setStage] = useState('idle')
  const [progress, setProgress] = useState(null)
  const [raw, setRaw] = useState(null)
  const [range, setRange] = useState(null)
  const [error, setError] = useState(null)
  const controllerRef = useRef(null)

  // Leaving the setup screen cancels whatever is still running.
  useEffect(() => () => controllerRef.current?.abort(), [])

  // One task at a time: starting a new one aborts the previous one.
  function startTask() {
    controllerRef.current?.abort()
    controllerRef.current = new AbortController()
    setError(null)
    setProgress(null)
    return controllerRef.current.signal
  }

  const readyStage = (doc, docRange) => (doc && docRange.needsPicker ? 'choose-range' : 'idle')

  function fail(err, signal, details) {
    if (signal.aborted) return
    const { code = 'INTERNAL', retryAfterSeconds } = err
    setError({ code, retryAfterSeconds, at: Date.now(), ...details })
    setStage('error')
  }

  async function readSelectedFile(file) {
    const signal = startTask()
    setRaw(null)
    setRange(null)
    setStage('reading')
    try {
      const doc = await readFile(file, { onProgress: setProgress, signal })
      if (signal.aborted) return
      const docRange = defaultRange(doc.pages)
      setRaw(doc)
      setRange(docRange)
      setStage(readyStage(doc, docRange))
    } catch (err) {
      fail(err, signal, { fileType: extensionOf(file.name) })
    } finally {
      if (!signal.aborted) setProgress(null)
    }
  }

  async function build(teacherPrompt) {
    const signal = startTask()
    try {
      const { pages, skipped } = selectPages(raw, range)
      const { name, kind, pageCount } = raw
      const document = buildLessonDocument({ name, kind, pageCount, range, pages, skipped })
      setStage('planning')
      const result = await createPlan(
        { teacherPrompt, document: { name, passages: document.passages } },
        { signal },
      )
      if (!result.ok) {
        fail({ code: 'NO_CONTENT' }, signal, { detail: result.reason })
        return null
      }
      setStage(readyStage(raw, range))
      return { document, plan: result.plan }
    } catch (err) {
      fail(err, signal)
      return null
    }
  }

  function cancel() {
    controllerRef.current?.abort()
    setProgress(null)
    setStage(readyStage(raw, range))
  }

  return { stage, progress, raw, range, setRange, error, readSelectedFile, build, cancel }
}
