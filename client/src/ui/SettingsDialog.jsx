import { useEffect, useRef, useState } from 'react'
import { clearKey, getKey, isRemembered, setKey } from '../api/keyStore.js'

// API key settings (design §10, §11 screen 4). The key stays in memory, or in sessionStorage
// when "Remember for this tab" is ticked. It is never shown back, only replaced or removed.
export default function SettingsDialog({ reason, hasServerKey, onClose, onKeyChange }) {
  const dialogRef = useRef(null)
  const inputRef = useRef(null)
  const [draft, setDraft] = useState('')
  const [remember, setRemember] = useState(isRemembered)
  const hasKey = Boolean(getKey())

  // Mounted only while open (see App), so `remember` and the draft start fresh each time.
  // The native <dialog> gives focus trapping, Escape and the backdrop for free.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog.open) dialog.showModal()
    // Start on the key field rather than the close button.
    inputRef.current.focus()
  }, [])

  function handleSubmit(event) {
    event.preventDefault()
    const key = draft.trim()
    if (key) setKey(key, { remember })
    else if (hasKey) setKey(getKey(), { remember })
    setDraft('')
    onKeyChange()
    onClose()
  }

  function handleRemove() {
    clearKey()
    setDraft('')
    onKeyChange()
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="settings-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 text-slate shadow-xl backdrop:bg-slate/50"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id="settings-title" className="text-xl font-semibold">
            Gemini API key
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="-me-2 -mt-1 rounded-full p-2 text-slate/70 hover:bg-surface hover:text-slate"
          >
            <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </button>
        </div>

        {reason && (
          <p role="alert" className="rounded-lg bg-amber/15 px-4 py-3 text-sm leading-relaxed">
            {reason}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="api-key" className="font-medium">
            {hasKey ? 'Replace your key' : 'Paste your key'}
          </label>
          <input
            id="api-key"
            ref={inputRef}
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-describedby="api-key-status"
            className="rounded-lg border border-slate/25 bg-white px-3 py-2.5 text-base outline-none focus-visible:border-teal focus-visible:outline-2 focus-visible:outline-offset-0"
          />
          <p id="api-key-status" className="text-sm text-slate/70">
            {hasKey
              ? 'A key is set for this tab.'
              : hasServerKey
                ? 'This server has its own key. Add yours to use your own quota.'
                : 'The app needs a key to build and teach lessons.'}
          </p>
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="self-start text-sm font-medium text-teal underline underline-offset-2"
          >
            Get a free key in Google AI Studio
          </a>
        </div>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            className="mt-1 size-4 accent-teal"
          />
          <span>
            Remember for this tab
            <span className="block text-sm text-slate/70">
              Kept until you close the tab. Otherwise the key is forgotten on refresh.
            </span>
          </span>
        </label>

        <p className="rounded-lg bg-surface px-4 py-3 text-sm leading-relaxed text-slate/80">
          The key is sent to this app&apos;s server with each request and is never stored there.
          Gemini&apos;s free tier may use what you send to improve Google&apos;s products.
          Don&apos;t upload private student data.
        </p>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {hasKey && (
            <button
              type="button"
              onClick={handleRemove}
              className="me-auto rounded-lg px-3 py-2.5 font-medium text-slate/70 hover:bg-surface hover:text-slate"
            >
              Remove key
            </button>
          )}
          <button
            type="submit"
            disabled={!draft.trim() && !hasKey}
            className="rounded-lg bg-teal px-5 py-2.5 font-medium text-white hover:bg-teal/90 disabled:cursor-not-allowed disabled:bg-slate/15 disabled:text-slate/50"
          >
            Save key
          </button>
        </div>
      </form>
    </dialog>
  )
}
