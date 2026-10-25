import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createApp } from '../app.js'

const passages = [
  { id: 'p1-1', page: 1, text: 'The sun warms the oceans.', origin: 'text' },
  { id: 'p1-2', page: 1, text: 'Warm air rises.', origin: 'text' },
]
const body = { teacherPrompt: 'Teach this in French.', document: { name: 'w.txt', passages } }

const step = { title: 'Évaporation', objective: 'Expliquer', checkQuestion: 'Pourquoi ?' }
const validResponse = {
  ok: true,
  plan: {
    title: "Le cycle de l'eau",
    brief: {
      language: 'fr',
      audience: 'general',
      style: 'socratic',
      durationMinutes: 15,
      notes: '',
    },
    steps: [
      { ...step, passageIds: ['p1-1'] },
      { ...step, passageIds: ['p1-2'] },
      { ...step, passageIds: ['p1-1', 'p1-2'] },
    ],
  },
}
const invalidResponse = { ok: true, plan: { ...validResponse.plan, steps: [] } }

let server
let url

async function start(generateJson) {
  const createGemini = vi.fn(() => ({ generateJson }))
  server = createApp({ createGemini, env: {} }).listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  url = `http://localhost:${server.address().port}/api/plan`
  return createGemini
}

function post(options = {}) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Gemini-Key': 'test-key' },
    body: JSON.stringify(body),
    ...options,
  })
}

beforeEach(() => {
  vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  vi.spyOn(process.stderr, 'write').mockReturnValue(true)
})

afterEach(async () => {
  vi.restoreAllMocks()
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
})

it('returns the validated plan', async () => {
  const generateJson = vi.fn().mockResolvedValue(validResponse)
  const createGemini = await start(generateJson)
  const res = await post()
  expect(res.status).toBe(200)
  const json = await res.json()
  expect(createGemini).toHaveBeenCalledWith({ apiKey: 'test-key' })
  expect(json.ok).toBe(true)
  expect(json.plan.steps.map((s) => s.id)).toEqual(['s1', 's2', 's3'])
  expect(generateJson.mock.calls[0][0].schema).toBeDefined()
})

it('returns ok:false with the reason', async () => {
  await start(vi.fn().mockResolvedValue({ ok: false, reason: 'Nothing to teach.' }))
  const res = await post()
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ ok: false, reason: 'Nothing to teach.' })
})

it('retries once when the first plan is invalid', async () => {
  const generateJson = vi
    .fn()
    .mockResolvedValueOnce(invalidResponse)
    .mockResolvedValueOnce(validResponse)
  await start(generateJson)
  const res = await post()
  expect(res.status).toBe(200)
  expect((await res.json()).ok).toBe(true)
  expect(generateJson).toHaveBeenCalledTimes(2)
})

it('fails with 502 PLAN_INVALID when both attempts are invalid', async () => {
  const generateJson = vi.fn().mockResolvedValue(invalidResponse)
  await start(generateJson)
  const res = await post()
  expect(res.status).toBe(502)
  expect((await res.json()).error.code).toBe('PLAN_INVALID')
  expect(generateJson).toHaveBeenCalledTimes(2)
})

it('does not retry other errors', async () => {
  const generateJson = vi.fn().mockRejectedValue(Object.assign(new Error('quota'), { status: 429 }))
  await start(generateJson)
  const res = await post()
  expect(res.status).toBe(429)
  expect((await res.json()).error.code).toBe('RATE_LIMITED')
  expect(generateJson).toHaveBeenCalledTimes(1)
})

it('rejects an oversized document with 400 BAD_REQUEST', async () => {
  const generateJson = vi.fn()
  await start(generateJson)
  const big = Array.from({ length: 300 }, (_, i) => ({
    id: `p${i + 1}-1`,
    page: i + 1,
    text: 'a'.repeat(1200),
  }))
  const res = await post({
    body: JSON.stringify({ ...body, document: { name: 'big.txt', passages: big } }),
  })
  expect(res.status).toBe(400)
  expect((await res.json()).error.code).toBe('BAD_REQUEST')
  expect(generateJson).not.toHaveBeenCalled()
})

it('rejects a request without a key with 401 NO_KEY', async () => {
  await start(vi.fn())
  const res = await post({ headers: { 'Content-Type': 'application/json' } })
  expect(res.status).toBe(401)
  expect((await res.json()).error.code).toBe('NO_KEY')
})
