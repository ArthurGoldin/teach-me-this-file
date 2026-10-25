// Test-only fixture data (imported only by *.test.js).
import { lessonReducer } from './reducer.js'

// Shared test data for the lesson tests: a 3-step plan over a 2-page document.
export const START = 1_000_000

const passage = (id, page) => ({ id, page, text: `Text of passage ${id}.`, origin: 'text' })

export const testDocument = {
  name: 'water-cycle.pdf',
  kind: 'pdf',
  pageCount: 2,
  range: { from: 1, to: 2 },
  passages: [passage('p1-1', 1), passage('p1-2', 1), passage('p2-1', 2)],
  skipped: [],
}

const step = (n, passageIds) => ({
  id: `s${n}`,
  title: `Step ${n}`,
  objective: `Objective ${n}`,
  keyPoints: [`Point ${n}a.`, `Point ${n}b.`],
  checkQuestion: `Question ${n}?`,
  passageIds,
})

export const testPlan = {
  title: 'The water cycle',
  brief: { language: 'en', audience: '7th graders', style: 'socratic', durationMinutes: 15 },
  steps: [step(1, ['p1-1', 'p1-2']), step(2, ['p2-1']), step(3, ['p1-1'])],
}

export const newLesson = () =>
  lessonReducer(null, {
    type: 'lessonCreated',
    document: testDocument,
    plan: testPlan,
    teacherPrompt: 'Teach this to 7th graders.',
    now: START,
  })

let nextId = 0
const id = () => `m${++nextId}`

// Runs the actions of one full tutor turn and returns the new state.
export function tutorTurn(state, mode, meta, text = 'Tutor text.') {
  const messageId = id()
  let next = lessonReducer(state, { type: 'tutorStarted', id: messageId, mode })
  next = lessonReducer(next, { type: 'tutorDelta', id: messageId, text })
  return lessonReducer(next, { type: 'tutorFinished', id: messageId, meta })
}

export const studentSays = (state, text = 'An answer.') =>
  lessonReducer(state, { type: 'studentSent', id: id(), text })
