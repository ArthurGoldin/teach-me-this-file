export const PLAN_TOKEN_BUDGET = 100_000
export const MAX_SCAN_PAGES = 20
export const SCAN_PAGE_TOKENS = 800 // estimate for a page once it has been transcribed

export function estimateTokens(text) {
  return Math.ceil(text.length / 3)
}

const pageTokens = (page) => (page.isScan ? SCAN_PAGE_TOKENS : estimateTokens(page.text))

// Longest run of pages from the start that fits the token and scan-page limits (at least 1 page).
export function defaultRange(pages) {
  let tokens = 0
  let scanPages = 0
  let count = 0
  for (const page of pages) {
    tokens += pageTokens(page)
    scanPages += page.isScan ? 1 : 0
    if (count > 0 && (tokens > PLAN_TOKEN_BUDGET || scanPages > MAX_SCAN_PAGES)) break
    count += 1
  }
  return {
    from: pages[0].page,
    to: pages[count - 1].page,
    needsPicker: count < pages.length,
  }
}

const inRangeOf = (pages, { from, to }) => pages.filter((p) => p.page >= from && p.page <= to)

export function applyRange(pages, range) {
  const inRange = inRangeOf(pages, range)
  const outside = pages.filter((p) => !inRange.includes(p)).map((p) => p.page)
  return {
    inRange,
    skipped: outside.length > 0 ? [{ pages: outside, reason: 'outside-range' }] : [],
  }
}

// `inBounds`: whole numbers with 1 <= from <= to <= last page. `ok`: in bounds and within the
// token and scan-page limits. The single check behind the range picker and the Build button.
export function checkRange(pages, range) {
  const { from, to } = range
  const last = pages.at(-1)?.page ?? 0
  const inBounds =
    Number.isInteger(from) && Number.isInteger(to) && 1 <= from && from <= to && to <= last
  const selected = inBounds ? inRangeOf(pages, range) : []
  const tokens = selected.reduce((sum, p) => sum + pageTokens(p), 0)
  const scanPages = selected.filter((p) => p.isScan).length
  const ok = inBounds && tokens <= PLAN_TOKEN_BUDGET && scanPages <= MAX_SCAN_PAGES
  return { tokens, scanPages, inBounds, ok }
}
