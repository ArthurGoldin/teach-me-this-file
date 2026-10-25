import { MAX_MISSES } from './selectors.js'

// The lesson state and its rules (design §5 and §7.3). The model judges understanding,
// this reducer decides what happens next. Pure: no I/O, no clock (time comes in actions).

/**
 * @typedef {{ id: string, page: number, text: string, origin: 'text' | 'transcription' }} Passage
 * @typedef {{ id: string, title: string, objective: string, checkQuestion: string, passageIds: string[] }} Step
 * @typedef {{ title: string, brief: object, steps: Step[] }} LessonPlan
 * @typedef {{ status: 'done' | 'explained' | 'current' | 'todo', misses: number, turns: number }} StepProgress
 * @typedef {{
 *   stepIndex: number,
 *   steps: StepProgress[],
 *   status: 'teaching' | 'wrapping-up' | 'complete',
 *   pendingAuto: 'introduce' | 'wrap-up' | null,
 *   startedAt: number,
 * }} Progress
 * @typedef {{
 *   id: string,
 *   role: 'tutor' | 'student',
 *   text: string,
 *   stepId: string,
 *   mode?: 'introduce' | 'guide' | 'explain' | 'wrap-up',
 *   passageIds?: string[],
 *   state: 'streaming' | 'done' | 'stopped' | 'failed',
 *   error?: { code: string, message: string, retryAfterSeconds?: number },
 * }} Message
 * @typedef {{ document: object, plan: LessonPlan, progress: Progress, messages: Message[], teacherPrompt: string }} LessonState
 * @typedef {{ understanding: 'yes' | 'partial' | 'no' | 'none', passageIds: string[] }} TurnMeta
 */

function freshProgress(stepCount, now) {
  return {
    stepIndex: 0,
    steps: Array.from({ length: stepCount }, (_, i) => ({
      status: i === 0 ? 'current' : 'todo',
      misses: 0,
      turns: 0,
    })),
    status: 'teaching',
    pendingAuto: 'introduce',
    startedAt: now,
  }
}

function updateCurrentStep(progress, changes) {
  const steps = progress.steps.map((step, i) =>
    i === progress.stepIndex ? { ...step, ...changes } : step,
  )
  return { ...progress, steps }
}

// Closes the current step with `status` ('done' or 'explained') and asks the UI for the next
// automatic turn: introduce the next step, or wrap up after the last one.
function advance(progress, status) {
  const closed = updateCurrentStep(progress, { status })
  const nextIndex = progress.stepIndex + 1
  if (nextIndex === progress.steps.length) {
    return { ...closed, status: 'wrapping-up', pendingAuto: 'wrap-up' }
  }
  const opened = updateCurrentStep({ ...closed, stepIndex: nextIndex }, { status: 'current' })
  return { ...opened, pendingAuto: 'introduce' }
}

// Rules of design §7.3 for a tutor turn that streamed to the end.
function progressAfterTurn(progress, mode, meta) {
  if (mode === 'explain') return advance(progress, 'explained')
  if (mode === 'wrap-up') return { ...progress, status: 'complete' }
  if (mode !== 'guide' || !meta) return progress
  if (meta.understanding === 'yes') return advance(progress, 'done')
  if (meta.understanding === 'partial' || meta.understanding === 'no') {
    const misses = progress.steps[progress.stepIndex].misses + 1
    // The last attempt's reply already explained the answer (lastAttempt in the request).
    const counted = updateCurrentStep(progress, { misses })
    return misses >= MAX_MISSES ? advance(counted, 'explained') : counted
  }
  return progress
}

function updateMessage(state, id, update) {
  const messages = state.messages.map((message) =>
    message.id === id ? { ...message, ...update(message) } : message,
  )
  return { ...state, messages }
}

const currentStepId = (state) => state.plan.steps[state.progress.stepIndex].id

/**
 * @param {LessonState | null} state
 * @returns {LessonState | null}
 */
export function lessonReducer(state, action) {
  switch (action.type) {
    case 'lessonCreated':
      return {
        document: action.document,
        plan: action.plan,
        teacherPrompt: action.teacherPrompt,
        progress: freshProgress(action.plan.steps.length, action.now),
        messages: [],
      }
    case 'lessonRestarted':
      return {
        ...state,
        progress: freshProgress(state.plan.steps.length, action.now),
        messages: [],
      }
    case 'lessonCleared':
      return null
    case 'lessonRestored':
      return action.state
    case 'studentSent': {
      // Only one turn in flight, and nothing to answer once the lesson is over.
      const busy = state.messages.some((message) => message.state === 'streaming')
      if (busy || state.progress.status === 'complete') return state
      const message = {
        id: action.id,
        role: 'student',
        text: action.text,
        stepId: currentStepId(state),
        state: 'done',
      }
      const { turns } = state.progress.steps[state.progress.stepIndex]
      return {
        ...state,
        messages: [...state.messages, message],
        progress: updateCurrentStep(state.progress, { turns: turns + 1 }),
      }
    }
    case 'tutorStarted': {
      const message = {
        id: action.id,
        role: 'tutor',
        text: '',
        stepId: currentStepId(state),
        mode: action.mode,
        passageIds: [],
        state: 'streaming',
      }
      return {
        ...state,
        messages: [...state.messages, message],
        progress: { ...state.progress, pendingAuto: null },
      }
    }
    case 'tutorDelta':
      return updateMessage(state, action.id, (message) => ({ text: message.text + action.text }))
    case 'tutorFinished': {
      const message = state.messages.find(({ id }) => id === action.id)
      // A late event for a message that is gone (e.g. after a restart) changes nothing.
      if (!message) return state
      const finished = updateMessage(state, action.id, () => ({
        state: 'done',
        passageIds: action.meta?.passageIds ?? [],
      }))
      return { ...finished, progress: progressAfterTurn(state.progress, message.mode, action.meta) }
    }
    // Stopped and failed turns keep their partial text and never change progress.
    case 'tutorStopped':
      return updateMessage(state, action.id, () => ({ state: 'stopped' }))
    case 'tutorFailed':
      return updateMessage(state, action.id, () => ({ state: 'failed', error: action.error }))
    default:
      throw new Error(`Unknown lesson action: ${action.type}`)
  }
}
