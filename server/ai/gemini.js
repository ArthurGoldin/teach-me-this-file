import { GoogleGenAI } from '@google/genai'
import { appError, toAppError } from '../http/errors.js'

const MODEL_ID = 'gemini-3.5-flash-lite'

const BLOCKING_FINISH_REASONS = new Set([
  'SAFETY',
  'PROHIBITED_CONTENT',
  'BLOCKLIST',
  'SPII',
  'RECITATION',
])

function isBlocked(response) {
  return (
    Boolean(response.promptFeedback?.blockReason) ||
    BLOCKING_FINISH_REASONS.has(response.candidates?.[0]?.finishReason)
  )
}

export function createGemini({ apiKey }) {
  const ai = new GoogleGenAI({ apiKey })
  const thinkingConfig = { thinkingLevel: 'LOW' }

  async function* streamText({ systemInstruction, contents, signal }) {
    try {
      const stream = await ai.models.generateContentStream({
        model: MODEL_ID,
        contents,
        config: { systemInstruction, abortSignal: signal, thinkingConfig },
      })
      for await (const chunk of stream) {
        if (isBlocked(chunk)) throw appError('BLOCKED')
        if (chunk.text) yield chunk.text
      }
    } catch (err) {
      throw toAppError(err)
    }
  }

  // `invalidCode`: the error code for an answer that is not JSON (each endpoint has its own copy).
  async function generateJson({
    systemInstruction,
    contents,
    schema,
    signal,
    invalidCode = 'PLAN_INVALID',
  }) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL_ID,
        contents,
        config: {
          systemInstruction,
          abortSignal: signal,
          thinkingConfig,
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
        },
      })
      if (isBlocked(response)) throw appError('BLOCKED')
      try {
        return JSON.parse(response.text)
      } catch {
        throw appError(invalidCode)
      }
    } catch (err) {
      throw toAppError(err)
    }
  }

  return { streamText, generateJson }
}
