import { describe, expect, it } from 'vitest'
import { AppError } from '../http/errors.js'
import { validatePlan } from './planSchema.js'

const knownIds = new Set(['p1-1', 'p1-2', 'p2-1'])

function makeStep(overrides = {}) {
  return {
    title: "L'évaporation",
    objective: "Expliquer comment le soleil transforme l'eau en vapeur",
    checkQuestion: "Qu'est-ce qui fait monter l'eau dans l'air ?",
    passageIds: ['p1-1'],
    ...overrides,
  }
}

function makeResponse({ plan = {}, brief = {}, steps } = {}) {
  return {
    ok: true,
    plan: {
      title: "Le cycle de l'eau",
      brief: {
        language: 'fr',
        audience: '7th graders',
        style: 'socratic',
        durationMinutes: 15,
        notes: '',
        ...brief,
      },
      steps: steps ?? [
        makeStep(),
        makeStep({ passageIds: ['p1-2'] }),
        makeStep({ passageIds: ['p2-1', 'p1-1'] }),
      ],
      ...plan,
    },
  }
}

function errorOf(fn) {
  try {
    fn()
  } catch (err) {
    return err
  }
  return null
}

describe('validatePlan', () => {
  it('returns the plan with step ids s1…sN', () => {
    const result = validatePlan(makeResponse(), knownIds)
    expect(result.ok).toBe(true)
    expect(result.plan.title).toBe("Le cycle de l'eau")
    expect(result.plan.brief).toEqual({
      language: 'fr',
      audience: '7th graders',
      style: 'socratic',
      durationMinutes: 15,
      notes: '',
    })
    expect(result.plan.steps.map((s) => s.id)).toEqual(['s1', 's2', 's3'])
    expect(result.plan.steps[2]).toEqual({
      id: 's3',
      ...makeStep({ passageIds: ['p2-1', 'p1-1'] }),
    })
  })

  it.each([
    ['missing', undefined],
    ['zero', 0],
    ['negative', -5],
  ])('defaults durationMinutes to 15 when it is %s', (_, durationMinutes) => {
    const result = validatePlan(makeResponse({ brief: { durationMinutes } }), knownIds)
    expect(result.plan.brief.durationMinutes).toBe(15)
  })

  it('fills missing optional brief fields with empty text', () => {
    const response = makeResponse()
    response.plan.brief = { language: 'he', durationMinutes: 10 }
    const { brief } = validatePlan(response, knownIds).plan
    expect(brief).toEqual({
      language: 'he',
      audience: '',
      style: '',
      durationMinutes: 10,
      notes: '',
    })
  })

  it('passes ok:false through with its reason', () => {
    const response = { ok: false, reason: 'The file only contains random characters.' }
    expect(validatePlan(response, knownIds)).toEqual(response)
  })

  const long = 'a'.repeat(501)
  it.each([
    ['a response that is not an object', null],
    ['ok:false without a reason', { ok: false }],
    ['ok:true without a plan', { ok: true }],
    ['fewer than 3 steps', makeResponse({ steps: [makeStep(), makeStep()] })],
    ['more than 8 steps', makeResponse({ steps: Array(9).fill(makeStep()) })],
    [
      'an unknown passage id',
      makeResponse({ steps: [makeStep(), makeStep(), makeStep({ passageIds: ['p9-9'] })] }),
    ],
    [
      'a step without passages',
      makeResponse({ steps: [makeStep(), makeStep(), makeStep({ passageIds: [] })] }),
    ],
    [
      'a step without a title',
      makeResponse({ steps: [makeStep(), makeStep(), makeStep({ title: '' })] }),
    ],
    [
      'a step without an objective',
      makeResponse({ steps: [makeStep(), makeStep(), makeStep({ objective: undefined })] }),
    ],
    [
      'a step without a check question',
      makeResponse({ steps: [makeStep(), makeStep(), makeStep({ checkQuestion: ' ' })] }),
    ],
    ['a missing plan title', makeResponse({ plan: { title: undefined } })],
    ['a plan title over 500 chars', makeResponse({ plan: { title: long } })],
    [
      'a step title over 500 chars',
      makeResponse({ steps: [makeStep(), makeStep(), makeStep({ title: long })] }),
    ],
    [
      'an objective over 500 chars',
      makeResponse({ steps: [makeStep(), makeStep(), makeStep({ objective: long })] }),
    ],
    [
      'a check question over 500 chars',
      makeResponse({ steps: [makeStep(), makeStep(), makeStep({ checkQuestion: long })] }),
    ],
    ['a missing language', makeResponse({ brief: { language: undefined } })],
    ['a language that is not a BCP-47 tag', makeResponse({ brief: { language: 'French please' } })],
    ['an audience over 500 chars', makeResponse({ brief: { audience: long } })],
    ['a style over 500 chars', makeResponse({ brief: { style: long } })],
    ['notes over 500 chars', makeResponse({ brief: { notes: long } })],
  ])('throws PLAN_INVALID on %s', (_, response) => {
    const error = errorOf(() => validatePlan(response, knownIds))
    expect(error).toBeInstanceOf(AppError)
    expect(error.code).toBe('PLAN_INVALID')
    expect(error.status).toBe(502)
  })
})
