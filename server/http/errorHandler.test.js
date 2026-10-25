import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AppError } from './errors.js'
import { errorHandler } from './errorHandler.js'

beforeEach(() => {
  vi.spyOn(process.stderr, 'write').mockReturnValue(true)
  vi.spyOn(process.stdout, 'write').mockReturnValue(true)
})

afterEach(() => vi.restoreAllMocks())

const logged = () => process.stdout.write.mock.calls.map(([line]) => String(line)).join('')

it('delegates to Express when headers are already sent', () => {
  const next = vi.fn()
  const res = { headersSent: true, status: vi.fn() }
  const err = new Error('mid-stream')
  errorHandler(err, { path: '/x' }, res, next)
  expect(next).toHaveBeenCalledWith(err)
  expect(res.status).not.toHaveBeenCalled()
})

it('responds with the error body otherwise', () => {
  const json = vi.fn()
  const res = { headersSent: false, status: vi.fn(() => ({ json })) }
  errorHandler({ status: 503 }, { path: '/x' }, res, vi.fn())
  expect(res.status).toHaveBeenCalledWith(503)
  expect(json.mock.calls[0][0].error.code).toBe('MODEL_BUSY')
})

it.each([
  [
    'an aborted request',
    new AppError('ABORTED', 'Request aborted', { status: 499 }),
    {},
    'ABORTED',
  ],
  ['a destroyed response', { status: 503 }, { destroyed: true }, 'MODEL_BUSY'],
])('writes nothing for %s and logs its code', (_, err, resFields, code) => {
  const next = vi.fn()
  const res = { headersSent: false, status: vi.fn(), ...resFields }
  errorHandler(err, { path: '/api/plan' }, res, next)
  expect(res.status).not.toHaveBeenCalled()
  expect(next).not.toHaveBeenCalled()
  expect(logged()).toContain('"event":"request_aborted"')
  expect(logged()).toContain(`"code":"${code}"`)
})
