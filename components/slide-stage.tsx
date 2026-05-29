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

// The chosen level sets how much of the slide the text fills. The text is
// auto-fit to fill the available area, then scaled by the level's fraction.
// Because every level derives from the same fitted baseline, a larger level is
// always larger than a smaller one — regardless of how many verses are shown.
const FILL: Record<FontSize, number> = {
  small: 0.5,
  medium: 0.66,
  large: 0.82,
  "extra-large": 0.95,
}

// Verse px used to start the measuring pass; the fit converges from here.
const REF_FS = 100
// Secondary text sizes and spacing, as ratios of the verse text size.
const REFERENCE_RATIO = 0.46
const NOTE_TITLE_RATIO = 0.8
const REFERENCE_MARGIN_RATIO = 0.34
const NOTE_TITLE_MARGIN_RATIO = 0.3
const GAP_RATIO = 0.34

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
  // fillFs is the verse px that fills the available area (the fitted baseline
  // every level scales from); null while still being measured. candidate is the
  // current trial size during the measuring pass; iterRef caps the iteration.
  const [fillFs, setFillFs] = useState<number | null>(null)
  const [candidate, setCandidate] = useState(REF_FS)
  const iterRef = useRef(0)

  // Re-measure only when the content changes. The fill size is independent of
  // the chosen level, so switching levels just re-applies a fraction (below).
  useLayoutEffect(() => {
    setFillFs(null)
    setCandidate(REF_FS)
    iterRef.current = 0
  }, [verses])

  // Auto-fit by iterating: render at the trial size, measure the real (re-
  // wrapped) height, and scale toward filling the available height. Iterating
  // is required because height is non-linear in font size — a short verse grows
  // to fill while many verses shrink to fit. Text wraps within the fixed width,
  // so fitting height alone keeps it inside the slide.
  useLayoutEffect(() => {
    if (fillFs !== null) return
    const el = measureRef.current
    if (!el) return
    const h = el.scrollHeight
    if (!h) return
    const ratio = AVAILABLE_HEIGHT / h
    // Damp with sqrt: text height grows ~quadratically with font size (a bigger
    // font means both taller lines AND more wraps), so scaling by the raw ratio
    // overshoots and oscillates between a too-big and too-small size. The sqrt
    // step converges to the fill size in a couple of passes.
    const next = candidate * Math.sqrt(ratio)
    iterRef.current += 1
    // Settle on convergence, or on the iteration cap (content sitting on a wrap
    // boundary can oscillate) — biasing to the smaller value so it still fits.
    if (Math.abs(ratio - 1) < 0.02 || iterRef.current >= 8) {
      setFillFs(Math.min(candidate, next))
    } else {
      setCandidate(next)
    }
  }, [verses, fillFs, candidate])

  const setRefs = (node: HTMLDivElement | null) => {
    measureRef.current = node
    if (!innerRef) return
    if (typeof innerRef === "function") {
      innerRef(node)
    } else {
      ;(innerRef as { current: HTMLDivElement | null }).current = node
    }
  }

  // During the measuring pass render at the trial size; afterwards at the
  // fitted baseline scaled by the chosen level's fill fraction.
  const measuring = fillFs === null
  const verseFs = measuring ? candidate : fillFs * FILL[fontSize]
  const refFs = verseFs * REFERENCE_RATIO
  const noteTitleFs = verseFs * NOTE_TITLE_RATIO
  const refMt = verseFs * REFERENCE_MARGIN_RATIO
  const noteTitleMb = verseFs * NOTE_TITLE_MARGIN_RATIO
  const gap = verseFs * GAP_RATIO

  return (
    <div
      className="absolute inset-0 flex items-center justify-center text-center"
      style={{
        padding: PADDING,
        color: textColor,
        visibility: measuring ? "hidden" : "visible",
      }}
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
