import { describe, it, expect } from 'vitest'
import { LESSON_KEY, loadLesson, saveLesson } from './persistence.js'
import { lessonReducer } from './reducer.js'
import { newLesson, studentSays, tutorTurn } from './testLesson.js'

function fakeStorage() {
  const data = new Map()
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
  }
}

describe('lesson persistence', () => {
  it('saves and loads a lesson', () => {
    const storage = fakeStorage()
    const state = studentSays(tutorTurn(newLesson(), 'introduce', null))
    expect(saveLesson(state, storage)).toEqual({ ok: true })
    expect(loadLesson(storage)).toEqual(state)
  })

  it('removes the saved lesson when the state is null', () => {
    const storage = fakeStorage()
    saveLesson(newLesson(), storage)
    expect(saveLesson(null, storage)).toEqual({ ok: true })
    expect(storage.getItem(LESSON_KEY)).toBeNull()
  })

  it('returns ok: false when storage is full', () => {
    const storage = {
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError')
      },
    }
    expect(saveLesson(newLesson(), storage)).toEqual({ ok: false })
  })

  it('loads a streaming message as stopped', () => {
    const storage = fakeStorage()
    let state = lessonReducer(newLesson(), { type: 'tutorStarted', id: 't1', mode: 'introduce' })
    state = lessonReducer(state, { type: 'tutorDelta', id: 't1', text: 'Half' })
    saveLesson(state, storage)
    expect(loadLesson(storage).messages[0]).toMatchObject({ text: 'Half', state: 'stopped' })
  })

  it('returns null for nothing saved, a wrong version or bad JSON', () => {
    const storage = fakeStorage()
    expect(loadLesson(storage)).toBeNull()
    storage.setItem(LESSON_KEY, JSON.stringify({ version: 2, state: newLesson() }))
    expect(loadLesson(storage)).toBeNull()
    storage.setItem(LESSON_KEY, '{not json')
    expect(loadLesson(storage)).toBeNull()
  })
})
