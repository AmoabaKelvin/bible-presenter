"use client"

import { useEffect } from "react"
import { loadSemanticEngine } from "@/lib/semantic-search"

// Warm the semantic search engine (embedding model + vector index) in the
// background as soon as the console loads, so the first "find by meaning"
// search is instant instead of waiting on a ~30 MB model download. The loader
// is memoized, so the eventual search just reuses what was warmed here.
//
// Kicked off during idle time so it never competes with the initial render.
export function useWarmSemanticIndex() {
  useEffect(() => {
    let cancelled = false
    const warm = () => {
      if (!cancelled) void loadSemanticEngine()
    }

    const ric = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
        cancelIdleCallback?: (handle: number) => void
      }
    ).requestIdleCallback

    if (ric) {
      const handle = ric(warm, { timeout: 3000 })
      return () => {
        cancelled = true
        ;(window as Window & { cancelIdleCallback?: (h: number) => void })
          .cancelIdleCallback?.(handle)
      }
    }

    const handle = window.setTimeout(warm, 1200)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [])
}
