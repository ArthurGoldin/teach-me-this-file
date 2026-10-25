import { DocumentError } from './errors.js'
import { imageFileToJpeg } from './image.js'
import { isScanPage, splitTextIntoSections } from './pages.js'

const MAX_FILE_BYTES = 50 * 1024 * 1024

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// Extension first, MIME type as a fallback (some systems send an empty type).
function kindOf(file) {
  const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : ''
  if (ext === 'pdf' || file.type === 'application/pdf') return 'pdf'
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext) || IMAGE_TYPES.includes(file.type)) {
    return 'image'
  }
  if (['txt', 'md'].includes(ext) || ['text/plain', 'text/markdown'].includes(file.type)) {
    return 'text'
  }
  return null
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
}

async function readPdf(file, { onProgress, signal }) {
  // pdf.js is large (~450 kB): load it only when a PDF is picked, so the first screen stays fast.
  const { openPdf } = await import('./pdf.js')
  let pdf
  try {
    pdf = await openPdf(await file.arrayBuffer())
  } catch {
    // pdf.js throws for broken files and for password-protected ones alike.
    throw new DocumentError('CORRUPT_FILE', 'This PDF could not be opened.')
  }
  const pages = []
  for (let page = 1; page <= pdf.pageCount; page += 1) {
    throwIfAborted(signal)
    onProgress?.({ done: page - 1, total: pdf.pageCount })
    const text = await pdf.getPageText(page)
    pages.push({ page, text, isScan: isScanPage(text) })
  }
  return { kind: 'pdf', pageCount: pdf.pageCount, pages, renderPageJpeg: pdf.renderPageJpeg }
}

async function readText(file) {
  const sections = splitTextIntoSections(await file.text())
  if (sections.length === 0) {
    throw new DocumentError('NO_CONTENT', 'This file is empty.')
  }
  return {
    kind: 'text',
    pageCount: sections.length,
    pages: sections.map((text, i) => ({ page: i + 1, text, isScan: false })),
    renderPageJpeg: () => {
      throw new Error('Text files have no page images.')
    },
  }
}

function readImage(file) {
  return {
    kind: 'image',
    pageCount: 1,
    pages: [{ page: 1, text: '', isScan: true }],
    renderPageJpeg: () => imageFileToJpeg(file),
  }
}

// Reads a picked file into pages (design §6.1). Browser only: pdf.js worker, canvas.
// -> RawDocument { name, kind, pageCount, pages: [{ page, text, isScan }], renderPageJpeg(page) }
export async function readFile(file, { onProgress, signal } = {}) {
  const kind = kindOf(file)
  if (!kind) throw new DocumentError('UNSUPPORTED_FILE', 'This file type is not supported.')
  if (file.size > MAX_FILE_BYTES) throw new DocumentError('FILE_TOO_LARGE', 'File is over 50 MB.')

  const readers = { pdf: readPdf, text: readText, image: readImage }
  const raw = await readers[kind](file, { onProgress, signal })
  return { name: file.name, ...raw }
}
