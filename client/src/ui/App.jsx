import { Suspense, lazy, useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { getConfig } from '../api/client.js'
import { getKey } from '../api/keyStore.js'
import { loadLesson, saveLesson } from '../lesson/persistence.js'
import { lessonReducer } from '../lesson/reducer.js'
import ErrorNotice from './ErrorNotice.jsx'
import SettingsDialog from './SettingsDialog.jsx'
import SetupScreen from './SetupScreen.jsx'

// The lesson screen (with react-markdown and KaTeX) is a separate chunk, so the setup screen
// loads fast. If the chunk cannot be downloaded (new deploy, connection lost), say so and offer
// a reload instead of crashing; the lesson is safe in sessionStorage.
function LessonCodeMissing({ appBar }) {
  return (
    <>
      {appBar}
      <div className="mx-auto w-full max-w-2xl px-4 pt-8 sm:px-6">
        <ErrorNotice
          error={{ code: 'INTERNAL', reloadNeeded: true }}
          onAction={() => window.location.reload()}
        />
      </div>
    </>
  )
}

const LessonScreen = lazy(() =>
  import('./LessonScreen.jsx').catch(() => ({ default: LessonCodeMissing })),
)

function LessonLoading() {
  return (
    <p role="status" className="flex flex-1 items-center justify-center text-slate/60">
      Opening the lesson…
    </p>
  )
}

function KeyIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
      <circle cx="7" cy="10" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10.5 10H17M14.5 10v2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

export default function App() {
  const [lesson, dispatch] = useReducer(lessonReducer, null, () => loadLesson())
  const [saved, setSaved] = useState(true)
  const [hasUserKey, setHasUserKey] = useState(() => Boolean(getKey()))
  const [hasServerKey, setHasServerKey] = useState(false)
  // null = closed; otherwise { reason } (reason may be null when the user opened it).
  const [settings, setSettings] = useState(null)

  // Keep the lesson across a reload. A failed save is reported, never silent (design §9).
  // Not while tutor text is streaming in: that would rewrite the whole lesson on every chunk.
  // The save when a turn starts (student message + empty tutor stub) and the one when it ends
  // cover it: a reload mid-answer restores the stub as stopped, with "Continue the lesson".
  const skipSave =
    lesson !== null && lesson.messages.some(({ state, text }) => state === 'streaming' && text)
  useEffect(() => {
    if (skipSave) return
    // The outcome of the write is only known after it happens, so it has to be stored here;
    // it costs one extra render per lesson change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(saveLesson(lesson).ok)
  }, [lesson, skipSave])

  // Does the host have its own key? If not and the user has none, ask for one right away.
  useEffect(() => {
    const controller = new AbortController()
    getConfig({ signal: controller.signal })
      .then((config) => {
        setHasServerKey(config.hasServerKey)
        if (!config.hasServerKey && !getKey()) setSettings({ reason: null })
      })
      .catch(() => {
        // Aborted, or the server is unreachable: the first build will surface the real error.
      })
    return () => controller.abort()
  }, [])

  // Page images of transcribed pages, { [page]: objectUrl }: in memory only, never persisted, so
  // after a reload the source panel says the image is not available. The old images are freed
  // when a lesson replaces them or ends.
  const [pageImages, setPageImages] = useState({})
  const pageImagesRef = useRef(pageImages)
  const replacePageImages = useCallback((next) => {
    Object.values(pageImagesRef.current).forEach((url) => URL.revokeObjectURL(url))
    pageImagesRef.current = next
    setPageImages(next)
  }, [])
  useEffect(
    () => () => Object.values(pageImagesRef.current).forEach((url) => URL.revokeObjectURL(url)),
    [],
  )
  const lessonDispatch = useCallback(
    (action) => {
      if (action.type === 'lessonCleared') replacePageImages({})
      dispatch(action)
    },
    [replacePageImages],
  )

  const openSettings = useCallback((reason) => setSettings({ reason }), [])
  const closeSettings = useCallback(() => setSettings(null), [])

  const handleLessonReady = useCallback(
    ({ document, plan, pageImages: images, teacherPrompt }) => {
      replacePageImages(images)
      dispatch({ type: 'lessonCreated', document, plan, teacherPrompt, now: Date.now() })
    },
    [replacePageImages],
  )

  const hasKey = hasUserKey || hasServerKey
  const keyLabel = hasUserKey ? 'Key set' : hasServerKey ? 'Server key' : 'Add API key'

  const appBar = (
    <>
      <header className="shrink-0 border-b border-surface">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <span className="flex items-center gap-2 font-semibold text-teal">
            <span aria-hidden="true" className="size-2.5 rounded-full bg-amber" />
            Teach Me This File
          </span>
          <button
            type="button"
            onClick={() => openSettings(null)}
            aria-label={`API key settings: ${keyLabel}`}
            className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium ${
              hasKey
                ? 'bg-surface text-slate hover:bg-teal-pale/40'
                : 'bg-amber text-slate hover:bg-amber/85'
            }`}
          >
            <KeyIcon />
            {keyLabel}
          </button>
        </div>
      </header>

      {!saved && lesson && (
        <p role="status" className="bg-amber/15 px-4 py-2 text-center text-sm">
          This lesson is too large to survive a page refresh.
        </p>
      )}
    </>
  )

  return (
    <div className="flex min-h-dvh flex-col">
      {lesson ? (
        // The lesson fills the screen (its chat scrolls inside) and places the app bar itself.
        <Suspense
          fallback={
            <>
              {appBar}
              <LessonLoading />
            </>
          }
        >
          <LessonScreen
            lesson={lesson}
            dispatch={lessonDispatch}
            pageImages={pageImages}
            appBar={appBar}
            onOpenSettings={openSettings}
          />
        </Suspense>
      ) : (
        <>
          {appBar}
          <SetupScreen
            hasKey={hasKey}
            onOpenSettings={openSettings}
            onLessonReady={handleLessonReady}
          />
        </>
      )}

      {settings && (
        <SettingsDialog
          reason={settings.reason}
          hasServerKey={hasServerKey}
          onClose={closeSettings}
          onKeyChange={() => setHasUserKey(Boolean(getKey()))}
        />
      )}
    </div>
  )
}
