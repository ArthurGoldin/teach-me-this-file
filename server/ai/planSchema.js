import { appError } from '../http/errors.js'

// Limits shared with the tutor endpoint, which receives this plan text back from the client.
const MAX_PLAN_TEXT = 500
const MIN_STEPS = 3
export const MAX_STEPS = 8
const DEFAULT_DURATION_MINUTES = 15
// A BCP-47 language tag such as "fr", "he" or "pt-BR".
const LANGUAGE_TAG = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i

// Plan text (written by the plan model): required, non-blank and short.
export const isPlanText = (value) =>
  typeof value === 'string' && value.trim() !== '' && value.length <= MAX_PLAN_TEXT
export const isOptionalPlanText = (value) =>
  value === undefined || (typeof value === 'string' && value.length <= MAX_PLAN_TEXT)

const text = { type: 'string' }

// JSON schema for Gemini structured output (design §5 LessonPlan, without step ids).
export const PLAN_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    reason: text,
    plan: {
      type: 'object',
      properties: {
        title: text,
        brief: {
          type: 'object',
          properties: {
            language: text,
            audience: text,
            style: text,
            durationMinutes: { type: 'number' },
            notes: text,
          },
          required: ['language', 'audience', 'style', 'durationMinutes', 'notes'],
        },
        steps: {
          type: 'array',
          minItems: MIN_STEPS,
          maxItems: MAX_STEPS,
          items: {
            type: 'object',
            properties: {
              title: text,
              objective: text,
              checkQuestion: text,
              passageIds: { type: 'array', minItems: 1, items: text },
            },
            required: ['title', 'objective', 'checkQuestion', 'passageIds'],
          },
        },
      },
      required: ['title', 'brief', 'steps'],
    },
  },
  required: ['ok'],
}

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

function isValidStep(step, passageIds) {
  return (
    isObject(step) &&
    [step.title, step.objective, step.checkQuestion].every(isPlanText) &&
    Array.isArray(step.passageIds) &&
    step.passageIds.length > 0 &&
    step.passageIds.every((id) => passageIds.has(id))
  )
}

function isValidBrief(brief) {
  return (
    isObject(brief) &&
    isPlanText(brief.language) &&
    LANGUAGE_TAG.test(brief.language.trim()) &&
    [brief.audience, brief.style, brief.notes].every(isOptionalPlanText)
  )
}

// Checks the model's answer against the passages that were sent. Anything the app cannot use
// throws PLAN_INVALID, which the route retries once. Returns the LessonPlan with step ids.
export function validatePlan(response, passageIds) {
  if (!isObject(response)) throw appError('PLAN_INVALID')
  if (response.ok === false) {
    if (!isPlanText(response.reason)) throw appError('PLAN_INVALID')
    return { ok: false, reason: response.reason.trim() }
  }

  const { plan } = response
  if (
    response.ok !== true ||
    !isObject(plan) ||
    !isPlanText(plan.title) ||
    !isValidBrief(plan.brief) ||
    !Array.isArray(plan.steps) ||
    plan.steps.length < MIN_STEPS ||
    plan.steps.length > MAX_STEPS ||
    !plan.steps.every((step) => isValidStep(step, passageIds))
  ) {
    throw appError('PLAN_INVALID')
  }

  const { brief } = plan
  const trim = (value) => (value ?? '').trim()
  const duration = brief.durationMinutes
  return {
    ok: true,
    plan: {
      title: trim(plan.title),
      brief: {
        language: trim(brief.language),
        audience: trim(brief.audience),
        style: trim(brief.style),
        durationMinutes:
          Number.isFinite(duration) && duration > 0 ? duration : DEFAULT_DURATION_MINUTES,
        notes: trim(brief.notes),
      },
      steps: plan.steps.map((step, i) => ({
        id: `s${i + 1}`,
        title: trim(step.title),
        objective: trim(step.objective),
        checkQuestion: trim(step.checkQuestion),
        passageIds: [...new Set(step.passageIds)],
      })),
    },
  }
}
