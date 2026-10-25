// Placeholder until the chat lands (Task 11): shows the plan that was built.
export default function LessonScreen({ lesson, onNewLesson }) {
  const { plan, document } = lesson
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <p className="text-sm text-slate/70" dir="auto">
        {document.name}
      </p>
      <h1 dir="auto" className="mt-1 text-3xl leading-tight font-semibold">
        {plan.title}
      </h1>
      <ol className="mt-8 flex flex-col gap-3">
        {plan.steps.map((step, i) => (
          <li key={step.id} className="flex gap-3 rounded-xl bg-surface p-4">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-teal text-sm font-semibold text-white">
              {i + 1}
            </span>
            <span dir="auto" className="min-w-0 flex-1 pt-0.5">
              {step.title}
            </span>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={onNewLesson}
        className="mt-8 rounded-xl border border-teal px-5 py-2.5 font-medium text-teal hover:bg-teal hover:text-white"
      >
        New lesson
      </button>
    </main>
  )
}
