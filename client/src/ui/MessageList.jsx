import { useLayoutEffect, useRef, useState } from 'react'
import { passagesFor } from '../lesson/selectors.js'
import MessageBubble from './MessageBubble.jsx'

// How close to the bottom (px) still counts as "following the conversation".
const FOLLOW_SLACK = 80

const lastFinishedTutor = (messages) =>
  messages.findLast(({ role, state }) => role === 'tutor' && state === 'done')

export default function MessageList({ lesson, sourceId, onShowSource, ...actions }) {
  const { messages, document } = lesson
  const scrollRef = useRef(null)
  const followRef = useRef(true)
  // A restored lesson's last message was read before the reload: announce only newer ones.
  const [restoredId] = useState(() => lastFinishedTutor(messages)?.id)
  const announce = lastFinishedTutor(messages)
  const last = messages.at(-1)

  // Keep the newest text in view while it streams, unless the student scrolled up to reread.
  // Sending a message always jumps back down.
  useLayoutEffect(() => {
    const element = scrollRef.current
    if (last?.role === 'student') followRef.current = true
    if (followRef.current) element.scrollTop = element.scrollHeight
  }, [messages.length, last?.role, last?.text, last?.state])

  function handleScroll() {
    const element = scrollRef.current
    const fromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
    followRef.current = fromBottom < FOLLOW_SLACK
  }

  return (
    <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-5 sm:px-6">
        <ol className="flex flex-col gap-4" aria-label="Lesson chat">
          {messages.map((message, i) => (
            <MessageBubble
              key={message.id}
              message={message}
              passages={
                message.role === 'tutor' ? passagesFor(lesson, message.passageIds ?? []) : []
              }
              kind={document.kind}
              isLast={i === messages.length - 1}
              sourceOpen={sourceId === message.id}
              onShowSource={onShowSource}
              {...actions}
            />
          ))}
        </ol>
      </div>
      {/* Screen readers hear each finished tutor message once, not every streamed word. */}
      <p aria-live="polite" className="sr-only">
        {announce && announce.id !== restoredId ? announce.text : ''}
      </p>
    </div>
  )
}
