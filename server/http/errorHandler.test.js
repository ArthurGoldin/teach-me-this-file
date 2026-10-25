import { expect, it, vi } from 'vitest'
import { errorHandler } from './errorHandler.js'

it('delegates to Express when headers are already sent', () => {
  const next = vi.fn()
  const res = { headersSent: true, status: vi.fn() }
  const err = new Error('mid-stream')
  errorHandler(err, { path: '/x' }, res, next)
  expect(next).toHaveBeenCalledWith(err)
  expect(res.status).not.toHaveBeenCalled()
})

it('responds with the error body otherwise', () => {
  vi.spyOn(process.stderr, 'write').mockReturnValue(true)
  const json = vi.fn()
  const res = { headersSent: false, status: vi.fn(() => ({ json })) }
  errorHandler({ status: 503 }, { path: '/x' }, res, vi.fn())
  expect(res.status).toHaveBeenCalledWith(503)
  expect(json.mock.calls[0][0].error.code).toBe('MODEL_BUSY')
})
