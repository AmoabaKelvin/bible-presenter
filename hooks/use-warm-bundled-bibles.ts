"use client"

import { useEffect } from "react"
import { BUNDLED_VERSIONS, ensureBundleHydrated } from "@/lib/offline-download"

// Warm every shipped translation bundle (KJV, BSB, CEV, TLB) into IndexedDB in
// the background as soon as the console loads, so switching to any of them — and
// the first chapter you open — is instant instead of paying a ~1-3s hydrate +
// search-index build on first use. `ensureBundleHydrated` is idempotent and
// shared with the reader's lazy path, so this never double-hydrates. The active
// version is warmed first; the rest follow one at a time so the index builds
// don't pile up and jank the UI. Kicked off during idle so it never competes
// with the initial render.
export function useWarmBundledBibles(activeVersion: string) {
  useEffect(() => {
    let cancelled = false

    // Active version first so the visible reader is ready immediately, then the
    // remaining bundled translations in registry order.
    const order = [
      activeVersion,
      ...Object.keys(BUNDLED_VERSIONS).filter((v) => v !== activeVersion),
    ].filter((v) => v in BUNDLED_VERSIONS)

    const warm = async () => {
      for (const version of order) {
        if (cancelled) return
        try {
          await ensureBundleHydrated(version)
        } catch {
          // best-effort; the reader's lazy path retries this version on demand
        }
      }
    }

    const ric = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
        cancelIdleCallback?: (handle: number) => void
      }
    ).requestIdleCallback

    if (ric) {
      const handle = ric(() => void warm(), { timeout: 3000 })
      return () => {
        cancelled = true
        ;(window as Window & { cancelIdleCallback?: (h: number) => void })
          .cancelIdleCallback?.(handle)
      }
    }

    const handle = window.setTimeout(() => void warm(), 1500)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [activeVersion])
}
