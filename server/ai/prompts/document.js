// The file's text is untrusted. Any tag that could close or fake our <document>/<passage>
// wrapper is escaped, so the model always sees passage text as data inside one block.
const WRAPPER_TAG = /<(\/?)(document|passage)/gi

function neutralise(text) {
  return text.replace(WRAPPER_TAG, '&lt;$1$2')
}

export function formatDocument(passages) {
  const blocks = passages.map(
    ({ id, page, text }) => `<passage id="${id}" page="${page}">\n${neutralise(text)}\n</passage>`,
  )
  return `<document>\n${blocks.join('\n')}\n</document>`
}
