import { useEffect, useRef, useState } from 'react'
import { createPlan, transcribePages } from '../api/client.js'
import { fitsInRequest, makeBatches } from '../document/batches.js'
import { defaultRange } from '../document/budget.js'
import { DocumentError } from '../document/errors.js'
import { buildLessonDocument } from '../document/lessonDocument.js'
import { readFile } from '../document/readFile.js'
import { combinePages, selectPages } from '../document/selectPages.js'

const extensionOf = (name) => (name.includes('.') ? name.split('.').pop().toUpperCase() : '')

// The longest rate-limit wait the builder sits through on its own (design §6.1).
const MAX_AUTO_WAIT_SECONDS = 60

function wait(seconds, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, seconds * 1000)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

const revoke = (entries) => entries.forEach((t) => t.objectUrl && URL.revokeObjectURL(t.objectUrl))

// Drives the create-lesson flow (design §6.1): read the file, choose a page range, transcribe
// scanned pages, plan the lesson. Holds only setup state; the finished lesson goes to the lesson
// reducer via App, with the page images of transcribed pages (in memory only).
export function useLessonBuilder() {
  const [stage, setStage] = useState('idle')
  const [progress, setProgress] = useState(null)
  const [raw, setRaw] = useState(null)
  const [range, setRange] = useState(null)
  const [error, setError] = useState(null)
  // While waiting out a rate limit: { retryAfterSeconds, at } for the countdown.
  const [rateWait, setRateWait] = useState(null)
  const controllerRef = useRef(null)
  // The open document (a parsed PDF holds memory and a worker until destroyed).
  const rawRef = useRef(null)
  // Transcriptions of this document by page: { page, readable, markdown, objectUrl? }. Kept
  // across Retry, so a page is sent to Gemini once.
  const transcriptsRef = useRef(new Map())

  function replaceRaw(doc) {
    rawRef.current?.destroy()
    rawRef.current = doc
    revoke([...transcriptsRef.current.values()])
    transcriptsRef.current = new Map()
    setRaw(doc)
  }

  // Leaving the setup screen cancels whatever is still running and frees the document.
  useEffect(
    () => () => {
      controllerRef.current?.abort()
      rawRef.current?.destroy()
      revoke([...transcriptsRef.current.values()])
    },
    [],
  )

  // One task at a time: starting a new one aborts the previous one.
  function startTask() {
    controllerRef.current?.abort()
    controllerRef.current = new AbortController()
    setError(null)
    setProgress(null)
    setRateWait(null)
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
    replaceRaw(null)
    setRange(null)
    setStage('reading')
    try {
      const doc = await readFile(file, { onProgress: setProgress, signal })
      if (signal.aborted) {
        doc.destroy()
        return
      }
      const docRange = defaultRange(doc.pages)
      replaceRaw(doc)
      setRange(docRange)
      setStage(readyStage(doc, docRange))
    } catch (err) {
      // readFile only throws DocumentErrors; anything else is still a problem with this file,
      // not with the server.
      const code = err instanceof DocumentError ? err.code : 'CORRUPT_FILE'
      fail({ code }, signal, { fileType: extensionOf(file.name), reloadNeeded: err.reloadNeeded })
    } finally {
      if (!signal.aborted) setProgress(null)
    }
  }

  // Renders the pages to JPEG. A page that cannot be rendered, or whose image is too large for
  // any request, is unreadable: it is recorded at once and never sent.
  async function renderPages(pages, signal) {
    const items = []
    for (const page of pages) {
      if (signal.aborted) break
      try {
        const { base64, objectUrl } = await rawRef.current.renderPageJpeg(page)
        const item = { page, base64, objectUrl }
        if (fitsInRequest(item)) items.push(item)
        else {
          URL.revokeObjectURL(objectUrl)
          transcriptsRef.current.set(page, { page, readable: false, markdown: '' })
        }
      } catch {
        transcriptsRef.current.set(page, { page, readable: false, markdown: '' })
      }
    }
    return items
  }

  async function sendBatch(batch, signal) {
    const body = batch.map(({ page, base64 }) => ({ page, imageBase64: base64 }))
    try {
      return await transcribePages(body, { signal })
    } catch (err) {
      const seconds = err.retryAfterSeconds
      if (err.code !== 'RATE_LIMITED' || !(seconds <= MAX_AUTO_WAIT_SECONDS)) throw err
      // One automatic wait, with a countdown, then the same batch once more.
      setRateWait({ retryAfterSeconds: seconds, at: Date.now() })
      setStage('waiting')
      await wait(seconds, signal)
      setRateWait(null)
      setStage('transcribing')
      return transcribePages(body, { signal })
    }
  }

  // Transcribes the scanned pages that have no transcription yet, batch by batch. After a rate
  // limit the pages still missing are attached to the error ("Continue without pages N–M").
  async function transcribe(scanPages, signal) {
    const transcripts = transcriptsRef.current
    const missing = () => scanPages.filter((page) => !transcripts.has(page))
    if (missing().length === 0) return
    setStage('transcribing')
    const report = () =>
      setProgress({ done: scanPages.length - missing().length, total: scanPages.length })
    report()
    const items = await renderPages(missing(), signal)
    try {
      for (const batch of makeBatches(items)) {
        const { pages } = await sendBatch(batch, signal)
        for (const result of pages) {
          const { objectUrl } = batch.find((item) => item.page === result.page)
          if (!result.readable) URL.revokeObjectURL(objectUrl)
          transcripts.set(result.page, { ...result, objectUrl: result.readable ? objectUrl : null })
        }
        report()
      }
    } catch (err) {
      // Images of pages not transcribed are rendered again on Retry.
      revoke(items.filter((item) => !transcripts.has(item.page)))
      // Only a rate limit offers to go on without them; other errors stop the build.
      if (err.code === 'RATE_LIMITED') err.notTranscribed = missing()
      throw err
    }
  }

  // `skipUntranscribed`: after a rate limit, build without the pages not transcribed yet.
  async function build(teacherPrompt, { skipUntranscribed = false } = {}) {
    const signal = startTask()
    try {
      const { textPages, scanPages, skipped } = selectPages(raw.pages, range)
      if (!skipUntranscribed) await transcribe(scanPages, signal)
      if (signal.aborted) return null
      const done = scanPages.filter((p) => transcriptsRef.current.has(p))
      const transcriptions = done.map((p) => transcriptsRef.current.get(p))
      const combined = combinePages({
        textPages,
        transcriptions,
        notTranscribed: scanPages.filter((p) => !transcriptsRef.current.has(p)),
      })
      const { name, kind, pageCount } = raw
      const document = buildLessonDocument({
        name,
        kind,
        pageCount,
        range,
        pages: combined.pages,
        skipped: [...skipped, ...combined.skipped],
      })
      setProgress(null)
      setStage('planning')
      const result = await createPlan(
        { teacherPrompt, document: { name, passages: document.passages } },
        { signal },
      )
      if (signal.aborted) return null
      if (!result.ok) {
        fail({ code: 'NO_CONTENT' }, signal, { detail: result.reason })
        return null
      }
      // Hand the page images of this lesson's transcribed pages over to App (they are not
      // persisted); the builder frees everything else when the setup screen unmounts.
      const pageImages = {}
      for (const { page, objectUrl } of transcriptions) {
        if (objectUrl) {
          pageImages[page] = objectUrl
          transcriptsRef.current.delete(page)
        }
      }
      return { document, plan: result.plan, pageImages }
    } catch (err) {
      setRateWait(null)
      fail(err, signal, { notTranscribed: err.notTranscribed })
      return null
    }
  }

  function cancel() {
    controllerRef.current?.abort()
    setProgress(null)
    setRateWait(null)
    setStage(readyStage(raw, range))
  }

  return {
    stage,
    progress,
    rateWait,
    raw,
    range,
    setRange,
    error,
    readSelectedFile,
    build,
    cancel,
  }
}
