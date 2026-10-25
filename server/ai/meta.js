export const META_MARKER = '<<<META>>>'

export const UNDERSTANDING = ['yes', 'partial', 'no', 'none']

// Length of the longest suffix of `text` that is a prefix of the marker.
function partialMarkerLength(text) {
  const max = Math.min(text.length, META_MARKER.length - 1)
  for (let len = max; len > 0; len--) {
    if (META_MARKER.startsWith(text.slice(-len))) return len
  }
  return 0
}

// Hides the marker from the stream. Characters that might be the start of the marker are held
// back until the next chunk shows whether it really is one; after the marker, all text is meta.
export function createMetaSplitter() {
  let held = ''
  let meta = null

  return {
    push(chunk) {
      if (meta !== null) {
        meta += chunk
        return ''
      }
      held += chunk
      const at = held.indexOf(META_MARKER)
      if (at !== -1) {
        const text = held.slice(0, at)
        meta = held.slice(at + META_MARKER.length)
        held = ''
        return text
      }
      const keep = partialMarkerLength(held)
      const text = held.slice(0, held.length - keep)
      held = held.slice(held.length - keep)
      return text
    },
    end() {
      if (meta !== null) return { text: '', metaRaw: meta.trim() }
      return { text: held, metaRaw: null }
    },
  }
}

// Parses the model's JSON meta block. Returns null if it is unusable; the caller then falls back
// to "no understanding signal" instead of failing the turn.
export function parseMeta(metaRaw, allowedPassageIds) {
  if (!metaRaw) return null
  const json = metaRaw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let data
  try {
    data = JSON.parse(json)
  } catch {
    return null
  }
  return validateMeta(data, allowedPassageIds)
}

// Checks a meta object (from the hidden block or the fallback grader, D8). Returns null if it is
// unusable; passage ids are filtered to the current step's passages.
export function validateMeta(data, allowedPassageIds) {
  if (!data || !UNDERSTANDING.includes(data.understanding)) return null
  const ids = Array.isArray(data.passageIds) ? data.passageIds : []
  return {
    understanding: data.understanding,
    passageIds: ids.filter((id) => allowedPassageIds.includes(id)),
  }
}
