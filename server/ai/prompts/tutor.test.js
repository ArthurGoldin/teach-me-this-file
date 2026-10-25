import { describe, expect, it } from 'vitest'
import { AppError } from '../../http/errors.js'
import { formatDocument } from './document.js'
import { MODE_INSTRUCTIONS, buildTutorRequest, validateTutorInput } from './tutor.js'

const passages = [
  { id: 'p3-1', page: 3, text: 'Cold air turns vapour into droplets.', origin: 'text' },
]

function makeInput(overrides = {}) {
  return {
    brief: {
      language: 'fr',
      audience: '7th graders',
      style: 'socratic',
      durationMinutes: 15,
      notes: '',
    },
    teacherPrompt: 'Teach this to 7th graders, in French. Be Socratic.',
    lessonTitle: "Le cycle de l'eau",
    stepNumber: 3,
    stepCount: 6,
    step: {
      title: 'La condensation',
      objective: 'Explain why vapour turns into droplets when it cools',
      checkQuestion: 'Pourquoi la vapeur devient-elle des gouttelettes ?',
      passages,
    },
    mode: 'guide',
    misses: 0,
    elapsedMinutes: 7,
    history: [
      { role: 'tutor', text: 'Que se passe-t-il quand la vapeur refroidit ?' },
      { role: 'student', text: 'Elle disparaît ?' },
    ],
    ...overrides,
  }
}

describe('validateTutorInput', () => {
  it('returns a valid input unchanged', () => {
    expect(validateTutorInput(makeInput())).toEqual(makeInput())
  })

  it.each([
    ['an unknown mode', { mode: 'lecture' }],
    ['empty passages', { step: { ...makeInput().step, passages: [] } }],
    [
      'a student message over 2,000 chars',
      { history: [{ role: 'student', text: 'a'.repeat(2001) }] },
    ],
    ['a teacher prompt over 1,000 chars', { teacherPrompt: 'a'.repeat(1001) }],
    ['a missing brief', { brief: undefined }],
    ['an unknown history role', { history: [{ role: 'system', text: 'hi' }] }],
    ['a guide turn without a student message last', { history: [{ role: 'tutor', text: 'hi' }] }],
  ])('rejects %s with BAD_REQUEST', (_, overrides) => {
    let error
    try {
      validateTutorInput(makeInput(overrides))
    } catch (err) {
      error = err
    }
    expect(error).toBeInstanceOf(AppError)
    expect(error.code).toBe('BAD_REQUEST')
    expect(error.status).toBe(400)
  })

  it('rejects a body that is not an object', () => {
    expect(() => validateTutorInput(undefined)).toThrow(AppError)
  })
})

describe('buildTutorRequest', () => {
  it.each(Object.keys(MODE_INSTRUCTIONS))('states the instruction for %s mode', (mode) => {
    const { systemInstruction } = buildTutorRequest(makeInput({ mode }))
    expect(systemInstruction).toContain(MODE_INSTRUCTIONS[mode])
  })

  it('includes the language, teacher prompt, pacing and the formatted passages', () => {
    const { systemInstruction } = buildTutorRequest(makeInput({ misses: 1 }))
    expect(systemInstruction).toContain('fr')
    expect(systemInstruction).toContain('Teach this to 7th graders, in French. Be Socratic.')
    expect(systemInstruction).toContain('7 of about 15 minutes')
    expect(systemInstruction).toContain('Wrong or partial answers on this step so far: 1')
    expect(systemInstruction).toContain(formatDocument(passages))
    expect(systemInstruction).toContain('<<<META>>>')
  })

  it('starts with a user turn and never repeats a role', () => {
    const history = [
      { role: 'tutor', text: 'a' },
      { role: 'tutor', text: 'b' },
      { role: 'student', text: 'c' },
      { role: 'student', text: 'd' },
    ]
    const { contents } = buildTutorRequest(makeInput({ history }))
    expect(contents[0].role).toBe('user')
    contents.slice(1).forEach((content, i) => expect(content.role).not.toBe(contents[i].role))
    expect(contents.at(-1)).toEqual({ role: 'user', parts: [{ text: 'c\n\nd' }] })
  })

  it('ends a non-guide turn with an app note', () => {
    const { contents } = buildTutorRequest(makeInput({ mode: 'introduce', history: [] }))
    expect(contents).toEqual([{ role: 'user', parts: [{ text: '[app] Begin step 3.' }] }])
  })

  it('uses only the last 12 history items', () => {
    const history = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 ? 'student' : 'tutor',
      text: `m${i}`,
    }))
    const { contents } = buildTutorRequest(makeInput({ history }))
    const texts = contents.map((c) => c.parts[0].text).join(' ')
    expect(texts).not.toContain('m7 ')
    expect(texts).toContain('m8')
    expect(texts).toContain('m19')
    expect(contents.filter((c) => c.role === 'model')).toHaveLength(6)
  })
})
