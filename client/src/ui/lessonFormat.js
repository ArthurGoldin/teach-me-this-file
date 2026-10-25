// Small pure helpers for the lesson screen: labels, text direction, and the composer guard.

// Same rule as the server (server/ai/prompts/tutor.js): a line starting with "[app]" is the
// app's channel to the model, so the server rejects a student message that has one.
const APP_LINE = /^\s*\[app\]/im

export const hasAppLine = (text) => APP_LINE.test(text)

// Primary language subtags written right to left.
const RTL_LANGUAGES = new Set(['ar', 'he', 'iw', 'fa', 'ur', 'yi', 'ps', 'dv', 'ckb', 'sd', 'ug'])

// 'rtl' or 'ltr' for a BCP-47 tag such as 'he' or 'ar-EG'; unknown or missing → 'ltr'.
export function textDirection(language) {
  const primary = String(language ?? '')
    .split('-')[0]
    .toLowerCase()
  return RTL_LANGUAGES.has(primary) ? 'rtl' : 'ltr'
}

// TXT and Markdown files are split into sections, not pages (design §5).
const unitOf = (kind) => (kind === 'text' ? 'section' : 'page')

// "3", "3, 4", "3–5, 9": three or more consecutive numbers collapse into a range.
export function formatPages(pages) {
  const sorted = [...new Set(pages)].sort((a, b) => a - b)
  const runs = []
  for (const page of sorted) {
    const last = runs.at(-1)
    if (last && page === last.to + 1) last.to = page
    else runs.push({ from: page, to: page })
  }
  const text = ({ from, to }) => {
    if (from === to) return `${from}`
    return to === from + 1 ? `${from}, ${to}` : `${from}–${to}`
  }
  return runs.map(text).join(', ')
}

// Text of the source chip under a tutor message, e.g. "Source: page 3", "Sources: pages 3, 4".
export function sourceLabel(passages, kind) {
  if (kind === 'image') return 'Source: the image'
  const pages = [...new Set(passages.map(({ page }) => page))]
  const unit = unitOf(kind)
  if (pages.length === 1) return `Source: ${unit} ${pages[0]}`
  return `Sources: ${unit}s ${formatPages(pages)}`
}

// Heading of one passage in the source panel.
export function passageHeading(passage, kind) {
  if (kind === 'image') return 'The image'
  return kind === 'text' ? `Section ${passage.page}` : `Page ${passage.page}`
}

// Where the passage text comes from, so a transcription is never mistaken for the file's text.
export function originLabel(passage, kind) {
  if (passage.origin === 'text') return 'Extracted text'
  return kind === 'image'
    ? 'AI transcription of the image'
    : `AI transcription of page ${passage.page}`
}

const SKIP_REASONS = {
  'outside-range': 'outside the chosen range',
  unreadable: 'Gemini found no legible text',
  'not-transcribed': 'not transcribed (Gemini rate limit)',
  'not-sent': "couldn't be prepared for reading",
}

// "What's included" lines for the lesson menu: the range used and every skipped group.
export function includedSummary(document) {
  const { kind, range, pageCount, skipped = [] } = document
  if (kind === 'image') return ['This lesson uses the uploaded image.']
  const unit = unitOf(kind)
  const span =
    range.from === range.to ? `${unit} ${range.from}` : `${unit}s ${range.from}–${range.to}`
  let used = `This lesson uses ${span} of ${pageCount}.`
  if (pageCount === 1) used = `This lesson uses the file's only ${unit}.`
  else if (range.from === 1 && range.to === pageCount) {
    used = `This lesson uses all ${pageCount} ${unit}s.`
  }
  const skips = skipped
    .filter(({ reason }) => reason !== 'outside-range')
    .map(({ pages, reason }) => {
      const label = pages.length === 1 ? unit : `${unit}s`
      return `Skipped ${label} ${formatPages(pages)}: ${SKIP_REASONS[reason] ?? reason}.`
    })
  return [used, ...skips]
}

// Markdown reduced to what a screen reader should say: link text instead of [text](url), no
// emphasis, heading, list, table or math markers.
export function plainText(markdown) {
  return markdown
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '')
    .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, '')
    .replace(/[*_`~$|\\]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n\s*/g, '\n')
    .trim()
}

// The host of an http(s) link, or null for anything else (relative, mailto:, javascript:…).
export function linkHost(href) {
  try {
    const url = new URL(href)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.host : null
  } catch {
    return null
  }
}

// remark-math only shows $$…$$ as a centred display formula when the dollars sit on their own
// lines; models and transcriptions often write the whole formula on one line, which would render
// inline. A line that is nothing but $$…$$ is rewritten into that block form.
export const displayMath = (markdown) =>
  markdown.replace(/^([ \t]*)\$\$([^$\n]+)\$\$[ \t]*$/gm, '$1$$$$\n$1$2\n$1$$$$')
