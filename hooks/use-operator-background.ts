"use client"

import { useCallback, useEffect, useState } from "react"
import {
  resolveBackgroundMedia,
  resolveImageUrl,
  storeImage,
  type BackgroundMediaKind,
} from "@/lib/image-store"

const BG_COLOR_KEY = "biblePresenterBackgroundColor"
const BG_IMAGE_KEY = "biblePresenterBackgroundImage"
const BG_KIND_KEY = "biblePresenterBackgroundKind"

export function useOperatorBackground() {
  const [themeLoaded, setThemeLoaded] = useState(false)
  const [backgroundColor, setBackgroundColor] = useState("#000000")
  const [backgroundImageId, setBackgroundImageId] = useState<string | null>(null)
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null)
  const [backgroundKind, setBackgroundKind] = useState<BackgroundMediaKind | null>(null)

  useEffect(() => {
    try {
      const bg = localStorage.getItem(BG_COLOR_KEY)
      if (bg) setBackgroundColor(bg)
      const bgImg = localStorage.getItem(BG_IMAGE_KEY)
      if (bgImg) {
        setBackgroundImageId(bgImg)
        resolveBackgroundMedia(bgImg).then((media) => {
          if (!media) return
          setBackgroundImageUrl(media.url)
          setBackgroundKind(media.kind)
        })
      }
    } catch {
      // ignore corrupt local state
    }
    setThemeLoaded(true)
  }, [])

  useEffect(() => {
    if (themeLoaded) localStorage.setItem(BG_COLOR_KEY, backgroundColor)
  }, [backgroundColor, themeLoaded])

  useEffect(() => {
    if (!themeLoaded) return
    try {
      if (backgroundImageId) {
        localStorage.setItem(BG_IMAGE_KEY, backgroundImageId)
        localStorage.setItem(BG_KIND_KEY, backgroundKind ?? "image")
      } else {
        localStorage.removeItem(BG_IMAGE_KEY)
        localStorage.removeItem(BG_KIND_KEY)
      }
    } catch (err) {
      console.error("FlowCast: failed to persist background", err)
    }
  }, [backgroundImageId, backgroundKind, themeLoaded])

  const handleBackgroundUpload = useCallback(async (file: File) => {
    try {
      const id = await storeImage(file)
      const url = await resolveImageUrl(id)
      setBackgroundImageId(id)
      setBackgroundImageUrl(url)
      setBackgroundKind(file.type.startsWith("video/") ? "video" : "image")
    } catch (err) {
      console.error("FlowCast: failed to store background", err)
    }
  }, [])

  const clearBackgroundImage = useCallback(() => {
    setBackgroundImageId(null)
    setBackgroundImageUrl(null)
    setBackgroundKind(null)
  }, [])

  const resetBackground = useCallback(() => {
    setBackgroundColor("#000000")
    clearBackgroundImage()
  }, [clearBackgroundImage])

  return {
    backgroundColor,
    setBackgroundColor,
    backgroundImageUrl,
    backgroundKind,
    themeLoaded,
    handleBackgroundUpload,
    clearBackgroundImage,
    resetBackground,
  }
}
