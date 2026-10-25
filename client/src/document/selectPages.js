import { applyRange } from './budget.js'

// The pages in the chosen range: text pages go into the lesson as they are, scanned pages
// (and images) must be transcribed first. Pages outside the range are recorded as skipped.
export function selectPages(pages, range) {
  const { inRange, skipped } = applyRange(pages, range)
  return {
    textPages: inRange
      .filter((p) => !p.isScan)
      .map(({ page, text }) => ({ page, text, origin: 'text' })),
    scanPages: inRange.filter((p) => p.isScan).map((p) => p.page),
    skipped,
  }
}

const byPage = (a, b) => a.page - b.page
const skipGroup = (pages, reason) =>
  pages.length > 0 ? [{ pages: [...pages].sort((a, b) => a - b), reason }] : []

// The lesson's pages once transcription is over: text pages and readable transcriptions in page
// order. Unreadable pages and pages left out after a rate limit are recorded as skipped.
export function combinePages({ textPages, transcriptions, notTranscribed }) {
  const transcribed = transcriptions
    .filter((t) => t.readable)
    .map(({ page, markdown }) => ({ page, text: markdown, origin: 'transcription' }))
  const unreadable = transcriptions.filter((t) => !t.readable).map((t) => t.page)
  return {
    pages: [...textPages, ...transcribed].sort(byPage),
    skipped: [
      ...skipGroup(unreadable, 'unreadable'),
      ...skipGroup(notTranscribed, 'not-transcribed'),
    ],
  }
}
