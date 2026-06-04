"use client"

import { type ReactNode, type Ref } from "react"
import ReactMarkdown from "react-markdown"
import rehypeRaw from "rehype-raw"
import { useSlideScale } from "@/hooks/use-slide-scale"
import { useSlideTextFit } from "@/hooks/use-slide-text-fit"
import {
  ALIGNMENT_CSS,
  MARGIN_X_BOUNDS,
  MARGIN_Y_BOUNDS,
  REFERENCE_WEIGHT_VALUE,
  SCRIPTURE_WEIGHT_VALUE,
  clampMargin,
  fontFamilyCss,
  mergePresentation,
  type PresentationSettings,
} from "@/lib/presentation-settings"

export const SLIDE_WIDTH = 1920
export const SLIDE_HEIGHT = 1080

export type FontSize = "small" | "medium" | "large" | "extra-large"
export type SlideKind = "scripture" | "note" | "definition"

export interface SelectedVerse {
  kind: SlideKind
  id: string
  book: string
  chapter: number
  verse: number
  text: string
  reference: string
  version?: string
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
  const { wrapperRef, scale } = useSlideScale(SLIDE_WIDTH, SLIDE_HEIGHT)
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
  // The id prefix fallback keeps older persisted queue/history payloads
  // renderable after the explicit `kind` field was introduced.
  return verse.kind
    ? verse.kind !== "scripture"
    : verse.id.startsWith("note-") || verse.id.startsWith("history-")
}

interface SlideContentProps {
  verses: SelectedVerse[]
  fontSize: FontSize
  backgroundColor: string
  // Any background media (image OR video) keeps text white for readability.
  backgroundImage?: string | null
  defaultVersion?: string
  innerRef?: Ref<HTMLDivElement>
  presentation?: Partial<PresentationSettings> | null
}

export function SlideContent({
  verses,
  fontSize,
  backgroundColor,
  backgroundImage,
  defaultVersion = "KJV",
  innerRef,
  presentation,
}: SlideContentProps) {
  const textColor = backgroundImage ? "#ffffff" : getTextColorHex(backgroundColor)
  const referenceColor = backgroundImage
    ? "#d1d5db"
    : getReferenceColorHex(backgroundColor)
  const proseInvert = textColor === "#ffffff"

  const style = mergePresentation(presentation)
  const align = ALIGNMENT_CSS[style.alignment]
  const fontFamily = fontFamilyCss(style.fontFamily)
  const textTransform = style.textCase === "uppercase" ? "uppercase" : undefined
  const scriptureWeight = SCRIPTURE_WEIGHT_VALUE[style.scriptureWeight]
  const referenceWeight = REFERENCE_WEIGHT_VALUE[style.referenceWeight]

  // Margins define the safe area the auto-fit targets: vertical sets the height
  // the text fills, horizontal sets the line length.
  const marginX = clampMargin(style.marginX, MARGIN_X_BOUNDS)
  const marginY = clampMargin(style.marginY, MARGIN_Y_BOUNDS)
  const availableHeight = SLIDE_HEIGHT - marginY * 2
  const contentMaxWidth = SLIDE_WIDTH - marginX * 2

  const {
    measuring,
    setRefs,
    verseFs,
    refFs,
    noteTitleFs,
    refMt,
    noteTitleMb,
    gap,
  } = useSlideTextFit({
    verses,
    fontSize,
    availableHeight,
    availableWidth: contentMaxWidth,
    innerRef,
  })

  return (
    <div
      className="absolute inset-0 flex items-center"
      style={{
        padding: `${marginY}px ${marginX}px`,
        color: textColor,
        justifyContent: align.justifyContent,
        visibility: measuring ? "hidden" : "visible",
      }}
    >
      <div
        ref={setRefs}
        style={{
          width: "100%",
          maxWidth: contentMaxWidth,
          display: "flex",
          flexDirection: "column",
          alignItems:
            align.justifyContent === "center"
              ? "center"
              : align.justifyContent === "flex-end"
                ? "flex-end"
                : "flex-start",
          textAlign: align.textAlign,
          gap,
        }}
      >
        {verses.map((v) => (
          <div key={v.id} data-verse-id={v.id} style={{ width: "100%" }}>
            {isNote(v) ? (
              <>
                {v.reference && (
                  <p
                    style={{
                      fontSize: noteTitleFs,
                      fontWeight: 700,
                      fontFamily,
                      textTransform,
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
                  style={{
                    fontSize: verseFs,
                    fontFamily,
                    fontWeight: scriptureWeight,
                    textTransform,
                  }}
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
                  style={{
                    fontSize: verseFs,
                    fontFamily,
                    fontWeight: scriptureWeight,
                    textTransform,
                  }}
                  dangerouslySetInnerHTML={{ __html: v.text }}
                />
                {v.reference && (
                  <p
                    className="italic"
                    style={{
                      marginTop: refMt,
                      fontSize: refFs,
                      fontFamily,
                      fontWeight: referenceWeight,
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
