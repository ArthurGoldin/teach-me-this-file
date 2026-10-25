// Page images go to /api/transcribe in batches whose JSON body stays under the hosting limit
// (Vercel: 4.5 MB per request; we keep 3 MB). base64 is ASCII, so its length is its size in
// bytes; 64 bytes per item cover the JSON around it ({"page":12,"imageBase64":"..."}).
const MAX_BODY_BYTES = 3_000_000
const ITEM_OVERHEAD = 64
const MAX_ITEMS = 8 // the server's limit per request

const sizeOf = (item) => item.base64.length + ITEM_OVERHEAD

// An image this large cannot be sent in any request.
export const fitsInRequest = (item) => sizeOf(item) <= MAX_BODY_BYTES

// Greedy, in order: add items to the current batch while it fits, else start a new one.
// A single item over the limit ends up alone in its batch.
export function makeBatches(items, maxBytes = MAX_BODY_BYTES) {
  const batches = []
  let current = []
  let bytes = 0
  for (const item of items) {
    const size = sizeOf(item)
    if (current.length > 0 && (bytes + size > maxBytes || current.length === MAX_ITEMS)) {
      batches.push(current)
      current = []
      bytes = 0
    }
    current.push(item)
    bytes += size
  }
  if (current.length > 0) batches.push(current)
  return batches
}
