// A running stage with an optional "n of m" count and a Cancel button. Without a count the bar
// slides (or stays still with reduced motion). Not a live region: SetupScreen announces the
// stage once, so screen readers do not hear every page number.
export default function BuildProgress({ label, progress, onCancel }) {
  const percent = progress?.total ? Math.round((progress.done / progress.total) * 100) : null
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-surface p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="font-medium">{label}</p>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-teal hover:bg-teal-pale/40"
        >
          Cancel
        </button>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-teal-pale/50">
        {percent === null ? (
          <div className="h-full w-2/5 animate-[indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-teal" />
        ) : (
          <div className="h-full rounded-full bg-teal" style={{ width: `${percent}%` }} />
        )}
      </div>
    </div>
  )
}
