// The lesson plan drawn as a route (design §11): one stop per step, teal behind, an amber
// "you are here", pale ahead. Logical flex layout, so it runs right to left in an RTL lesson.
const STATUS_TEXT = { done: 'done', explained: 'explained', todo: 'not started' }

function Stop({ status }) {
  if (status === 'current') {
    return (
      <span className="flex size-5 items-center justify-center rounded-full bg-amber/25 ring-2 ring-amber">
        <span className="size-2 rounded-full bg-amber" />
      </span>
    )
  }
  if (status === 'todo') {
    return <span className="size-3 rounded-full border-2 border-teal-pale bg-white" />
  }
  // done and explained: the student has passed this stop either way.
  return <span className="size-3 rounded-full bg-teal" />
}

export default function RouteLine({ steps, progress }) {
  const count = steps.length
  return (
    <ol className="flex items-center" aria-label="Lesson route">
      {steps.map((step, i) => {
        const { status } = progress.steps[i]
        const current = status === 'current'
        const label = `Step ${i + 1} of ${count}: ${step.title}`
        // The segment before a stop is teal once the student reached that stop.
        const reached = status !== 'todo'
        return (
          <li
            key={step.id}
            className={`flex items-center ${i === 0 ? '' : 'flex-1'}`}
            aria-label={current ? label : `${label}, ${STATUS_TEXT[status]}`}
            aria-current={current ? 'step' : undefined}
          >
            {i > 0 && (
              <span
                aria-hidden="true"
                className={`h-0.5 flex-1 rounded-full ${reached ? 'bg-teal' : 'bg-teal-pale/70'}`}
              />
            )}
            <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center">
              <Stop status={status} />
            </span>
          </li>
        )
      })}
    </ol>
  )
}
