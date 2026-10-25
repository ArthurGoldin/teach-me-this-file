import { packUnits, splitLong } from './pages.js'

const MAX_PASSAGE_CHARS = 1200

// Turns pages into passages with stable ids (p{page}-{n}). Each line or paragraph is a unit;
// units are packed greedily up to 1,200 characters (so most passages are 600-1,200), and a unit
// longer than that is split at sentences first. Passages never cross a page boundary.
export function chunkPages(pages) {
  return pages.flatMap(({ page, text, origin }) => {
    const units = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => splitLong(line, MAX_PASSAGE_CHARS))
    return packUnits(units, MAX_PASSAGE_CHARS, '\n').map((passageText, i) => ({
      id: `p${page}-${i + 1}`,
      page,
      text: passageText,
      origin,
    }))
  })
}
