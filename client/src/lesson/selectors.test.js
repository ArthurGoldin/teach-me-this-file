import { describe, it, expect } from 'vitest'
import { validateTutorInput } from '../../../server/ai/prompts/tutor.js'
import { lessonReducer } from './reducer.js'
import {
  HISTORY_LENGTH,
  MAX_MISSES,
  MAX_TURNS,
  buildTutorInput,
  canContinue,
  canStudentSend,
  currentStep,
  elapsedMinutes,
  isStreaming,
  nextStudentTurnMode,
  passagesFor,
  progressLabel,
} from './selectors.js'
import { START, newLesson, studentSays, testDocument, testPlan, tutorTurn } from './testLesson.js'

const miss = { understanding: 'no', passageIds: [] }
const offTopic = { understanding: 'none', passageIds: [] }
const answered = () => studentSays(tutorTurn(newLesson(), 'introduce', null))

describe('lesson selectors', () => {
  it('currentStep and progressLabel follow the step index', () => {
    const state = tutorTurn(answered(), 'guide', { understanding: 'yes', passageIds: [] })
    expect(currentStep(state)).toBe(testPlan.steps[1])
    expect(progressLabel(state)).toBe('Step 2 of 3')
  })

  it('isStreaming is true only while a tutor message streams', () => {
    const state = newLesson()
    expect(isStreaming(state)).toBe(false)
    expect(
      isStreaming(lessonReducer(state, { type: 'tutorStarted', id: 't', mode: 'introduce' })),
    ).toBe(true)
  })

  it('nextStudentTurnMode stays guide while misses accumulate (the last attempt explains)', () => {
    let state = answered()
    for (let i = 0; i < MAX_MISSES - 1; i++) {
      state = studentSays(tutorTurn(state, 'guide', miss))
      expect(nextStudentTurnMode(state)).toBe('guide')
    }
  })

  it('buildTutorInput flags the guide turn that is the last attempt', () => {
    let state = answered()
    expect(buildTutorInput(state, 'guide', START).lastAttempt).toBe(false)
    for (let i = 0; i < MAX_MISSES - 1; i++) state = studentSays(tutorTurn(state, 'guide', miss))
    expect(buildTutorInput(state, 'guide', START).lastAttempt).toBe(true)
    expect(buildTutorInput(state, 'explain', START).lastAttempt).toBe(false)
  })

  it('canStudentSend only while teaching with nothing streaming or due', () => {
    expect(canStudentSend(newLesson())).toBe(false) // the introduction is due
    const state = tutorTurn(newLesson(), 'introduce', null)
    expect(canStudentSend(state)).toBe(true)
    const streaming = lessonReducer(studentSays(state), {
      type: 'tutorStarted',
      id: 's',
      mode: 'guide',
    })
    expect(canStudentSend(streaming)).toBe(false)
  })

  it('canContinue only for the last message: a stopped automatic or empty turn', () => {
    const stopped = (state, id, mode, text) => {
      let next = lessonReducer(state, { type: 'tutorStarted', id, mode })
      if (text) next = lessonReducer(next, { type: 'tutorDelta', id, text })
      return lessonReducer(next, { type: 'tutorStopped', id })
    }
    const state = stopped(newLesson(), 'i1', 'introduce', 'Bonj')
    const intro = state.messages.at(-1)
    expect(canContinue(state, intro)).toBe(true)
    expect(canContinue(studentSays(state), intro)).toBe(false)
    // A reply stopped before its first word can be asked for again…
    const empty = stopped(studentSays(state), 'g1', 'guide')
    expect(canContinue(empty, empty.messages.at(-1))).toBe(true)
    // …but not a partial reply the student stopped on purpose.
    const partial = stopped(studentSays(state), 'g2', 'guide', 'Presque')
    expect(canContinue(partial, partial.messages.at(-1))).toBe(false)
  })

  it('nextStudentTurnMode is explain after MAX_TURNS student turns on the step', () => {
    let state = answered()
    for (let turn = 2; turn <= MAX_TURNS; turn++) {
      expect(nextStudentTurnMode(state)).toBe('guide')
      state = studentSays(tutorTurn(state, 'guide', offTopic))
    }
    expect(state.progress.steps[0]).toMatchObject({ misses: 0, turns: MAX_TURNS })
    expect(nextStudentTurnMode(state)).toBe('explain')
  })

  it('elapsedMinutes counts from the lesson start', () => {
    expect(elapsedMinutes(newLesson(), START + 90_000)).toBe(1.5)
  })

  it('passagesFor resolves ids in order and drops unknown ones', () => {
    expect(passagesFor(newLesson(), ['p2-1', 'nope', 'p1-1'])).toEqual([
      testDocument.passages[2],
      testDocument.passages[0],
    ])
  })

  it('buildTutorInput builds the request for the current step', () => {
    const state = answered()
    expect(buildTutorInput(state, 'guide', START + 120_000)).toEqual({
      brief: testPlan.brief,
      teacherPrompt: 'Teach this to 7th graders.',
      lessonTitle: 'The water cycle',
      stepNumber: 1,
      stepCount: 3,
      step: {
        title: 'Step 1',
        objective: 'Objective 1',
        keyPoints: ['Point 1a.', 'Point 1b.'],
        checkQuestion: 'Question 1?',
        passages: testDocument.passages.slice(0, 2),
      },
      outline: testPlan.steps.map(({ title, objective }) => ({ title, objective })),
      mode: 'guide',
      misses: 0,
      lastAttempt: false,
      elapsedMinutes: 2,
      history: [
        { role: 'tutor', text: 'Tutor text.' },
        { role: 'student', text: 'An answer.' },
      ],
    })
  })

  it('buildTutorInput keeps only the last 12 done or stopped messages with text', () => {
    let state = newLesson()
    // Not sent: a failed turn and a turn stopped before any text arrived.
    state = lessonReducer(state, { type: 'tutorStarted', id: 'f1', mode: 'introduce' })
    state = lessonReducer(state, {
      type: 'tutorFailed',
      id: 'f1',
      error: { code: 'NETWORK', message: 'x' },
    })
    state = lessonReducer(state, { type: 'tutorStarted', id: 'e1', mode: 'introduce' })
    state = lessonReducer(state, { type: 'tutorStopped', id: 'e1' })
    state = tutorTurn(state, 'introduce', null, 'intro')
    for (let i = 1; i <= 7; i++) {
      state = tutorTurn(studentSays(state, `answer ${i}`), 'guide', offTopic, `reply ${i}`)
    }
    const history = buildTutorInput(state, 'guide', START).history
    expect(history).toHaveLength(HISTORY_LENGTH)
    // 15 eligible messages (intro + 7 answers + 7 replies): the intro, answer 1 and reply 1 drop.
    expect(history[0]).toEqual({ role: 'student', text: 'answer 2' })
    expect(history.at(-1)).toEqual({ role: 'tutor', text: 'reply 7' })
  })

  it('buildTutorInput passes the server validation for each mode', () => {
    const state = answered()
    for (const mode of ['introduce', 'guide', 'explain', 'wrap-up']) {
      const input = buildTutorInput(state, mode, START + 60_000)
      expect(() => validateTutorInput(input)).not.toThrow()
    }
  })
})
