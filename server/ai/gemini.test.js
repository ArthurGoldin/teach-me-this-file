import { beforeEach, describe, expect, it, vi } from 'vitest'

const generateContent = vi.fn()
const generateContentStream = vi.fn()
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent, generateContentStream }
  },
}))

const { createGemini } = await import('./gemini.js')
const gemini = createGemini({ apiKey: 'test' })
const args = { systemInstruction: 's', contents: [], schema: {} }

beforeEach(() => vi.resetAllMocks())

describe('generateJson', () => {
  it('parses a JSON response', async () => {
    generateContent.mockResolvedValue({ text: '{"ok":true}' })
    expect(await gemini.generateJson(args)).toEqual({ ok: true })
  })

  it.each([
    [{ promptFeedback: { blockReason: 'SAFETY' } }],
    [{ candidates: [{ finishReason: 'PROHIBITED_CONTENT' }] }],
  ])('reports a block as BLOCKED', async (response) => {
    generateContent.mockResolvedValue(response)
    await expect(gemini.generateJson(args)).rejects.toMatchObject({ code: 'BLOCKED' })
  })

  it.each([[undefined], ['not json']])('reports text %j as PLAN_INVALID', async (text) => {
    generateContent.mockResolvedValue({ text })
    await expect(gemini.generateJson(args)).rejects.toMatchObject({ code: 'PLAN_INVALID' })
  })
})

describe('streamText', () => {
  it('throws BLOCKED on a blocking finish reason', async () => {
    generateContentStream.mockResolvedValue(
      (async function* () {
        yield { text: 'a' }
        yield { candidates: [{ finishReason: 'RECITATION' }] }
      })(),
    )
    const seen = []
    await expect(
      (async () => {
        for await (const t of gemini.streamText(args)) seen.push(t)
      })(),
    ).rejects.toMatchObject({ code: 'BLOCKED' })
    expect(seen).toEqual(['a'])
  })
})
