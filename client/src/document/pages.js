// Helpers shared by the TXT sectioning and the passage chunker.

const MIN_TEXT_CHARS = 80

// A page with almost no text (a scan, or just a page number) has no usable text layer.
export function isScanPage(text) {
  return text.replace(/\s/g, '').length < MIN_TEXT_CHARS
}

// Greedy packing: add units to the current piece while it fits in `max`, else start a new piece.
// Every unit must already be <= max.
export function packUnits(units, max, separator) {
  const pieces = []
  let current = ''
  for (const unit of units) {
    if (current && current.length + separator.length + unit.length > max) {
      pieces.push(current)
      current = unit
    } else {
      current = current ? current + separator + unit : unit
    }
  }
  if (current) pieces.push(current)
  return pieces
}

// Splits text that is longer than `max`: at sentence ends first, hard cuts only as a last resort.
export function splitLong(text, max) {
  if (text.length <= max) return [text]
  const sentences = text.split(/(?<=[.!?؟。])\s+/).flatMap((sentence) => {
    const cuts = []
    for (let i = 0; i < sentence.length; i += max) cuts.push(sentence.slice(i, i + max))
    return cuts
  })
  return packUnits(sentences, max, ' ')
}

// Cuts a plain-text file into "pages" of about `size` characters, at paragraph breaks.
export function splitTextIntoSections(text, size = 3000) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((p) => splitLong(p, size))
  return packUnits(paragraphs, size, '\n\n')
}
