"use client"

import { useCallback, useEffect, useState } from "react"
import {
  resolveBackgroundMedia,
  resolveImageUrl,
  storeImage,
  type BackgroundMediaKind,
} from "@/lib/image-store"
import {
  readLegacyString,
  readPersisted,
  removePersisted,
  writePersisted,
} from "@/lib/persistence"

const BG_COLOR_KEY = "biblePresenterBackgroundColor"
const BG_IMAGE_KEY = "biblePresenterBackgroundImage"
const BG_KIND_KEY = "biblePresenterBackgroundKind"

type BackgroundSettings = {
  color: string
  imageId: string | null
  kind: BackgroundMediaKind | null
}

export function useOperatorBackground() {
  const [themeLoaded, setThemeLoaded] = useState(false)
  const [backgroundColor, setBackgroundColor] = useState("#000000")
  const [backgroundImageId, setBackgroundImageId] = useState<string | null>(null)
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null)
  const [backgroundKind, setBackgroundKind] = useState<BackgroundMediaKind | null>(null)

  useEffect(() => {
    try {
      const settings = readPersisted<BackgroundSettings>("background", {
        legacy: {
          keys: [BG_COLOR_KEY, BG_IMAGE_KEY, BG_KIND_KEY],
          read: () => {
            const color = readLegacyString(BG_COLOR_KEY) ?? "#000000"
            const imageId = readLegacyString(BG_IMAGE_KEY)
            const kind = readLegacyString(BG_KIND_KEY)
            return {
              color,
              imageId,
              kind: kind === "image" || kind === "video" ? kind : null,
            }
          },
        },
      })
      if (settings?.color) setBackgroundColor(settings.color)
      const bgImg = settings?.imageId ?? null
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
    if (!themeLoaded) return
    try {
      writePersisted<BackgroundSettings>("background", {
        color: backgroundColor,
        imageId: backgroundImageId,
        kind: backgroundKind,
      })
    } catch (err) {
      console.error("FlowCast: failed to persist background", err)
    }
  }, [backgroundColor, backgroundImageId, backgroundKind, themeLoaded])

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
    removePersisted("background")
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
