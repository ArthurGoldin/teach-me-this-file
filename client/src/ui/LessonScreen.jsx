import { useCallback, useState } from 'react'
import { canStudentSend, isStreaming, passagesFor } from '../lesson/selectors.js'
import Composer from './Composer.jsx'
import LessonHeader from './LessonHeader.jsx'
import MessageList from './MessageList.jsx'
import SourcePanel from './SourcePanel.jsx'
import { textDirection } from './lessonFormat.js'
import { useTutor } from './useTutor.js'

function LessonComplete({ onRestart, onNewLesson }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
      <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 font-semibold">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-amber" />
          Lesson complete
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRestart}
            className="rounded-xl border border-teal px-4 py-2 font-medium text-teal hover:bg-teal hover:text-white"
          >
            Restart lesson
          </button>
          <button
            type="button"
            onClick={onNewLesson}
            className="rounded-xl bg-teal px-4 py-2 font-medium text-white hover:bg-teal/90"
          >
            New lesson
          </button>
        </div>
      </div>
    </div>
  )
}

// The lesson: route header, chat, composer, and the source of any tutor message.
// The whole screen follows the lesson language's direction, so a Hebrew lesson mirrors.
// `appBar` (the app's title bar) sits on top of the chat column, so on wide screens the source
// panel runs the full height beside both and the bar stays aligned with the chat.
export default function LessonScreen({ lesson, dispatch, pageImages, appBar, onOpenSettings }) {
  const tutor = useTutor(lesson, dispatch)
  const [sourceId, setSourceId] = useState(null)
  const closeSource = useCallback(() => setSourceId(null), [])

  const { progress, messages } = lesson
  const streaming = isStreaming(lesson)
  const complete = progress.status === 'complete'
  const sourceMessage = messages.find(({ id }) => id === sourceId)
  const sourcePassages = sourceMessage ? passagesFor(lesson, sourceMessage.passageIds ?? []) : []

  const newLesson = () => dispatch({ type: 'lessonCleared' })

  return (
    <div dir={textDirection(lesson.plan.brief?.language)} className="flex h-dvh">
      <div className="flex min-w-0 flex-1 flex-col">
        <div dir="ltr" className="shrink-0">
          {appBar}
        </div>
        <main className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-surface">
            <LessonHeader lesson={lesson} onNewLesson={newLesson} />
          </div>
          <MessageList
            lesson={lesson}
            sourceId={sourceId}
            onShowSource={(id) => setSourceId(id === sourceId ? null : id)}
            onRetry={tutor.retry}
            onOpenSettings={() => onOpenSettings(null)}
          />
          <div className="shrink-0 border-t border-surface">
            {complete ? (
              <LessonComplete
                onRestart={() => {
                  setSourceId(null)
                  dispatch({ type: 'lessonRestarted', now: Date.now() })
                }}
                onNewLesson={newLesson}
              />
            ) : (
              <Composer
                streaming={streaming}
                locked={!canStudentSend(lesson)}
                onSend={tutor.send}
                onStop={tutor.stop}
              />
            )}
          </div>
        </main>
      </div>
      {sourcePassages.length > 0 && (
        <SourcePanel
          passages={sourcePassages}
          kind={lesson.document.kind}
          pageImages={pageImages}
          onClose={closeSource}
        />
      )}
    </div>
  )
}
