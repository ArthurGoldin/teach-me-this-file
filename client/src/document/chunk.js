import { packUnits, splitLong } from './pages.js'

const MAX_PASSAGE_CHARS = 1200

// Turns pages into passages with stable ids (p{page}-{n}). Text-layer pages are cut into lines;
// a transcription is Markdown, so it is cut into blocks (paragraphs, tables, formulas) at blank
// lines and joined back the same way, which keeps its formatting. Units are packed greedily up to
// 1,200 characters (so most passages are 600-1,200), and a unit longer than that is split at
// sentences first. Passages never cross a page boundary.
export function chunkPages(pages) {
  return pages.flatMap(({ page, text, origin }) => {
    const separator = origin === 'transcription' ? '\n\n' : '\n'
    const units = text
      .split(origin === 'transcription' ? /\n\s*\n/ : '\n')
      .map((unit) => unit.trim())
      .filter(Boolean)
      .flatMap((unit) => splitLong(unit, MAX_PASSAGE_CHARS))
    return packUnits(units, MAX_PASSAGE_CHARS, separator).map((passageText, i) => ({
      id: `p${page}-${i + 1}`,
      page,
      text: passageText,
      origin,
    }))
  })
}
