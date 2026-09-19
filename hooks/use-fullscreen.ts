"use client"

import { useCallback, useEffect, useState } from "react"

interface WebkitDocument extends Document {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void>
}
interface WebkitElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>
}

function currentFullscreenElement(): Element | null {
  const d = document as WebkitDocument
  return document.fullscreenElement ?? d.webkitFullscreenElement ?? null
}

// Toggles the browser Fullscreen API on the document root — chromeless,
// edge-to-edge output exactly like a video player's fullscreen.
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    if (window.flowcastDesktop) {
      let active = true
      void window.flowcastDesktop.getFullscreen().then((value) => { if (active) setIsFullscreen(value) })
      const unsubscribe = window.flowcastDesktop.onFullscreen(setIsFullscreen)
      return () => { active = false; unsubscribe() }
    }
    const sync = () => setIsFullscreen(!!currentFullscreenElement())
    document.addEventListener("fullscreenchange", sync)
    document.addEventListener("webkitfullscreenchange", sync)
    sync()
    return () => {
      document.removeEventListener("fullscreenchange", sync)
      document.removeEventListener("webkitfullscreenchange", sync)
    }
  }, [])

  const enter = useCallback(async () => {
    if (window.flowcastDesktop) {
      setIsFullscreen(await window.flowcastDesktop.setFullscreen(true))
      return
    }
    const el = document.documentElement as WebkitElement
    try {
      if (el.requestFullscreen) await el.requestFullscreen()
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen()
    } catch {
      // user gesture missing or unsupported — ignore
    }
  }, [])

  const exit = useCallback(async () => {
    if (window.flowcastDesktop) {
      setIsFullscreen(await window.flowcastDesktop.setFullscreen(false))
      return
    }
    const d = document as WebkitDocument
    try {
      if (document.exitFullscreen) await document.exitFullscreen()
      else if (d.webkitExitFullscreen) await d.webkitExitFullscreen()
    } catch {
      // ignore
    }
  }, [])

  const toggle = useCallback(() => {
    if (window.flowcastDesktop ? isFullscreen : currentFullscreenElement()) exit()
    else enter()
  }, [enter, exit, isFullscreen])

  return { isFullscreen, enter, exit, toggle }
}
