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

// Key points: what the tutor must teach in a step before it asks the check question (D22).
const MIN_KEY_POINTS = 2
const MAX_KEY_POINTS = 4
// The plan prompt asks for under 150 characters; the slack absorbs longer scripts and translations.
const MAX_KEY_POINT = 300
export const isKeyPoints = (value) =>
  Array.isArray(value) &&
  value.length >= MIN_KEY_POINTS &&
  value.length <= MAX_KEY_POINTS &&
  value.every((point) => isPlanText(point) && point.trim().length <= MAX_KEY_POINT)

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
              keyPoints: {
                type: 'array',
                minItems: MIN_KEY_POINTS,
                maxItems: MAX_KEY_POINTS,
                items: text,
              },
              checkQuestion: text,
              passageIds: { type: 'array', minItems: 1, items: text },
            },
            required: ['title', 'objective', 'keyPoints', 'checkQuestion', 'passageIds'],
          },
        },
      },
      required: ['title', 'brief', 'steps'],
    },
  },
  required: ['ok'],
}

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

// The model sometimes writes HTML entities inside the JSON ("pr&#233;cipitation"), and the UI
// shows text literally. One pass decodes numeric entities and the common named ones, so
// "&amp;lt;" becomes "&lt;", not "<".
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' }
const ENTITY = /&(?:#(\d{1,7})|#x([\da-f]{1,6})|(amp|lt|gt|quot|apos|nbsp));/gi

// Surrogates and control characters (except tab and newline) are left as written.
const isDecodable = (code) =>
  code === 0x09 ||
  code === 0x0a ||
  (code >= 0x20 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff))

function decodeEntities(text) {
  return text.replace(ENTITY, (entity, dec, hex, name) => {
    if (name) return NAMED_ENTITIES[name.toLowerCase()]
    const code = dec ? Number(dec) : parseInt(hex, 16)
    return isDecodable(code) ? String.fromCodePoint(code) : entity
  })
}

// Plan text as the app will use it: entities decoded, then trimmed. Decoding comes before
// validation, so "&nbsp;" cannot pass as a non-empty field and turn blank afterwards.
const clean = (value) => (typeof value === 'string' ? decodeEntities(value).trim() : value)

function cleanStep(step) {
  if (!isObject(step)) return step
  return {
    ...step,
    title: clean(step.title),
    objective: clean(step.objective),
    checkQuestion: clean(step.checkQuestion),
    keyPoints: Array.isArray(step.keyPoints) ? step.keyPoints.map(clean) : step.keyPoints,
  }
}

function cleanPlan(plan) {
  if (!isObject(plan)) return plan
  const { brief, steps } = plan
  return {
    ...plan,
    title: clean(plan.title),
    brief: isObject(brief)
      ? {
          ...brief,
          language: clean(brief.language),
          audience: clean(brief.audience),
          style: clean(brief.style),
          notes: clean(brief.notes),
        }
      : brief,
    steps: Array.isArray(steps) ? steps.map(cleanStep) : steps,
  }
}

function isValidStep(step, passageIds) {
  return (
    isObject(step) &&
    [step.title, step.objective, step.checkQuestion].every(isPlanText) &&
    isKeyPoints(step.keyPoints) &&
    Array.isArray(step.passageIds) &&
    step.passageIds.length > 0 &&
    step.passageIds.every((id) => passageIds.has(id))
  )
}

function isValidBrief(brief) {
  return (
    isObject(brief) &&
    isPlanText(brief.language) &&
    LANGUAGE_TAG.test(brief.language) &&
    [brief.audience, brief.style, brief.notes].every(isOptionalPlanText)
  )
}

// Checks the model's answer against the passages that were sent. Anything the app cannot use
// throws PLAN_INVALID, which the route retries once. Returns the LessonPlan with step ids.
export function validatePlan(response, passageIds) {
  if (!isObject(response)) throw appError('PLAN_INVALID')
  if (response.ok === false) {
    const reason = clean(response.reason)
    if (!isPlanText(reason)) throw appError('PLAN_INVALID')
    return { ok: false, reason }
  }

  const plan = cleanPlan(response.plan)
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
  const duration = brief.durationMinutes
  return {
    ok: true,
    plan: {
      title: plan.title,
      brief: {
        language: brief.language,
        audience: brief.audience ?? '',
        style: brief.style ?? '',
        durationMinutes:
          Number.isFinite(duration) && duration > 0 ? duration : DEFAULT_DURATION_MINUTES,
        notes: brief.notes ?? '',
      },
      steps: plan.steps.map((step, i) => ({
        id: `s${i + 1}`,
        title: step.title,
        objective: step.objective,
        keyPoints: step.keyPoints,
        checkQuestion: step.checkQuestion,
        passageIds: [...new Set(step.passageIds)],
      })),
    },
  }
}
