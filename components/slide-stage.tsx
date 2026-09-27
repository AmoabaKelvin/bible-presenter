"use client"

import { type CSSProperties, type ReactNode, type Ref } from "react"
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
  TEXT_SHADOW_CSS,
  VERTICAL_POSITION_CSS,
  clampFontScale,
  clampMargin,
  fontFamilyCss,
  mergePresentation,
  type PresentationSettings,
} from "@/lib/presentation-settings"

export const SLIDE_WIDTH = 1920
export const SLIDE_HEIGHT = 1080

export type FontSize = "small" | "medium" | "large" | "extra-large"
export type SlideKind = "scripture" | "note" | "definition" | "song"

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

// Whether a custom text color is light, so Markdown notes can switch to the
// inverted prose palette. Non-hex colors are treated as light.
function isLightColor(color: string) {
  const hex = color.trim().replace("#", "")
  if (!/^[0-9a-f]{6}$/i.test(hex)) return true
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5
}

interface SlideStageProps {
  backgroundColor: string
  backgroundImage?: string | null
  backgroundKind?: "image" | "video"
  // Blur radius in canvas px and dim overlay opacity (0–100), both applied to
  // image/video backgrounds only.
  backgroundBlur?: number
  backgroundDim?: number
  mediaUrl?: string | null
  mediaKind?: "image" | "video"
  className?: string
  children?: ReactNode
}

export function SlideStage({
  backgroundColor,
  backgroundImage,
  backgroundKind = "image",
  backgroundBlur = 0,
  backgroundDim = 0,
  mediaUrl,
  mediaKind = "image",
  className = "",
  children,
}: SlideStageProps) {
  const { wrapperRef, scale } = useSlideScale(SLIDE_WIDTH, SLIDE_HEIGHT)
  const isVideo = backgroundKind === "video" && !!backgroundImage
  // The blur is authored on the 1920×1080 canvas; convert to screen px so the
  // small operator previews look like the projector.
  const blurPx = backgroundImage ? backgroundBlur * scale : 0
  const dim = backgroundImage ? backgroundDim / 100 : 0

  return (
    <div
      ref={wrapperRef}
      className={`relative overflow-hidden ${className}`}
      style={{ backgroundColor }}
    >
      {backgroundImage && (
        // Bleed the layer past the edges while blurred so the soft edge of the
        // blur never shows the background color through.
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: blurPx > 0 ? -blurPx * 2 : 0,
            filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
            pointerEvents: "none",
          }}
        >
          {isVideo ? (
            <video
              src={backgroundImage}
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
              }}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `url(${backgroundImage})`,
                backgroundSize: "cover",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
              }}
            />
          )}
        </div>
      )}
      {dim > 0 && (
        <div
          aria-hidden
          style={{ position: "absolute", inset: 0, backgroundColor: `rgba(0, 0, 0, ${dim})`, pointerEvents: "none" }}
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
        {mediaUrl &&
          (mediaKind === "video" ? (
            <video
              src={mediaUrl}
              autoPlay
              loop
              playsInline
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
          ) : (
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
          ))}
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

function isSong(verse: SelectedVerse) {
  return verse.kind === "song" || verse.id.startsWith("song-")
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
  const style = mergePresentation(presentation)
  const customTextColor = style.textColor.trim()
  const textColor =
    customTextColor || (backgroundImage ? "#ffffff" : getTextColorHex(backgroundColor))
  const proseInvert = customTextColor ? isLightColor(customTextColor) : textColor === "#ffffff"
  // Notes render through `prose`, which sets its own colors; point them all at
  // the custom color so the whole note follows it.
  const proseColorVars = customTextColor
    ? ({
        "--tw-prose-body": customTextColor,
        "--tw-prose-headings": customTextColor,
        "--tw-prose-bold": customTextColor,
        "--tw-prose-links": customTextColor,
        "--tw-prose-bullets": customTextColor,
        "--tw-prose-counters": customTextColor,
        "--tw-prose-quotes": customTextColor,
        "--tw-prose-invert-body": customTextColor,
        "--tw-prose-invert-headings": customTextColor,
        "--tw-prose-invert-bold": customTextColor,
        "--tw-prose-invert-links": customTextColor,
        "--tw-prose-invert-bullets": customTextColor,
        "--tw-prose-invert-counters": customTextColor,
        "--tw-prose-invert-quotes": customTextColor,
      } as CSSProperties)
    : undefined
  const { lineHeight, showReference } = style
  const textShadow = TEXT_SHADOW_CSS[style.textShadow]
  // A custom reference color overrides the automatic one; empty/unset keeps the
  // light-on-image / themed color derived from the background.
  const referenceColor = style.referenceColor?.trim()
    ? style.referenceColor
    : backgroundImage
      ? "#d1d5db"
      : getReferenceColorHex(backgroundColor)
  const align = ALIGNMENT_CSS[style.alignment]
  const fontFamily = fontFamilyCss(style.fontFamily)
  // The reference may use its own face; empty inherits the scripture font.
  const referenceFontFamily = fontFamilyCss(style.referenceFontFamily) ?? fontFamily
  const referenceAbove = style.referencePosition === "above"
  const textTransform = style.textCase === "uppercase" ? "uppercase" : undefined
  const scriptureWeight = SCRIPTURE_WEIGHT_VALUE[style.scriptureWeight]
  const referenceWeight = REFERENCE_WEIGHT_VALUE[style.referenceWeight]
  const fontScale = clampFontScale(style.fontScale)
  // The reference scales independently of the scripture body; unset falls back
  // to the scripture scale so existing slides look unchanged.
  const referenceFontScale = clampFontScale(style.referenceFontScale ?? style.fontScale)

  // Margins define the safe area the auto-fit targets: vertical sets the height
  // the text fills, horizontal sets the line length.
  const marginX = clampMargin(style.marginX, MARGIN_X_BOUNDS)
  const marginY = clampMargin(style.marginY, MARGIN_Y_BOUNDS)
  // Scaling up shrinks the area the fit targets — both height and the wrap
  // width — so multiplying the fitted sizes by the scale lands the text back
  // inside the safe area in both axes. Scaling down leaves the fit untouched.
  const upscale = Math.max(1, fontScale)
  const contentMaxWidth = SLIDE_WIDTH - marginX * 2
  const availableHeight = (SLIDE_HEIGHT - marginY * 2) / upscale
  // The fit measures (and the block renders) at this narrower width, so the
  // scaled-up lines wrap to exactly contentMaxWidth.
  const fitWidth = contentMaxWidth / upscale

  // Anything that changes the rendered height of the text without changing the
  // area must trigger a re-fit, or the slide keeps sizes fitted for the old look.
  const layoutKey = [
    style.fontFamily,
    style.referenceFontFamily,
    style.scriptureWeight,
    style.referenceWeight,
    style.textCase,
    lineHeight,
    showReference,
    style.showVersion,
    referenceFontScale,
  ].join("|")

  const {
    measuring,
    setRefs,
    verseFs: fitVerseFs,
    refFs: fitRefFs,
    noteTitleFs: fitNoteTitleFs,
    refMt: fitRefMt,
    noteTitleMb: fitNoteTitleMb,
    gap: fitGap,
  } = useSlideTextFit({
    verses,
    fontSize,
    availableHeight,
    availableWidth: fitWidth,
    layoutKey,
    innerRef,
  })

  // Scale the fitted sizes (and their proportional spacing) so a larger scale
  // keeps the same rhythm. The fit already targets a smaller area when scaled
  // up, so the multiplied result stays inside the safe area.
  const verseFs = fitVerseFs * fontScale
  const refFs = fitRefFs * referenceFontScale
  const noteTitleFs = fitNoteTitleFs * fontScale
  const refMt = fitRefMt * fontScale
  const noteTitleMb = fitNoteTitleMb * fontScale
  const gap = fitGap * fontScale

  return (
    <div
      className="absolute inset-0 flex"
      style={{
        padding: `${marginY}px ${marginX}px`,
        color: textColor,
        textShadow,
        alignItems: VERTICAL_POSITION_CSS[style.verticalPosition],
        justifyContent: align.justifyContent,
        visibility: measuring ? "hidden" : "visible",
      }}
    >
      <div
        ref={setRefs}
        style={{
          width: "100%",
          // Wrap at the (possibly narrower) fit width; multiplying the font
          // sizes by the scale expands the rendered block to contentMaxWidth.
          maxWidth: fitWidth,
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
            {isSong(v) ? (
              // Lyrics: plain lines, breaks preserved, no reference line.
              <p
                data-verse-text
                className="font-serif"
                style={{
                  whiteSpace: "pre-line",
                  lineHeight,
                  fontSize: verseFs,
                  fontFamily,
                  fontWeight: scriptureWeight,
                  textTransform,
                }}
              >
                {v.text}
              </p>
            ) : isNote(v) ? (
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
                  className={`font-serif prose max-w-none prose-ol:list-inside prose-ul:list-inside prose-ol:pl-0 prose-ul:pl-0 ${proseInvert ? "prose-invert" : ""}`}
                  style={{
                    ...proseColorVars,
                    lineHeight,
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
                {v.reference && showReference && referenceAbove && (
                  <p
                    style={{
                      fontStyle: style.referenceItalic ? "italic" : undefined,
                      marginBottom: refMt,
                      fontSize: refFs,
                      fontFamily: referenceFontFamily,
                      fontWeight: referenceWeight,
                      color: referenceColor,
                      lineHeight: 1.3,
                    }}
                  >
                    {style.showVersion
                      ? `${v.reference} (${v.version || defaultVersion})`
                      : v.reference}
                  </p>
                )}
                <p
                  data-verse-text
                  className={`font-serif ${
                    v.reference ? "text-balance" : "whitespace-pre-wrap"
                  }`}
                  style={{
                    lineHeight,
                    fontSize: verseFs,
                    fontFamily,
                    fontWeight: scriptureWeight,
                    textTransform,
                  }}
                  dangerouslySetInnerHTML={{ __html: v.text }}
                />
                {v.reference && showReference && !referenceAbove && (
                  <p
                    style={{
                      fontStyle: style.referenceItalic ? "italic" : undefined,
                      marginTop: refMt,
                      fontSize: refFs,
                      fontFamily: referenceFontFamily,
                      fontWeight: referenceWeight,
                      color: referenceColor,
                      lineHeight: 1.3,
                    }}
                  >
                    {style.showVersion
                      ? `${v.reference} (${v.version || defaultVersion})`
                      : v.reference}
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
