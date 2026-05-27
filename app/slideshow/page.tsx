"use client"

import { useState, useEffect } from "react"
import {
  SlideStage,
  SlideContent,
  type FontSize,
  type SelectedVerse,
} from "@/components/slide-stage"

interface VerseData {
  verses: SelectedVerse[]
  fontSize: FontSize
  darkMode: boolean
  version?: string
  backgroundColor?: string
  backgroundImage?: string
  mediaUrl?: string
}

export default function SlideshowPage() {
  const [data, setData] = useState<VerseData>({
    verses: [],
    fontSize: "extra-large",
    darkMode: true,
    version: "KJV",
    backgroundColor: "#000000",
  })

  useEffect(() => {
    const updateFavicon = (verseRef?: string) => {
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

      if (verseRef) {
        document.title = `${verseRef} - Slideshow`
      } else {
        document.title = "flowwww — Slideshow"
      }
    }

    updateFavicon()

    const applyStored = (parsed: VerseData) => {
      const storedBgColor = localStorage.getItem("biblePresenterBackgroundColor")
      const storedBgImage = localStorage.getItem("biblePresenterBackgroundImage")
      if (storedBgColor) parsed.backgroundColor = storedBgColor
      if (storedBgImage) parsed.backgroundImage = storedBgImage
      else parsed.backgroundImage = undefined
      return parsed
    }

    const stored = localStorage.getItem("bibleVerseData")
    if (stored) {
      try {
        const parsed = applyStored(JSON.parse(stored))
        setData(parsed)
        if (parsed.verses?.length > 0) {
          const firstVerse = parsed.verses[0]
          const title =
            firstVerse.reference ||
            firstVerse.text?.substring(0, 30) + (firstVerse.text?.length > 30 ? "..." : "")
          updateFavicon(title)
        }
      } catch {
        console.error("Failed to parse stored data")
      }
    }

    const handleStorageChange = () => {
      const updated = localStorage.getItem("bibleVerseData")
      if (!updated) return
      try {
        const parsed = applyStored(JSON.parse(updated))
        setData(parsed)
        if (parsed.verses?.length > 0) {
          const firstVerse = parsed.verses[0]
          const title =
            firstVerse.reference ||
            firstVerse.text?.substring(0, 30) + (firstVerse.text?.length > 30 ? "..." : "")
          updateFavicon(title)
        }
      } catch {
        console.error("Failed to parse updated data")
      }
    }

    window.addEventListener("storage", handleStorageChange)

    const interval = setInterval(() => {
      const current = localStorage.getItem("bibleVerseData")
      if (!current) return
      try {
        const parsed = applyStored(JSON.parse(current))
        const currentWithBg = JSON.stringify(parsed)
        setData((prev) => {
          if (JSON.stringify(prev) !== currentWithBg) {
            if (parsed.verses?.length > 0) {
              const firstVerse = parsed.verses[0]
              const title =
                firstVerse.reference ||
                firstVerse.text?.substring(0, 30) + (firstVerse.text?.length > 30 ? "..." : "")
              updateFavicon(title)
            }
            return parsed
          }
          return prev
        })
      } catch {
        // ignore
      }
    }, 500)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      clearInterval(interval)
    }
  }, [])

  const backgroundColor = data.backgroundColor || (data.darkMode ? "#000000" : "#FFFFFF")
  const backgroundImage = data.backgroundImage
  const mediaUrl = data.mediaUrl

  return (
    <SlideStage
      backgroundColor={backgroundColor}
      backgroundImage={backgroundImage}
      mediaUrl={mediaUrl}
      className="w-screen h-screen"
    >
      {data.verses.length > 0 && (
        <SlideContent
          verses={data.verses}
          fontSize={data.fontSize}
          backgroundColor={backgroundColor}
          backgroundImage={backgroundImage}
          defaultVersion={data.version}
        />
      )}
    </SlideStage>
  )
}
