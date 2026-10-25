import { useEffect, useState } from 'react'

// Seconds left before a rate-limited request may be retried; 0 when there is nothing to wait
// for. `error.at` is when the request failed.
export function useSecondsLeft(error) {
  const seconds = error?.retryAfterSeconds ?? 0
  const deadline = (error?.at ?? 0) + seconds * 1000
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (deadline <= Date.now()) return undefined
    const timer = setInterval(() => {
      const time = Date.now()
      setNow(time)
      if (time >= deadline) clearInterval(timer)
    }, 1000)
    return () => clearInterval(timer)
  }, [deadline])

  // `now` is only refreshed by the timer, so it can predate a new error: cap at the full wait.
  return Math.min(seconds, Math.max(0, Math.ceil((deadline - now) / 1000)))
}
