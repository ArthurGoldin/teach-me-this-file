import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createApp } from '../app.js'

const body = {
  brief: {
    language: 'fr',
    audience: '7th graders',
    style: 'socratic',
    durationMinutes: 15,
    notes: '',
  },
  teacherPrompt: 'Teach this in French.',
  lessonTitle: "Le cycle de l'eau",
  stepNumber: 3,
  stepCount: 6,
  step: {
    title: 'La condensation',
    objective: 'Explain condensation',
    checkQuestion: 'Pourquoi ?',
    passages: [{ id: 'p3-1', page: 3, text: 'Cold air condenses vapour.', origin: 'text' }],
  },
  mode: 'guide',
  misses: 0,
  elapsedMinutes: 5,
  history: [{ role: 'student', text: 'Elle disparaît ?' }],
}

let server
let url

async function start(streamText) {
  const createGemini = vi.fn(() => ({ streamText }))
  server = createApp({ createGemini, env: {} }).listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  url = `http://localhost:${server.address().port}/api/tutor`
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

// Turns an SSE body into [{ event, data }].
function parseSse(text) {
  return text
    .split('\n\n')
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n')
      const event = lines.find((l) => l.startsWith('event: ')).slice(7)
      const data = JSON.parse(lines.find((l) => l.startsWith('data: ')).slice(6))
      return { event, data }
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

it('streams delta events, then meta, then done', async () => {
  const createGemini = await start(async function* () {
    yield 'Pas tout'
    yield ' à fait ?\n<<<META>>>\n{"understanding":"no","passageIds":["p3-1"]}'
  })
  const res = await post()
  expect(res.headers.get('content-type')).toContain('text/event-stream')
  const events = parseSse(await res.text())

  expect(createGemini).toHaveBeenCalledWith({ apiKey: 'test-key' })
  expect(events.map((e) => e.event).filter((e) => e !== 'delta')).toEqual(['meta', 'done'])
  expect(events.at(-2)).toEqual({
    event: 'meta',
    data: { understanding: 'no', passageIds: ['p3-1'] },
  })
  const deltas = events.filter((e) => e.event === 'delta').map((e) => e.data.text)
  expect(deltas.length).toBeGreaterThan(0)
  expect(deltas.join('')).toBe('Pas tout à fait ?')
  deltas.forEach((text) => expect(text).not.toContain('<<<'))
})

it('sends done without meta when the block is missing', async () => {
  await start(async function* () {
    yield 'Bonjour ! '
    yield 'Que sais-tu ?\n'
  })
  const events = parseSse(await (await post()).text())
  expect(events.map((e) => e.event)).toEqual(['delta', 'delta', 'done'])
  expect(events.map((e) => e.data.text).join('')).toBe('Bonjour ! Que sais-tu ?')
})

it('sends an error event when gemini fails mid-stream', async () => {
  await start(async function* () {
    yield 'Pas'
    throw Object.assign(new Error('quota'), { status: 429 })
  })
  const res = await post()
  expect(res.status).toBe(200)
  const events = parseSse(await res.text())
  expect(events.at(-1).event).toBe('error')
  expect(events.at(-1).data.code).toBe('RATE_LIMITED')
  expect(events.at(-1).data.message).toBeTruthy()
})

it('aborts the gemini call when the client disconnects', async () => {
  let receivedSignal
  let firstChunkSent
  const sent = new Promise((resolve) => (firstChunkSent = resolve))
  await start(async function* ({ signal }) {
    receivedSignal = signal
    yield 'Bonjour'
    firstChunkSent()
    await new Promise((resolve) => signal.addEventListener('abort', resolve))
  })
  const controller = new AbortController()
  const res = await post({ signal: controller.signal })
  const reader = res.body.getReader()
  await reader.read()
  await sent
  controller.abort()

  await vi.waitFor(() => expect(receivedSignal.aborted).toBe(true), { timeout: 1000 })
})

it('rejects a request without a key with 401 NO_KEY', async () => {
  await start(async function* () {})
  const res = await post({ headers: { 'Content-Type': 'application/json' } })
  expect(res.status).toBe(401)
  expect(res.headers.get('content-type')).toContain('application/json')
  expect((await res.json()).error.code).toBe('NO_KEY')
})

it('rejects an invalid body with 400 BAD_REQUEST', async () => {
  await start(async function* () {})
  const res = await post({ body: JSON.stringify({ ...body, mode: 'lecture' }) })
  expect(res.status).toBe(400)
  expect(res.headers.get('content-type')).toContain('application/json')
  expect((await res.json()).error.code).toBe('BAD_REQUEST')
})
