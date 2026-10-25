// Untrusted or model-written text must not close or fake the prompt's own wrapper tags
// (<document>, <passage>, <teacher_instructions>). Escaping their `<` keeps such text as data.
const WRAPPER_TAG = /<(\/?)(document|passage|teacher_instructions)/gi

export function neutralise(text) {
  return text.replace(WRAPPER_TAG, '&lt;$1$2')
}

export function formatDocument(passages) {
  const blocks = passages.map(
    ({ id, page, text }) => `<passage id="${id}" page="${page}">\n${neutralise(text)}\n</passage>`,
  )
  return `<document>\n${blocks.join('\n')}\n</document>`
}
