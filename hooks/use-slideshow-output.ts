"use client"

import { useCallback } from "react"
import type { FontSize, SelectedVerse } from "@/components/slide-stage"
import type { VerseData } from "@/components/operator/types"

type MediaSlide = { id: string; url: string; kind: "image" | "video" } | null

export type OutputPayload = {
  verses?: SelectedVerse[]
  mediaId?: string | null
}

type UseSlideshowOutputOptions = {
  fontSize: FontSize
  version: string
  liveVerses: SelectedVerse[]
  liveMedia: MediaSlide
}

export function useSlideshowOutput({
  fontSize,
  version,
  liveVerses,
  liveMedia,
}: UseSlideshowOutputOptions) {
  const writeToOutput = useCallback(
    ({ verses = [], mediaId = null }: OutputPayload) => {
      const data: VerseData = {
        verses,
        fontSize,
        darkMode: true,
        version,
        mediaId: mediaId ?? undefined,
      }
      try {
        localStorage.setItem("bibleVerseData", JSON.stringify(data))
      } catch (err) {
        console.error("FlowCast: failed to write slide data", err)
      }
      window.dispatchEvent(new Event("storage"))
    },
    [fontSize, version],
  )

  const openOutputWindow = useCallback(() => {
    const w = window.open(
      "/slideshow",
      "BibleSlideshow",
      "width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no",
    )
    if (w) {
      setTimeout(
        () => writeToOutput({ verses: liveVerses, mediaId: liveMedia?.id ?? null }),
        500,
      )
    }
  }, [liveMedia, liveVerses, writeToOutput])

  return { writeToOutput, openOutputWindow }
}
