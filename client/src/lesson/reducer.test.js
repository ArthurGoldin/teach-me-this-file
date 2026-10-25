import { describe, it, expect } from 'vitest'
import { lessonReducer } from './reducer.js'
import { MAX_MISSES } from './selectors.js'
import { START, newLesson, studentSays, testPlan, tutorTurn } from './testLesson.js'

const yes = { understanding: 'yes', passageIds: ['p1-1'] }
const stepStatuses = (state) => state.progress.steps.map((s) => s.status)

// A lesson whose step 1 has been introduced and answered once by the student.
const answered = () => studentSays(tutorTurn(newLesson(), 'introduce', null))

// A lesson on its last step, waiting for the student's answer.
function onLastStep() {
  let state = newLesson()
  for (let i = 0; i < testPlan.steps.length - 1; i++) {
    state = tutorTurn(studentSays(tutorTurn(state, 'introduce', null)), 'guide', yes)
  }
  return studentSays(tutorTurn(state, 'introduce', null))
}

describe('lessonReducer', () => {
  it('creates a lesson on step 1 that asks for an introduce turn', () => {
    const state = newLesson()
    expect(state.plan).toBe(testPlan)
    expect(state.messages).toEqual([])
    expect(state.progress).toEqual({
      stepIndex: 0,
      steps: [
        { status: 'current', misses: 0, turns: 0 },
        { status: 'todo', misses: 0, turns: 0 },
        { status: 'todo', misses: 0, turns: 0 },
      ],
      status: 'teaching',
      pendingAuto: 'introduce',
      startedAt: START,
    })
  })

  it('tutorStarted adds a streaming tutor message and clears pendingAuto', () => {
    const state = lessonReducer(newLesson(), { type: 'tutorStarted', id: 't1', mode: 'introduce' })
    expect(state.messages).toEqual([
      {
        id: 't1',
        role: 'tutor',
        text: '',
        stepId: 's1',
        mode: 'introduce',
        passageIds: [],
        state: 'streaming',
      },
    ])
    expect(state.progress.pendingAuto).toBeNull()
  })

  it('tutorDelta appends text to the message', () => {
    let state = lessonReducer(newLesson(), { type: 'tutorStarted', id: 't1', mode: 'introduce' })
    state = lessonReducer(state, { type: 'tutorDelta', id: 't1', text: 'Hello ' })
    state = lessonReducer(state, { type: 'tutorDelta', id: 't1', text: 'there' })
    expect(state.messages[0].text).toBe('Hello there')
  })

  it('studentSent appends a done student message and counts a turn on the step', () => {
    const state = answered()
    expect(state.messages.at(-1)).toMatchObject({
      role: 'student',
      text: 'An answer.',
      stepId: 's1',
      state: 'done',
    })
    expect(state.progress.steps[0].turns).toBe(1)
  })

  it('guide + yes marks the step done, advances and asks for an introduce turn', () => {
    const state = tutorTurn(answered(), 'guide', yes)
    expect(stepStatuses(state)).toEqual(['done', 'current', 'todo'])
    expect(state.progress.stepIndex).toBe(1)
    expect(state.progress.pendingAuto).toBe('introduce')
  })

  it('guide + yes on the last step asks for a wrap-up turn', () => {
    const state = tutorTurn(onLastStep(), 'guide', yes)
    expect(stepStatuses(state)).toEqual(['done', 'done', 'done'])
    expect(state.progress.stepIndex).toBe(2)
    expect(state.progress.status).toBe('wrapping-up')
    expect(state.progress.pendingAuto).toBe('wrap-up')
  })

  it('guide + partial adds a miss', () => {
    const state = tutorTurn(answered(), 'guide', { understanding: 'partial', passageIds: [] })
    expect(state.progress.steps[0]).toEqual({ status: 'current', misses: 1, turns: 1 })
    expect(state.progress.pendingAuto).toBeNull()
  })

  it('guide + no adds a miss', () => {
    const state = tutorTurn(answered(), 'guide', { understanding: 'no', passageIds: [] })
    expect(state.progress.steps[0].misses).toBe(1)
    expect(state.progress.stepIndex).toBe(0)
  })

  it('a wrong or partial answer on the last attempt marks the step explained and advances', () => {
    const once = tutorTurn(answered(), 'guide', { understanding: 'no', passageIds: [] })
    const state = tutorTurn(studentSays(once), 'guide', {
      understanding: 'partial',
      passageIds: [],
    })
    expect(state.progress.steps[0]).toMatchObject({ status: 'explained', misses: MAX_MISSES })
    expect(stepStatuses(state)).toEqual(['explained', 'current', 'todo'])
    expect(state.progress.pendingAuto).toBe('introduce')
  })

  it('guide + none changes no progress', () => {
    const before = answered()
    const state = tutorTurn(before, 'guide', { understanding: 'none', passageIds: [] })
    expect(state.progress).toEqual(before.progress)
  })

  it('guide without meta changes no progress and stores no passages', () => {
    const before = answered()
    const state = tutorTurn(before, 'guide', null)
    expect(state.progress).toEqual(before.progress)
    expect(state.messages.at(-1)).toMatchObject({ state: 'done', passageIds: [] })
  })

  it('explain marks the step explained and advances, whatever the meta says', () => {
    const state = tutorTurn(answered(), 'explain', { understanding: 'no', passageIds: [] })
    expect(stepStatuses(state)).toEqual(['explained', 'current', 'todo'])
    expect(state.progress.pendingAuto).toBe('introduce')
  })

  it('introduce finishing only stores the message', () => {
    const before = newLesson()
    const state = tutorTurn(before, 'introduce', { understanding: 'none', passageIds: ['p1-2'] })
    expect(state.progress).toEqual({ ...before.progress, pendingAuto: null })
    expect(state.messages).toHaveLength(1)
  })

  it('wrap-up finishing completes the lesson', () => {
    const wrapping = tutorTurn(onLastStep(), 'guide', yes)
    const state = tutorTurn(wrapping, 'wrap-up', null)
    expect(state.progress.status).toBe('complete')
    expect(state.progress.pendingAuto).toBeNull()
  })

  it('stores the meta passageIds on the message', () => {
    const state = tutorTurn(answered(), 'guide', { understanding: 'partial', passageIds: ['p1-2'] })
    expect(state.messages.at(-1).passageIds).toEqual(['p1-2'])
  })

  it('tutorStopped keeps the partial text and changes no progress', () => {
    const before = answered()
    let state = lessonReducer(before, { type: 'tutorStarted', id: 't9', mode: 'guide' })
    state = lessonReducer(state, { type: 'tutorDelta', id: 't9', text: 'Half a' })
    state = lessonReducer(state, { type: 'tutorStopped', id: 't9' })
    expect(state.messages.at(-1)).toMatchObject({ text: 'Half a', state: 'stopped' })
    expect(state.progress).toEqual(before.progress)
  })

  it('tutorFailed keeps the partial text, stores the error and changes no progress', () => {
    const before = answered()
    const error = { code: 'RATE_LIMITED', message: 'Too many requests.', retryAfterSeconds: 30 }
    let state = lessonReducer(before, { type: 'tutorStarted', id: 't9', mode: 'guide' })
    state = lessonReducer(state, { type: 'tutorDelta', id: 't9', text: 'Half a' })
    state = lessonReducer(state, { type: 'tutorFailed', id: 't9', error })
    expect(state.messages.at(-1)).toMatchObject({ text: 'Half a', state: 'failed', error })
    expect(state.progress).toEqual(before.progress)
  })

  it('ignores studentSent while a tutor message is streaming (same object)', () => {
    const streaming = lessonReducer(answered(), { type: 'tutorStarted', id: 't9', mode: 'guide' })
    expect(studentSays(streaming)).toBe(streaming)
  })

  it('ignores studentSent after the lesson is complete', () => {
    const complete = tutorTurn(tutorTurn(onLastStep(), 'guide', yes), 'wrap-up', null)
    expect(studentSays(complete)).toBe(complete)
  })

  it('ignores tutorFinished for a message that no longer exists', () => {
    const state = newLesson()
    expect(lessonReducer(state, { type: 'tutorFinished', id: 'gone', meta: null })).toBe(state)
  })

  it('lessonRestarted keeps the plan and starts fresh', () => {
    const state = lessonReducer(tutorTurn(answered(), 'guide', yes), {
      type: 'lessonRestarted',
      now: START + 5000,
    })
    expect(state.plan).toBe(testPlan)
    expect(state.messages).toEqual([])
    expect(state.progress).toEqual({ ...newLesson().progress, startedAt: START + 5000 })
  })

  it('lessonCleared returns null and lessonRestored returns the given state', () => {
    const saved = answered()
    expect(lessonReducer(saved, { type: 'lessonCleared' })).toBeNull()
    expect(lessonReducer(null, { type: 'lessonRestored', state: saved })).toBe(saved)
  })
})
