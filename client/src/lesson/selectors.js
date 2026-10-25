// Read-only views of the lesson state, and the body of a /api/tutor request.

// After this many wrong or partial answers on a step, the tutor explains it and moves on: the
// last guide turn is told to explain (lastAttempt) and the reducer then advances.
export const MAX_MISSES = 2
// After this many student messages on a step, the tutor explains it and moves on.
export const MAX_TURNS = 4
// Messages sent to the model as conversation history (the server enforces the same limit).
export const HISTORY_LENGTH = 12

export const currentStep = (state) => state.plan.steps[state.progress.stepIndex]

export const progressLabel = (state) =>
  `Step ${state.progress.stepIndex + 1} of ${state.plan.steps.length}`

export const isStreaming = (state) => state.messages.some(({ state: s }) => s === 'streaming')

// The student may write when the tutor is not answering and no automatic turn is due.
export const canStudentSend = (state) =>
  state.progress.status === 'teaching' && state.progress.pendingAuto === null && !isStreaming(state)

// A stopped turn the UI offers to run again ("Continue the lesson"): an automatic turn (its
// stop leaves the student without a question, and a stopped wrap-up would never end the
// lesson), or any turn stopped before its first word (e.g. by a reload mid-answer). Only the
// latest message: anything after it has moved the lesson on.
const AUTO_MODES = ['introduce', 'wrap-up']

export const canContinue = (state, message) =>
  message.role === 'tutor' &&
  message.state === 'stopped' &&
  (AUTO_MODES.includes(message.mode) || message.text === '') &&
  state.messages.at(-1)?.id === message.id

// The mode of the tutor turn that answers a student message. Wrong answers are handled inside
// guide turns (the last attempt explains, see the reducer); explain is for students who keep
// talking around the check question.
export function nextStudentTurnMode(state) {
  const { turns } = state.progress.steps[state.progress.stepIndex]
  return turns >= MAX_TURNS ? 'explain' : 'guide'
}

export const elapsedMinutes = (state, now) => (now - state.progress.startedAt) / 60_000

// Passages in the order of `ids`; ids that are not in the document are dropped.
export function passagesFor(state, ids) {
  const byId = new Map(state.document.passages.map((passage) => [passage.id, passage]))
  return ids.filter((id) => byId.has(id)).map((id) => byId.get(id))
}

// Only finished text goes to the model: streaming and failed turns are left out, and so is a
// turn stopped before any text arrived.
function history(state) {
  return state.messages
    .filter(({ state: s, text }) => (s === 'done' || s === 'stopped') && text !== '')
    .slice(-HISTORY_LENGTH)
    .map(({ role, text }) => ({ role, text }))
}

// The /api/tutor body for the current step (server: validateTutorInput). After an advance the
// current step is already the new one, and at wrap-up it stays on the last step.
export function buildTutorInput(state, mode, now) {
  const { plan, progress } = state
  const step = currentStep(state)
  const { misses } = progress.steps[progress.stepIndex]
  return {
    brief: plan.brief,
    teacherPrompt: state.teacherPrompt,
    lessonTitle: plan.title,
    stepNumber: progress.stepIndex + 1,
    stepCount: plan.steps.length,
    step: {
      title: step.title,
      objective: step.objective,
      checkQuestion: step.checkQuestion,
      passages: passagesFor(state, step.passageIds),
    },
    outline: plan.steps.map(({ title, objective }) => ({ title, objective })),
    mode,
    misses,
    // One more wrong or partial answer ends the step (reducer), so the tutor must explain now.
    lastAttempt: mode === 'guide' && misses === MAX_MISSES - 1,
    elapsedMinutes: elapsedMinutes(state, now),
    history: history(state),
  }
}
