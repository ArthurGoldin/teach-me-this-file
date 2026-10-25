import { describe, expect, it } from 'vitest'
import { META_MARKER, createMetaSplitter, parseMeta, validateMeta } from './meta.js'

function run(chunks) {
  const splitter = createMetaSplitter()
  const emitted = chunks.map((chunk) => splitter.push(chunk))
  const { text, metaRaw } = splitter.end()
  return { pieces: [...emitted, text], metaRaw }
}

describe('createMetaSplitter', () => {
  it('passes text through when there is no marker', () => {
    const { pieces, metaRaw } = run(['Bonjour ', 'le monde'])
    expect(pieces.join('')).toBe('Bonjour le monde')
    expect(metaRaw).toBeNull()
  })

  it('never emits any part of a marker split across chunks', () => {
    const { pieces, metaRaw } = run([
      'Question ?\n<<<ME',
      'TA>>>\n{"understanding":"no","passageIds":["p3-1"]}',
    ])
    expect(pieces.join('').trimEnd()).toBe('Question ?')
    expect(pieces.some((piece) => piece.includes('<'))).toBe(false)
    expect(JSON.parse(metaRaw)).toEqual({ understanding: 'no', passageIds: ['p3-1'] })
  })

  it('releases held-back characters that are not a marker', () => {
    const { pieces } = run(['a <<', 'b'])
    expect(pieces.join('')).toBe('a <<b')
  })

  it('handles the marker in the very first chunk', () => {
    const { pieces, metaRaw } = run([META_MARKER + '{"understanding":"none"}'])
    expect(pieces.join('')).toBe('')
    expect(JSON.parse(metaRaw)).toEqual({ understanding: 'none' })
  })
})

describe('parseMeta', () => {
  const raw = '{"understanding":"yes","passageIds":["p3-1"]}'

  it('accepts code-fenced JSON', () => {
    expect(parseMeta('```json\n' + raw + '\n```', ['p3-1'])).toEqual({
      understanding: 'yes',
      passageIds: ['p3-1'],
    })
  })

  it('filters passage ids to the allowed set', () => {
    const meta = parseMeta('{"understanding":"yes","passageIds":["p3-1","p9-9"]}', ['p3-1'])
    expect(meta.passageIds).toEqual(['p3-1'])
  })

  it('returns null for invalid JSON, unknown understanding, or null input', () => {
    expect(parseMeta('not json', [])).toBeNull()
    expect(parseMeta('{"understanding":"maybe"}', [])).toBeNull()
    expect(parseMeta(null, [])).toBeNull()
  })

  it('defaults missing passageIds to []', () => {
    expect(parseMeta('{"understanding":"partial"}', ['p3-1'])).toEqual({
      understanding: 'partial',
      passageIds: [],
    })
  })
})

describe('validateMeta', () => {
  it('accepts a grader object and filters its passage ids', () => {
    expect(validateMeta({ understanding: 'no', passageIds: ['p1-1', 'x'] }, ['p1-1'])).toEqual({
      understanding: 'no',
      passageIds: ['p1-1'],
    })
  })

  it('rejects an unknown understanding or a missing object', () => {
    expect(validateMeta({ understanding: 'maybe', passageIds: [] }, [])).toBeNull()
    expect(validateMeta(null, [])).toBeNull()
  })
})
