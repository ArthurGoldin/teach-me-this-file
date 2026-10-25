import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
// Vite copies the worker file into the build and gives us its URL, so parsing runs off the main thread.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { canvasToJpeg, scaleToFit } from './image.js'

GlobalWorkerOptions.workerSrc = workerUrl

// Thin wrapper over pdf.js: page text and page images, nothing else.
// Throws whatever pdf.js throws (corrupt file, password); readFile maps that to CORRUPT_FILE.
export async function openPdf(arrayBuffer) {
  const pdf = await getDocument({ data: arrayBuffer }).promise

  async function getPageText(n) {
    const page = await pdf.getPage(n)
    const { items } = await page.getTextContent()
    // Items without `str` are marked-content markers. hasEOL marks the end of a text line.
    return items.map((item) => (item.str ?? '') + (item.hasEOL ? '\n' : '')).join('')
  }

  async function renderPageJpeg(n) {
    const page = await pdf.getPage(n)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({
      scale: scaleToFit(base.width, base.height, { upscale: true }),
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    await page.render({ canvas, viewport }).promise
    return canvasToJpeg(canvas)
  }

  return { pageCount: pdf.numPages, getPageText, renderPageJpeg }
}
