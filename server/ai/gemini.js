import { GoogleGenAI } from '@google/genai'
import { AppError, toAppError } from '../http/errors.js'

export const MODEL_ID = 'gemini-3.8-flash'

const BLOCKED = () =>
  new AppError('BLOCKED', 'Gemini declined to answer this. Try rephrasing.', { status: 422 })

export function createGemini({ apiKey }) {
  const ai = new GoogleGenAI({ apiKey })

  async function* streamText({ systemInstruction, contents, signal }) {
    try {
      const stream = await ai.models.generateContentStream({
        model: MODEL_ID,
        contents,
        config: {
          systemInstruction,
          abortSignal: signal,
          thinkingConfig: { thinkingLevel: 'LOW' },
        },
      })
      for await (const chunk of stream) {
        if (chunk.promptFeedback?.blockReason) throw BLOCKED()
        if (chunk.candidates?.[0]?.finishReason === 'SAFETY') throw BLOCKED()
        if (chunk.text) yield chunk.text
      }
    } catch (err) {
      throw toAppError(err)
    }
  }

  async function generateJson({ systemInstruction, contents, schema, signal }) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL_ID,
        contents,
        config: {
          systemInstruction,
          abortSignal: signal,
          thinkingConfig: { thinkingLevel: 'LOW' },
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
        },
      })
      if (response.promptFeedback?.blockReason) throw BLOCKED()
      return JSON.parse(response.text)
    } catch (err) {
      throw toAppError(err)
    }
  }

  return { streamText, generateJson }
}
