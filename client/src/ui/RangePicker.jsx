import { MAX_SCAN_PAGES, checkRange } from '../document/budget.js'

// Shown when the whole file does not fit in one lesson. `unit` is "page" or "section".
export default function RangePicker({ raw, range, onChange, unit }) {
  const { ok, inBounds, scanPages } = checkRange(raw.pages, range)
  const last = raw.pages.at(-1).page

  function update(field, value) {
    const number = Number.parseInt(value, 10)
    if (Number.isNaN(number)) return
    onChange({ ...range, [field]: number })
  }

  let status = `This lesson uses ${unit}s ${range.from}–${range.to} of ${raw.pageCount}.`
  if (!inBounds) status = `Pick ${unit}s between 1 and ${last}, with "from" before "to".`
  else if (!ok) {
    status =
      scanPages > MAX_SCAN_PAGES
        ? `That range has more than ${MAX_SCAN_PAGES} scanned pages. Pick fewer.`
        : `That range is too long for one lesson. Pick fewer ${unit}s.`
  }

  return (
    <fieldset className="flex flex-col gap-3 rounded-xl border border-teal-pale bg-white p-4">
      <legend className="px-1 font-medium">Choose the part to teach</legend>
      <p className="text-sm text-slate/75">
        This file is too long for one lesson, so the lesson covers part of it.
      </p>
      <div className="flex flex-wrap gap-4">
        {['from', 'to'].map((field) => (
          <label key={field} className="flex flex-col gap-1 text-sm">
            {field === 'from' ? `From ${unit}` : `To ${unit}`}
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={last}
              value={range[field]}
              onChange={(event) => update(field, event.target.value)}
              className="w-28 rounded-lg border border-slate/25 px-3 py-2 text-base"
            />
          </label>
        ))}
      </div>
      <p aria-live="polite" className={`text-sm ${ok ? 'text-teal' : 'font-medium'}`}>
        {status}
      </p>
    </fieldset>
  )
}
