import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { streamTutor } from '../api/client.js'
import { lessonReducer } from '../lesson/reducer.js'
import { buildTutorInput, isStreaming, nextStudentTurnMode } from '../lesson/selectors.js'

// Runs tutor turns against /api/tutor and turns the stream into lesson actions (design §8).
// The reducer decides what happens next; this hook only does the I/O. At most one turn is in
// flight: its AbortController is the only one, Stop aborts it, and so does unmounting.
export function useTutor(state, dispatch) {
  // The latest state, for callbacks that run after a render (timers, the send handler).
  const stateRef = useRef(state)
  useLayoutEffect(() => {
    stateRef.current = state
  })
  const controllerRef = useRef(null)
  const disposedRef = useRef(false)

  // Starts one turn from `lesson`, which must already contain the student message it answers.
  const runTurn = useCallback(
    async (lesson, mode) => {
      const id = crypto.randomUUID()
      const controller = new AbortController()
      controllerRef.current = controller
      const input = buildTutorInput(lesson, mode, Date.now())
      dispatch({ type: 'tutorStarted', id, mode })
      let meta = null
      try {
        await streamTutor(input, {
          signal: controller.signal,
          onDelta: (text) => dispatch({ type: 'tutorDelta', id, text }),
          onMeta: (value) => {
            meta = value
          },
        })
        dispatch({ type: 'tutorFinished', id, meta })
      } catch (err) {
        // After unmount (New lesson) there is no lesson left to update.
        if (disposedRef.current) return
        if (err?.name === 'AbortError') {
          dispatch({ type: 'tutorStopped', id })
        } else {
          const { code = 'INTERNAL', message = '', retryAfterSeconds } = err ?? {}
          // `at` lets the rate-limit countdown (useSecondsLeft) survive a re-render or reload.
          const error = { code, message, retryAfterSeconds, at: Date.now() }
          dispatch({ type: 'tutorFailed', id, error })
        }
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null
      }
    },
    [dispatch],
  )

  useEffect(() => {
    disposedRef.current = false
    return () => {
      disposedRef.current = true
      controllerRef.current?.abort()
    }
  }, [])

  // Automatic turns (introduce a step, wrap up). Started from a zero-delay timer that the
  // effect cleanup cancels, so React StrictMode's mount-unmount-mount starts it only once.
  const pendingAuto = state.progress.pendingAuto
  const streaming = isStreaming(state)
  useEffect(() => {
    if (!pendingAuto || streaming) return undefined
    const timer = setTimeout(() => runTurn(stateRef.current, pendingAuto), 0)
    return () => clearTimeout(timer)
  }, [pendingAuto, streaming, runTurn])

  const send = useCallback(
    (text) => {
      if (controllerRef.current) return
      const action = { type: 'studentSent', id: crypto.randomUUID(), text }
      // The request must include the new message, so it is built from the state after it.
      const next = lessonReducer(stateRef.current, action)
      // The reducer refuses a message while a turn streams or after the lesson ended.
      if (next === stateRef.current) return
      dispatch(action)
      runTurn(next, nextStudentTurnMode(next))
    },
    [dispatch, runTurn],
  )

  const stop = useCallback(() => controllerRef.current?.abort(), [])

  // Re-runs a failed turn, or a stopped automatic one, in the same mode. Neither changed
  // progress, so the current step is still that message's step, and the history still ends
  // where it did (failed turns are left out of it).
  const retry = useCallback(
    (messageId) => {
      const lesson = stateRef.current
      const message = lesson.messages.find(({ id }) => id === messageId)
      const rerunnable = message?.state === 'failed' || message?.state === 'stopped'
      if (!rerunnable || controllerRef.current) return
      runTurn(lesson, message.mode)
    },
    [runTurn],
  )

  return { send, stop, retry }
}
