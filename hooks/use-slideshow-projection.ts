"use client"

import { useEffect, useState } from "react"
import type { VerseData } from "@/components/operator/types"
import { resolveBackgroundMedia, resolveImageUrl, type BackgroundMediaKind } from "@/lib/image-store"
import { readLegacyString, readPersisted } from "@/lib/persistence"
import { mergePresentation, type PresentationSettings } from "@/lib/presentation-settings"

const DEFAULT_DATA: VerseData = {
  verses: [],
  fontSize: "extra-large",
  darkMode: true,
  version: "KJV",
  backgroundColor: "#000000",
}

type BackgroundSettings = {
  color: string
  imageId: string | null
  kind: BackgroundMediaKind | null
}

function updateFavicon(verseRef?: string) {
  const canvas = document.createElement("canvas")
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext("2d")
  if (ctx) {
    ctx.fillStyle = "#22c55e"
    ctx.fillRect(0, 0, 32, 32)
    ctx.fillStyle = "#ffffff"
    ctx.font = "bold 20px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("S", 16, 17)

    const link = document.querySelector("link[rel='icon']") as HTMLLinkElement
    if (link) {
      link.href = canvas.toDataURL()
    } else {
      const newLink = document.createElement("link")
      newLink.rel = "icon"
      newLink.href = canvas.toDataURL()
      document.head.appendChild(newLink)
    }
  }
  document.title = verseRef ? `${verseRef} - Slideshow` : "FlowCast — Slideshow"
}

function firstSlideTitle(data: VerseData) {
  const firstVerse = data.verses[0]
  if (!firstVerse) return undefined
  return (
    firstVerse.reference ||
    firstVerse.text?.substring(0, 30) + (firstVerse.text?.length > 30 ? "..." : "")
  )
}

function applyStoredOverrides(parsed: VerseData) {
  const background = readPersisted<BackgroundSettings>("background", {
    legacy: {
      keys: [
        "biblePresenterBackgroundColor",
        "biblePresenterBackgroundImage",
        "biblePresenterBackgroundKind",
      ],
      read: () => {
        const color = readLegacyString("biblePresenterBackgroundColor") ?? "#000000"
        const imageId = readLegacyString("biblePresenterBackgroundImage")
        const kind = readLegacyString("biblePresenterBackgroundKind")
        return {
          color,
          imageId,
          kind: kind === "image" || kind === "video" ? kind : null,
        }
      },
    },
  })
  const presentation = readPersisted<PresentationSettings>("presentation")
  return {
    ...parsed,
    backgroundColor: background?.color || parsed.backgroundColor,
    backgroundImage: background?.imageId || undefined,
    presentation: mergePresentation(presentation),
  }
}

export function useSlideshowProjection() {
  const [data, setData] = useState<VerseData>(DEFAULT_DATA)
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null)
  const [bgKind, setBgKind] = useState<BackgroundMediaKind>("image")
  const [mediaImageUrl, setMediaImageUrl] = useState<string | null>(null)

  useEffect(() => {
    updateFavicon()

    const applyRaw = (raw: string | null, onlyIfChanged = false) => {
      if (!raw) return
      try {
        const parsed = applyStoredOverrides(JSON.parse(raw) as VerseData)
        if (!onlyIfChanged) {
          setData(parsed)
          updateFavicon(firstSlideTitle(parsed))
          return
        }
        const currentWithBg = JSON.stringify(parsed)
        setData((prev) => {
          if (JSON.stringify(prev) === currentWithBg) return prev
          updateFavicon(firstSlideTitle(parsed))
          return parsed
        })
      } catch {
        if (!onlyIfChanged) console.error("Failed to parse stored data")
      }
    }

    applyRaw(localStorage.getItem("bibleVerseData"))

    const handleStorageChange = () => applyRaw(localStorage.getItem("bibleVerseData"))
    window.addEventListener("storage", handleStorageChange)
    const interval = setInterval(() => {
      applyRaw(localStorage.getItem("bibleVerseData"), true)
    }, 500)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    resolveBackgroundMedia(data.backgroundImage).then((media) => {
      if (cancelled) return
      setBgImageUrl(media?.url ?? null)
      setBgKind(media?.kind ?? "image")
    })
    return () => {
      cancelled = true
    }
  }, [data.backgroundImage])

  useEffect(() => {
    let cancelled = false
    resolveImageUrl(data.mediaId).then((url) => {
      if (!cancelled) setMediaImageUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [data.mediaId])

  return { data, bgImageUrl, bgKind, mediaImageUrl }
}
