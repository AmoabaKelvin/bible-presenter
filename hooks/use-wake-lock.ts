"use client"

import { useEffect } from "react"

// Holds a screen wake lock while `active`, so the projector display never
// sleeps mid-service. Locks auto-release when the tab is hidden, so we
// re-acquire on visibility/fullscreen changes. No-ops where unsupported.
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    if (!("wakeLock" in navigator)) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      if (document.visibilityState !== "visible") return
      if (sentinel && !sentinel.released) return
      try {
        sentinel = await navigator.wakeLock.request("screen")
        if (cancelled) {
          sentinel.release().catch(() => {})
          sentinel = null
        }
      } catch {
        // denied or unsupported — ignore
      }
    }

    acquire()
    const onVisibility = () => acquire()
    document.addEventListener("visibilitychange", onVisibility)
    document.addEventListener("fullscreenchange", onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onVisibility)
      document.removeEventListener("fullscreenchange", onVisibility)
      sentinel?.release().catch(() => {})
      sentinel = null
    }
  }, [active])
}
