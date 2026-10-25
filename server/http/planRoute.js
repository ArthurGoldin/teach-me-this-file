import { PLAN_RESPONSE_SCHEMA, validatePlan } from '../ai/planSchema.js'
import { buildPlanRequest, validatePlanInput } from '../ai/prompts/plan.js'
import { log } from './logger.js'

// POST /api/plan: one JSON call that turns the teacher prompt and the passages into a lesson plan
// (design §6.1). A plan that fails validation is asked for once more; errors go to the JSON
// error handler.
export function createPlanRoute({ createGemini }) {
  return async (req, res) => {
    const input = validatePlanInput(req.body)
    const started = Date.now()
    const passageIds = new Set(input.document.passages.map((p) => p.id))

    // The client went away: stop waiting for Gemini.
    const controller = new AbortController()
    res.on('close', () => {
      if (!res.writableEnded) controller.abort()
    })

    const gemini = createGemini({ apiKey: res.locals.apiKey })
    const request = {
      ...buildPlanRequest(input),
      schema: PLAN_RESPONSE_SCHEMA,
      signal: controller.signal,
    }
    const generatePlan = async () => validatePlan(await gemini.generateJson(request), passageIds)

    let result
    try {
      result = await generatePlan()
    } catch (err) {
      if (err.code !== 'PLAN_INVALID') throw err
      log.warn('plan_retry', { route: '/api/plan', code: err.code })
      result = await generatePlan()
    }
    log.info('plan_built', {
      route: '/api/plan',
      durationMs: Date.now() - started,
      steps: result.ok ? result.plan.steps.length : 0,
    })
    res.json(result)
  }
}
