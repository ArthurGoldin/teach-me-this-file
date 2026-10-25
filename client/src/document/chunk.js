import { packUnits, splitLong } from './pages.js'

const MAX_PASSAGE_CHARS = 1200

const isTable = (block) => block.split('\n').every((line) => line.trimStart().startsWith('|'))

// A Markdown table too long for one passage is cut between rows, and every piece starts with the
// table's header and separator rows, so each passage is still a readable table.
function splitTable(block, max) {
  const [head, separator, ...rows] = block.split('\n')
  const header = `${head}\n${separator}`
  const room = max - header.length - 1
  if (rows.length === 0 || room < max / 2) return splitLong(block, max)
  const pieces = packUnits(
    rows.flatMap((row) => splitLong(row, room)),
    room,
    '\n',
  )
  return pieces.map((piece) => `${header}\n${piece}`)
}

// Text-layer lines, with the rows of a Markdown table (e.g. in a .md file) joined into one unit,
// so packing never cuts a table between two passages unless it is too long for one.
function lineUnits(text) {
  const units = []
  let tableRun = false
  for (const line of text.split('\n').map((l) => l.trim())) {
    if (!line) {
      tableRun = false
      continue
    }
    const row = line.startsWith('|')
    if (row && tableRun) units[units.length - 1] += `\n${line}`
    else units.push(line)
    tableRun = row
  }
  return units
}

// Splits one unit that is longer than `max`: tables by rows, everything else at sentences.
const splitUnit = (unit, max) =>
  unit.length > max && isTable(unit) ? splitTable(unit, max) : splitLong(unit, max)

// Turns pages into passages with stable ids (p{page}-{n}). Text-layer pages are cut into lines
// (a table's rows stay together); a transcription is Markdown, so it is cut into blocks
// (paragraphs, tables, formulas) at blank lines and joined back the same way, which keeps its
// formatting. Units are packed greedily up to
// 1,200 characters (so most passages are 600-1,200). A unit longer than that is split at
// sentences first (a long table: by rows, with its header repeated; a very long formula can be
// cut too). Passages never cross a page boundary.
export function chunkPages(pages) {
  return pages.flatMap(({ page, text, origin }) => {
    const separator = origin === 'transcription' ? '\n\n' : '\n'
    const blocks =
      origin === 'transcription'
        ? text
            .split(/\n\s*\n/)
            .map((unit) => unit.trim())
            .filter(Boolean)
        : lineUnits(text)
    const units = blocks.flatMap((unit) => splitUnit(unit, MAX_PASSAGE_CHARS))
    return packUnits(units, MAX_PASSAGE_CHARS, separator).map((passageText, i) => ({
      id: `p${page}-${i + 1}`,
      page,
      text: passageText,
      origin,
    }))
  })
}
