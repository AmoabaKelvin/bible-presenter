"use client"

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from "react"
import ReactMarkdown from "react-markdown"
import rehypeRaw from "rehype-raw"

export const SLIDE_WIDTH = 1920
export const SLIDE_HEIGHT = 1080

export type FontSize = "small" | "medium" | "large" | "extra-large"

export interface SelectedVerse {
  id: string
  book: string
  chapter: number
  verse: number
  text: string
  reference: string
  version?: string
}

const VERSE_PX: Record<FontSize, number> = {
  small: 56,
  medium: 80,
  large: 104,
  "extra-large": 140,
}

const REFERENCE_PX: Record<FontSize, number> = {
  small: 32,
  medium: 40,
  large: 52,
  "extra-large": 64,
}

const NOTE_TITLE_PX: Record<FontSize, number> = {
  small: 48,
  medium: 64,
  large: 84,
  "extra-large": 112,
}

const REFERENCE_MARGIN_TOP_PX: Record<FontSize, number> = {
  small: 24,
  medium: 32,
  large: 40,
  "extra-large": 48,
}

function getTextColorHex(bgColor: string) {
  const hex = bgColor.replace("#", "")
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? "#111827" : "#ffffff"
}

function getReferenceColorHex(bgColor: string) {
  const hex = bgColor.replace("#", "")
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? "#4b5563" : "#9ca3af"
}

interface SlideStageProps {
  backgroundColor: string
  backgroundImage?: string | null
  backgroundKind?: "image" | "video"
  mediaUrl?: string | null
  className?: string
  children?: ReactNode
}

export function SlideStage({
  backgroundColor,
  backgroundImage,
  backgroundKind = "image",
  mediaUrl,
  className = "",
  children,
}: SlideStageProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const update = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (!w || !h) return
      setScale(Math.min(w / SLIDE_WIDTH, h / SLIDE_HEIGHT))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const isVideo = backgroundKind === "video" && !!backgroundImage

  return (
    <div
      ref={wrapperRef}
      className={`relative overflow-hidden ${className}`}
      style={{
        backgroundColor,
        backgroundImage: backgroundImage && !isVideo ? `url(${backgroundImage})` : undefined,
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
      }}
    >
      {isVideo && (
        <video
          src={backgroundImage ?? undefined}
          autoPlay
          loop
          muted
          playsInline
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            pointerEvents: "none",
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: SLIDE_WIDTH,
          height: SLIDE_HEIGHT,
          transform: `translate(-50%, -50%) scale(${scale || 1})`,
          transformOrigin: "center center",
          overflow: "hidden",
          visibility: scale === 0 ? "hidden" : "visible",
        }}
      >
        {mediaUrl && (
          <img
            src={mediaUrl}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              objectPosition: "center",
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
        )}
        {children}
      </div>
    </div>
  )
}

function isNote(verse: SelectedVerse) {
  return verse.id.startsWith("note-") || verse.id.startsWith("history-")
}

interface SlideContentProps {
  verses: SelectedVerse[]
  fontSize: FontSize
  backgroundColor: string
  // Any background media (image OR video) keeps text white for readability.
  backgroundImage?: string | null
  defaultVersion?: string
  innerRef?: Ref<HTMLDivElement>
}

const PADDING = 120
const CONTENT_MAX_WIDTH = 1600
const AVAILABLE_HEIGHT = SLIDE_HEIGHT - PADDING * 2
const AVAILABLE_WIDTH = CONTENT_MAX_WIDTH

export function SlideContent({
  verses,
  fontSize,
  backgroundColor,
  backgroundImage,
  defaultVersion = "KJV",
  innerRef,
}: SlideContentProps) {
  const textColor = backgroundImage ? "#ffffff" : getTextColorHex(backgroundColor)
  const referenceColor = backgroundImage
    ? "#d1d5db"
    : getReferenceColorHex(backgroundColor)
  const proseInvert = textColor === "#ffffff"

  const measureRef = useRef<HTMLDivElement | null>(null)
  const [fitScale, setFitScale] = useState(1)

  useLayoutEffect(() => {
    setFitScale(1)
  }, [verses, fontSize])

  useLayoutEffect(() => {
    const el = measureRef.current
    if (!el) return
    const h = el.scrollHeight
    const w = el.scrollWidth
    if (!h || !w) return
    const naturalH = h / fitScale
    const naturalW = w / fitScale
    const target = Math.min(1, AVAILABLE_HEIGHT / naturalH, AVAILABLE_WIDTH / naturalW)
    if (Math.abs(target - fitScale) > 0.005) {
      setFitScale(target)
    }
  })

  const setRefs = (node: HTMLDivElement | null) => {
    measureRef.current = node
    if (!innerRef) return
    if (typeof innerRef === "function") {
      innerRef(node)
    } else {
      ;(innerRef as { current: HTMLDivElement | null }).current = node
    }
  }

  const verseFs = VERSE_PX[fontSize] * fitScale
  const refFs = REFERENCE_PX[fontSize] * fitScale
  const noteTitleFs = NOTE_TITLE_PX[fontSize] * fitScale
  const refMt = REFERENCE_MARGIN_TOP_PX[fontSize] * fitScale
  const noteTitleMb = 32 * fitScale
  const gap = 48 * fitScale

  return (
    <div
      className="absolute inset-0 flex items-center justify-center text-center"
      style={{ padding: PADDING, color: textColor }}
    >
      <div
        ref={setRefs}
        style={{
          width: "100%",
          maxWidth: CONTENT_MAX_WIDTH,
          display: "flex",
          flexDirection: "column",
          gap,
        }}
      >
        {verses.map((v) => (
          <div key={v.id} data-verse-id={v.id}>
            {isNote(v) ? (
              <>
                {v.reference && (
                  <p
                    style={{
                      fontSize: noteTitleFs,
                      fontWeight: 700,
                      marginBottom: noteTitleMb,
                      lineHeight: 1.2,
                    }}
                  >
                    {v.reference}
                  </p>
                )}
                <div
                  data-verse-text
                  className={`leading-relaxed font-serif prose max-w-none prose-ol:list-inside prose-ul:list-inside prose-ol:pl-0 prose-ul:pl-0 ${proseInvert ? "prose-invert" : ""}`}
                  style={{ fontSize: verseFs }}
                >
                  <ReactMarkdown rehypePlugins={[rehypeRaw]}>{v.text}</ReactMarkdown>
                </div>
              </>
            ) : (
              <>
                <p
                  data-verse-text
                  className={`leading-relaxed font-serif ${
                    v.reference ? "text-balance" : "whitespace-pre-wrap"
                  }`}
                  style={{ fontSize: verseFs }}
                  dangerouslySetInnerHTML={{ __html: v.text }}
                />
                {v.reference && (
                  <p
                    className="font-bold italic"
                    style={{
                      marginTop: refMt,
                      fontSize: refFs,
                      color: referenceColor,
                      lineHeight: 1.3,
                    }}
                  >
                    {v.reference} ({v.version || defaultVersion})
                  </p>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
