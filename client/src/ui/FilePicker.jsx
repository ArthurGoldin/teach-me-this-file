import { useEffect, useState } from 'react'

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.txt,.md,application/pdf,image/jpeg,image/png,image/webp'

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6 shrink-0 text-teal" aria-hidden="true">
      <path
        d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z M14 3v5h5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// A real <input type="file"> (keyboard and screen-reader friendly) behind a label that is also
// a drop zone. Once a file is read, it collapses into a one-line summary with "Change file".
// `summary` is the line under the file name, e.g. "12 pages, 2 scanned".
export default function FilePicker({ inputRef, fileName, summary, disabled, onFile }) {
  const [dragging, setDragging] = useState(false)

  // A file dropped just outside the drop zone would make the browser open it and leave the
  // app. Text drags (e.g. into the prompt) are left alone.
  useEffect(() => {
    const ignoreFileDrop = (event) => {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault()
    }
    window.addEventListener('dragover', ignoreFileDrop)
    window.addEventListener('drop', ignoreFileDrop)
    return () => {
      window.removeEventListener('dragover', ignoreFileDrop)
      window.removeEventListener('drop', ignoreFileDrop)
    }
  }, [])

  function handleDrop(event) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files[0]
    if (file && !disabled) onFile(file)
  }

  function handleChange(event) {
    const file = event.target.files[0]
    // Clear the input so picking the same file again still fires a change.
    event.target.value = ''
    if (file) onFile(file)
  }

  const dropProps = {
    onDragOver: (event) => {
      event.preventDefault()
      setDragging(true)
    },
    onDragLeave: () => setDragging(false),
    onDrop: handleDrop,
  }

  return (
    <div>
      <input
        ref={inputRef}
        id="file-input"
        type="file"
        accept={ACCEPT}
        disabled={disabled}
        onChange={handleChange}
        className="peer sr-only"
      />
      {fileName ? (
        <div
          {...dropProps}
          className="flex items-center gap-3 rounded-xl border border-teal-pale bg-white p-4 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal"
        >
          <FileIcon />
          <div className="min-w-0 flex-1">
            <p dir="auto" className="line-clamp-2 font-medium [overflow-wrap:anywhere]">
              {fileName}
            </p>
            {summary && <p className="text-sm text-slate/70">{summary}</p>}
          </div>
          <label
            htmlFor="file-input"
            className="shrink-0 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-teal hover:bg-surface"
          >
            Change file
          </label>
        </div>
      ) : (
        <label
          htmlFor="file-input"
          {...dropProps}
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal ${
            dragging
              ? 'border-teal bg-teal-pale/30'
              : 'border-teal-pale bg-surface hover:border-teal'
          }`}
        >
          <FileIcon />
          <span className="font-medium">
            <span className="text-teal underline underline-offset-2">Choose a file</span> or drop it
            here
          </span>
          <span className="text-sm text-slate/70">PDF, image, TXT or Markdown, up to 50 MB</span>
        </label>
      )}
    </div>
  )
}
