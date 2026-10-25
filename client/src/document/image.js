// Page images sent for transcription: long side at most 1600 px, JPEG quality 0.8.
const MAX_SIDE = 1600
const JPEG_QUALITY = 0.8

// Scale factor that makes the long side exactly MAX_SIDE. PDF pages are vector, so they are
// rendered up to it (sharper text for transcription); photos are only ever scaled down.
export function scaleToFit(width, height, { upscale = false } = {}) {
  const scale = MAX_SIDE / Math.max(width, height)
  return upscale ? scale : Math.min(1, scale)
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

// -> { base64 (no data: prefix), objectUrl (for showing the page), bytes }
export async function canvasToJpeg(canvas) {
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode the page image'))),
      'image/jpeg',
      JPEG_QUALITY,
    ),
  )
  return {
    base64: await blobToBase64(blob),
    objectUrl: URL.createObjectURL(blob),
    bytes: blob.size,
  }
}

// Downsizes a photo or scan (JPEG, PNG, WebP) the same way as a rendered PDF page.
export async function imageFileToJpeg(file) {
  const bitmap = await createImageBitmap(file)
  const scale = scaleToFit(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvasToJpeg(canvas)
}
