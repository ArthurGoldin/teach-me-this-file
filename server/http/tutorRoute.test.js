import { ServerResponse } from 'node:http'
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
    keyPoints: ['La vapeur refroidit.', 'Elle devient des gouttes.'],
    checkQuestion: 'Pourquoi ?',
    passages: [{ id: 'p3-1', page: 3, text: 'Cold air condenses vapour.', origin: 'text' }],
  },
  outline: Array.from({ length: 6 }, (_, i) => ({ title: `Step ${i + 1}`, objective: 'Learn' })),
  mode: 'guide',
  misses: 0,
  lastAttempt: false,
  elapsedMinutes: 5,
  history: [{ role: 'student', text: 'Elle disparaît ?' }],
}

let server
let url

async function start(streamText, generateJson = vi.fn(), gradeTimeoutMs) {
  const createGemini = vi.fn(() => ({ streamText, generateJson }))
  server = createApp({ createGemini, env: {}, gradeTimeoutMs }).listen(0)
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

it('sends MODEL_BUSY instead of done when Gemini answers with no visible text', async () => {
  await start(async function* () {
    yield '  \n<<<META>>>\n{"understanding":"none","passageIds":[]}'
  })
  const events = parseSse(await (await post()).text())
  expect(events.map((e) => e.event)).toEqual(['error'])
  expect(events[0].data.code).toBe('MODEL_BUSY')
})

const noBlock = async function* () {
  yield 'Bonjour ! '
  yield 'Que sais-tu ?\n'
}

const logged = () => process.stdout.write.mock.calls.map(([line]) => String(line)).join('')

it('grades the turn once when the meta block is missing, then sends meta and done', async () => {
  const generateJson = vi
    .fn()
    .mockResolvedValue({ understanding: 'none', passageIds: ['p3-1', 'x'] })
  await start(noBlock, generateJson)
  const events = parseSse(await (await post()).text())
  expect(events.map((e) => e.event)).toEqual(['delta', 'delta', 'meta', 'done'])
  expect(events.map((e) => e.data.text).join('')).toBe('Bonjour ! Que sais-tu ?')
  expect(events[2].data).toEqual({ understanding: 'none', passageIds: ['p3-1'] })
  expect(generateJson).toHaveBeenCalledTimes(1)
  const request = generateJson.mock.calls[0][0]
  expect(request.schema).toBeDefined()
  expect(request.contents[0].parts[0].text).toContain(
    '<tutor_reply>\nBonjour ! Que sais-tu ?\n</tutor_reply>',
  )
  expect(logged()).toContain('"metaSource":"fallback"')
})

it('does not grade when the meta block is present', async () => {
  const generateJson = vi.fn()
  await start(async function* () {
    yield 'Non.\n<<<META>>>\n{"understanding":"no","passageIds":[]}'
  }, generateJson)
  await (await post()).text()
  expect(generateJson).not.toHaveBeenCalled()
  expect(logged()).toContain('"metaSource":"block"')
})

it('sends done without meta when grading fails too', async () => {
  const generateJson = vi.fn().mockRejectedValue(Object.assign(new Error('quota'), { status: 429 }))
  await start(noBlock, generateJson)
  const events = parseSse(await (await post()).text())
  expect(events.map((e) => e.event)).toEqual(['delta', 'delta', 'done'])
  expect(logged()).toContain('"metaSource":"none"')
  expect(logged()).toContain('"gradeCode":"RATE_LIMITED"')
})

it('gives up grading after the timeout and sends done without meta', async () => {
  const generateJson = vi.fn(
    ({ signal }) =>
      new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason))
      }),
  )
  await start(noBlock, generateJson, 20)
  const events = parseSse(await (await post()).text())
  expect(events.map((e) => e.event)).toEqual(['delta', 'delta', 'done'])
  expect(logged()).toContain('"metaSource":"none"')
  expect(logged()).toContain('"gradeCode":"TIMEOUT"')
})

it('sends done without meta when the grader answers with an unusable object', async () => {
  await start(noBlock, vi.fn().mockResolvedValue({ understanding: 'maybe', passageIds: [] }))
  const events = parseSse(await (await post()).text())
  expect(events.map((e) => e.event)).toEqual(['delta', 'delta', 'done'])
  expect(logged()).toContain('"gradeCode":"INVALID_GRADE"')
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

it('aborts the gemini call when the client disconnects and writes nothing after', async () => {
  let receivedSignal
  let firstChunkSent
  const sent = new Promise((resolve) => (firstChunkSent = resolve))
  const generateJson = vi.fn()
  await start(async function* ({ signal }) {
    receivedSignal = signal
    yield 'Bonjour'
    firstChunkSent()
    await new Promise((resolve) => signal.addEventListener('abort', resolve))
  }, generateJson)
  // Record writes made to an already-closed response, at the moment they happen.
  const lateWrites = []
  const write = ServerResponse.prototype.write
  vi.spyOn(ServerResponse.prototype, 'write').mockImplementation(function (...args) {
    if (this.destroyed) lateWrites.push(String(args[0]))
    return write.apply(this, args)
  })
  const controller = new AbortController()
  const res = await post({ signal: controller.signal })
  await res.body.getReader().read()
  await sent
  controller.abort()

  await vi.waitFor(() => expect(receivedSignal.aborted).toBe(true), { timeout: 1000 })
  await vi.waitFor(() => expect(logged()).toContain('"event":"tutor_turn"'), { timeout: 1000 })
  expect(lateWrites).toEqual([])
  expect(logged()).toContain('"code":"ABORTED"')
  expect(generateJson).not.toHaveBeenCalled()
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

it('writes nothing more when the client leaves during grading', async () => {
  let gradingStarted
  const started = new Promise((resolve) => (gradingStarted = resolve))
  const generateJson = vi.fn(
    ({ signal }) =>
      new Promise((_, reject) => {
        gradingStarted()
        signal.addEventListener('abort', () => reject(new Error('aborted')))
      }),
  )
  await start(noBlock, generateJson)
  const controller = new AbortController()
  const res = await post({ signal: controller.signal })
  await res.body.getReader().read()
  await started
  controller.abort()
  await vi.waitFor(() => expect(logged()).toContain('"event":"tutor_turn"'), { timeout: 1000 })
  expect(logged()).toContain('"code":"ABORTED"')
  expect(logged()).toContain('"metaSource":"none"')
})

it('writes nothing when a grader that ignores the signal answers after the client left', async () => {
  let gradingStarted
  let answer
  const started = new Promise((resolve) => (gradingStarted = resolve))
  const generateJson = vi.fn(
    () =>
      new Promise((resolve) => {
        answer = resolve
        gradingStarted()
      }),
  )
  await start(noBlock, generateJson)
  const lateWrites = []
  const write = ServerResponse.prototype.write
  vi.spyOn(ServerResponse.prototype, 'write').mockImplementation(function (...args) {
    if (this.destroyed || this.writableEnded) lateWrites.push(String(args[0]))
    return write.apply(this, args)
  })
  const controller = new AbortController()
  const res = await post({ signal: controller.signal })
  await res.body.getReader().read()
  await started
  controller.abort()
  // Let the server notice the disconnect before the grader answers.
  await vi.waitFor(() => expect(generateJson.mock.calls[0][0].signal.aborted).toBe(true), {
    timeout: 1000,
  })
  answer({ understanding: 'no', passageIds: ['p3-1'] })
  await vi.waitFor(() => expect(logged()).toContain('"event":"tutor_turn"'), { timeout: 1000 })
  expect(lateWrites).toEqual([])
  expect(logged()).toContain('"code":"ABORTED"')
  expect(logged()).not.toContain('"metaSource":"fallback"')
})
