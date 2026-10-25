import { afterEach, expect, it, vi } from 'vitest'
import { log } from './logger.js'

afterEach(() => vi.restoreAllMocks())

it('keeps allow-listed fields and drops everything else', () => {
  const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  log.info('hit', {
    route: '/x',
    status: 200,
    headers: { 'x-gemini-key': 'k' },
    apiKey: 'AIzaSECRET',
  })
  const line = write.mock.calls[0][0]
  expect(JSON.parse(line)).toEqual({ level: 'info', event: 'hit', route: '/x', status: 200 })
  expect(line).not.toContain('AIzaSECRET')
})
