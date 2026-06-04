"use client"

import { useEffect } from "react"

// Streams a Google font into the current document by injecting a css2 <link>.
// Mounted in both the operator and the projector window so each loads the
// family it needs. Links are keyed by family and never removed — keeping a
// handful of cached stylesheets avoids re-fetch flicker when switching fonts.
export function useGoogleFont(family: string | undefined) {
  useEffect(() => {
    const trimmed = family?.trim()
    if (!trimmed) return
    if (typeof document === "undefined") return

    const id = `gfont-${trimmed.replace(/\s+/g, "-").toLowerCase()}`
    if (document.getElementById(id)) return

    const link = document.createElement("link")
    link.id = id
    link.rel = "stylesheet"
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
      trimmed,
    )}:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600;1,700&display=swap`
    document.head.appendChild(link)
  }, [family])
}
