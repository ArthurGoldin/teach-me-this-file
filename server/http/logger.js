// The only place the server writes logs. Only allow-listed fields are kept, so request
// headers, bodies and keys can never reach the output.
const ALLOWED_FIELDS = [
  'route',
  'status',
  'durationMs',
  'code',
  'pages',
  'steps',
  'model',
  'mode',
  'metaSource',
  'gradeCode',
]

function write(stream, level, event, fields = {}) {
  const kept = Object.fromEntries(
    Object.entries(fields).filter(([key]) => ALLOWED_FIELDS.includes(key)),
  )
  stream.write(`${JSON.stringify({ level, event, ...kept })}\n`)
}

export const log = {
  info: (event, fields) => write(process.stdout, 'info', event, fields),
  warn: (event, fields) => write(process.stderr, 'warn', event, fields),
  error: (event, fields) => write(process.stderr, 'error', event, fields),
}
