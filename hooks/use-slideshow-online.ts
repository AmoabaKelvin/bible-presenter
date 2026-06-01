"use client"

import { useEffect, useState } from "react"
import {
  SLIDESHOW_HEARTBEAT_KEY,
  SLIDESHOW_HEARTBEAT_STALE_MS,
} from "@/lib/music-protocol"

export function useSlideshowOnline() {
  const [slideshowOnline, setSlideshowOnline] = useState(false)

  useEffect(() => {
    const check = () => {
      const raw = localStorage.getItem(SLIDESHOW_HEARTBEAT_KEY)
      const ts = raw ? Number(raw) : 0
      setSlideshowOnline(Number.isFinite(ts) && Date.now() - ts < SLIDESHOW_HEARTBEAT_STALE_MS)
    }
    check()
    const interval = setInterval(check, 1000)
    return () => clearInterval(interval)
  }, [])

  return slideshowOnline
}
