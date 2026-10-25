import { describe, expect, it } from 'vitest'
import { scaleToFit } from './image.js'

describe('scaleToFit', () => {
  it('brings the long side down to 1600 px', () => {
    expect(scaleToFit(3200, 1000)).toBe(0.5)
    expect(scaleToFit(1000, 4000)).toBe(0.4)
  })

  it('never scales a small image up', () => {
    expect(scaleToFit(800, 600)).toBe(1)
  })

  it('renders a small vector page up to 1600 px when asked', () => {
    expect(scaleToFit(800, 600, { upscale: true })).toBe(2)
  })
})
