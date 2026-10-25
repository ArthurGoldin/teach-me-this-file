import { badRequest } from '../../http/errors.js'

const PASSAGE_ID = /^[\w-]{1,32}$/

// Untrusted or model-written text must not close or fake the prompt's own wrapper tags
// (<document>, <passage>, <teacher_instructions>). Escaping their `<` keeps such text as data.
const WRAPPER_TAG = /<(\/?)(document|passage|teacher_instructions)/gi

export function neutralise(text) {
  return text.replace(WRAPPER_TAG, '&lt;$1$2')
}

// Throws a 400 AppError unless the passage has a safe id, a page number and text.
export function checkPassage(passage) {
  if (typeof passage !== 'object' || passage === null || !PASSAGE_ID.test(passage.id ?? '')) {
    throw badRequest('bad passage id')
  }
  if (!Number.isInteger(passage.page) || passage.page < 1) throw badRequest('bad passage page')
  if (typeof passage.text !== 'string') throw badRequest('bad passage text')
}

export function formatDocument(passages) {
  const blocks = passages.map(
    ({ id, page, text }) => `<passage id="${id}" page="${page}">\n${neutralise(text)}\n</passage>`,
  )
  return `<document>\n${blocks.join('\n')}\n</document>`
}
