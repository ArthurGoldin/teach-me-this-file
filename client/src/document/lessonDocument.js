import { chunkPages } from './chunk.js'
import { DocumentError } from './errors.js'

// Assembles the LessonDocument (design section 5) from the pages chosen for the lesson.
export function buildLessonDocument({ name, kind, pageCount, range, pages, skipped }) {
  const passages = chunkPages(pages)
  if (passages.length === 0) {
    throw new DocumentError('NO_CONTENT', 'No readable text was found in this file.')
  }
  return { name, kind, pageCount, range, passages, skipped }
}
