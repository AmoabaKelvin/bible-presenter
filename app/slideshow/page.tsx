"use client"

import { useState, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import rehypeRaw from "rehype-raw"

type FontSize = "small" | "medium" | "large" | "extra-large"

interface SelectedVerse {
  id: string
  book: string
  chapter: number
  verse: number
  text: string
  reference: string
  version?: string
}

interface VerseData {
  verses: SelectedVerse[]
  fontSize: FontSize
  darkMode: boolean
  version?: string
  backgroundColor?: string
  backgroundImage?: string
}

const fontSizeClasses: Record<FontSize, string> = {
  small: "text-xl md:text-2xl",
  medium: "text-2xl md:text-3xl",
  large: "text-3xl md:text-4xl lg:text-5xl",
  "extra-large": "text-5xl md:text-6xl lg:text-7xl",
}

const referenceSizeClasses: Record<FontSize, string> = {
  small: "text-lg",
  medium: "text-xl",
  large: "text-2xl",
  "extra-large": "text-4xl",
}

export default function SlideshowPage() {
  const [data, setData] = useState<VerseData>({
    verses: [],
    fontSize: "extra-large", // default to extra-large
    darkMode: true,
    version: "KJV",
    backgroundColor: "#000000",
  })

  const getTextColorForBackground = (bgColor: string) => {
    const hex = bgColor.replace("#", "")
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5 ? "text-gray-900" : "text-white"
  }

  const getReferenceColorForBackground = (bgColor: string) => {
    const hex = bgColor.replace("#", "")
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5 ? "text-gray-600" : "text-gray-400"
  }

  useEffect(() => {
    const updateFavicon = (verseRef?: string) => {
      const canvas = document.createElement("canvas")
      canvas.width = 32
      canvas.height = 32
      const ctx = canvas.getContext("2d")
      if (ctx) {
        // Slideshow icon - green background with "S" for Slideshow
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

      // Update title with verse reference
      if (verseRef) {
        document.title = `${verseRef} - Slideshow`
      } else {
        document.title = "Bible Presenter - Slideshow"
      }
    }

    updateFavicon()

    // Load initial data
    const stored = localStorage.getItem("bibleVerseData")
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        // Also check for separately stored background settings
        const storedBgColor = localStorage.getItem("biblePresenterBackgroundColor")
        const storedBgImage = localStorage.getItem("biblePresenterBackgroundImage")
        if (storedBgColor) parsed.backgroundColor = storedBgColor
        if (storedBgImage) parsed.backgroundImage = storedBgImage
        setData(parsed)
        if (parsed.verses?.length > 0) {
          const firstVerse = parsed.verses[0]
          const title =
            firstVerse.reference || firstVerse.text?.substring(0, 30) + (firstVerse.text?.length > 30 ? "..." : "")
          updateFavicon(title)
        }
      } catch (e) {
        console.error("Failed to parse stored data")
      }
    }

    // Listen for updates
    const handleStorageChange = () => {
      const updated = localStorage.getItem("bibleVerseData")
      if (updated) {
        try {
          const parsed = JSON.parse(updated)
          // Also check for separately stored background settings
          const storedBgColor = localStorage.getItem("biblePresenterBackgroundColor")
          const storedBgImage = localStorage.getItem("biblePresenterBackgroundImage")
          if (storedBgColor) parsed.backgroundColor = storedBgColor
          if (storedBgImage) parsed.backgroundImage = storedBgImage
          else parsed.backgroundImage = undefined
          setData(parsed)
          if (parsed.verses?.length > 0) {
            const firstVerse = parsed.verses[0]
            const title =
              firstVerse.reference || firstVerse.text?.substring(0, 30) + (firstVerse.text?.length > 30 ? "..." : "")
            updateFavicon(title)
          }
        } catch (e) {
          console.error("Failed to parse updated data")
        }
      }
    }

    window.addEventListener("storage", handleStorageChange)

    // Poll for changes as a fallback
    const interval = setInterval(() => {
      const current = localStorage.getItem("bibleVerseData")
      const storedBgColor = localStorage.getItem("biblePresenterBackgroundColor")
      const storedBgImage = localStorage.getItem("biblePresenterBackgroundImage")

      if (current) {
        try {
          const parsed = JSON.parse(current)
          // Apply background settings
          if (storedBgColor) parsed.backgroundColor = storedBgColor
          if (storedBgImage) parsed.backgroundImage = storedBgImage
          else parsed.backgroundImage = undefined

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
        } catch (e) {
          // ignore
        }
      }
    }, 500)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      clearInterval(interval)
    }
  }, [])

  const backgroundColor = data.backgroundColor || (data.darkMode ? "#000000" : "#FFFFFF")
  const backgroundImage = data.backgroundImage
  const textColor = backgroundImage ? "text-white" : getTextColorForBackground(backgroundColor)
  const referenceColor = backgroundImage ? "text-gray-300" : getReferenceColorForBackground(backgroundColor)

  const isNote = (verse: SelectedVerse) => verse.id.startsWith("note-") || verse.id.startsWith("history-")

  return (
    <div
      className={`min-h-screen ${textColor} flex flex-col items-center justify-center p-8 md:p-12 lg:p-16`}
      style={{
        backgroundColor,
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {data.verses.length > 0 ? (
        <div className="max-w-5xl w-full text-center space-y-12">
          {data.verses.map((verse) => (
            <div key={verse.id} className="space-y-4">
              {isNote(verse) ? (
                <>
                  {verse.reference && verse.reference.trim() !== "" && (
                    <p className={`${fontSizeClasses[data.fontSize]} font-bold`}>
                      {verse.reference}
                    </p>
                  )}
                  <div
                    className={`leading-relaxed font-serif prose max-w-none prose-ol:list-inside prose-ul:list-inside prose-ol:pl-0 prose-ul:pl-0 ${textColor === "text-white" ? "prose-invert" : ""} ${
                      data.fontSize === "small"
                        ? "prose-lg"
                        : data.fontSize === "medium"
                          ? "prose-xl"
                          : "prose-2xl"
                    }`}
                  >
                    <ReactMarkdown rehypePlugins={[rehypeRaw]}>{verse.text}</ReactMarkdown>
                  </div>
                </>
              ) : (
                <>
                  <p
                    className={`${fontSizeClasses[data.fontSize]} leading-relaxed font-serif ${verse.reference ? "text-balance" : "whitespace-pre-wrap"}`}
                    dangerouslySetInnerHTML={{ __html: verse.text }}
                  />

                  {verse.reference && verse.reference.trim() !== "" && (
                    <p className={`mt-6 ${referenceSizeClasses[data.fontSize]} ${referenceColor} font-bold italic`}>
                      {verse.reference} ({verse.version || data.version || "KJV"})
                    </p>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
