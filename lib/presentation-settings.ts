// Presentation style for projected slides. These settings live in durable
// persistence under the "presentation" key and are read both by the operator
// (preview/live panels) and, independently, by the projector window — exactly
// like the background settings. See `use-slideshow-projection`.

export type SlideAlignment = "left" | "center" | "right"
export type SlideTextCase = "default" | "uppercase"
export type ScriptureWeight = "light" | "regular" | "semibold" | "bold"
export type ReferenceWeight = "regular" | "semibold" | "bold"

export type ReferencePosition = "above" | "below"
export type VerticalPosition = "top" | "center" | "bottom"
export type TextShadow = "none" | "soft" | "strong"
export type SlideTransition = "none" | "fade"

export interface PresentationSettings {
  alignment: SlideAlignment
  // Empty string means the default editorial serif (Georgia/Times).
  fontFamily: string
  textCase: SlideTextCase
  scriptureWeight: ScriptureWeight
  referenceWeight: ReferenceWeight
  // Safe-area margins in px on the fixed 1920×1080 slide canvas. The vertical
  // margin sets the height the auto-fit targets; the horizontal margin sets the
  // line length. Useful for TV/projector overscan.
  marginX: number
  marginY: number
  // Multiplier applied to the fitted scripture/note sizes. The auto-fit keeps
  // text inside the safe area at scale 1; scaling up clamps to the fit so the
  // text never overflows the 1920×1080 canvas.
  fontScale: number
  // Multiplier for the scripture reference line, independent of `fontScale`.
  // Optional: when unset it falls back to `fontScale`, preserving the previous
  // shared-size behavior for settings persisted before this existed.
  referenceFontScale?: number
  // Where the scripture reference line sits relative to the verse text.
  referencePosition: ReferencePosition
  // Empty string inherits `fontFamily`. Lets the reference use its own face.
  referenceFontFamily: string
  // Custom color for the reference line (any CSS color string). Empty/unset
  // uses the automatic color derived from the background (light on imagery,
  // a muted tone of the text color otherwise).
  referenceColor?: string
  // Custom color for the scripture/lyric/note body. Empty keeps the automatic
  // color (white on imagery, contrast-picked on solid colors).
  textColor: string
  // Unitless line height for body text.
  lineHeight: number
  // A shadow behind the text, mostly for legibility over busy imagery.
  textShadow: TextShadow
  // Where the text block sits vertically inside the safe area.
  verticalPosition: VerticalPosition
  referenceItalic: boolean
  showReference: boolean
  // Appends the translation, e.g. "John 3:16 (KJV)".
  showVersion: boolean
  // Blur radius in px on the 1920×1080 canvas, applied to image and video
  // backgrounds only (a solid color has nothing to blur).
  backgroundBlur: number
  // Black overlay opacity (0–100) over image and video backgrounds.
  backgroundDim: number
  // How a new slide appears on the projector. Operator panels always cut.
  transition: SlideTransition
  transitionMs: number
}

// Bounds keep the text area from ever collapsing, whatever the user drags to.
export const MARGIN_X_BOUNDS = { min: 0, max: 480, step: 4 }
export const MARGIN_Y_BOUNDS = { min: 0, max: 360, step: 4 }
export const FONT_SCALE_BOUNDS = { min: 0.6, max: 1.6, step: 0.05 }
export const LINE_HEIGHT_BOUNDS = { min: 1.1, max: 2.2, step: 0.05 }
export const BACKGROUND_BLUR_BOUNDS = { min: 0, max: 40, step: 1 }
export const BACKGROUND_DIM_BOUNDS = { min: 0, max: 80, step: 5 }
export const TRANSITION_MS_BOUNDS = { min: 100, max: 1500, step: 50 }

// Defaults reproduce the look the slides had before these settings existed:
// centered, serif, normal case, regular body weight, bold reference. The
// asymmetric margins match the previous layout exactly — a 1600px content cap
// (160px horizontal insets) over 120px vertical padding.
export const DEFAULT_PRESENTATION: PresentationSettings = {
  alignment: "center",
  fontFamily: "",
  textCase: "default",
  scriptureWeight: "regular",
  referenceWeight: "bold",
  marginX: 160,
  marginY: 120,
  fontScale: 1,
  referencePosition: "below",
  referenceFontFamily: "",
  textColor: "",
  lineHeight: 1.625,
  textShadow: "none",
  verticalPosition: "center",
  referenceItalic: true,
  showReference: true,
  showVersion: true,
  backgroundBlur: 0,
  backgroundDim: 0,
  transition: "none",
  transitionMs: 400,
}

export function clampFontScale(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PRESENTATION.fontScale
  return Math.min(FONT_SCALE_BOUNDS.max, Math.max(FONT_SCALE_BOUNDS.min, value))
}

export function clampMargin(value: number, bounds: { min: number; max: number }): number {
  if (!Number.isFinite(value)) return bounds.min
  return Math.min(bounds.max, Math.max(bounds.min, value))
}

export const SCRIPTURE_WEIGHT_VALUE: Record<ScriptureWeight, number> = {
  light: 300,
  regular: 400,
  semibold: 600,
  bold: 700,
}

export const REFERENCE_WEIGHT_VALUE: Record<ReferenceWeight, number> = {
  regular: 400,
  semibold: 600,
  bold: 700,
}

export const VERTICAL_POSITION_CSS: Record<VerticalPosition, "flex-start" | "center" | "flex-end"> = {
  top: "flex-start",
  center: "center",
  bottom: "flex-end",
}

// Shadows are in canvas px, so they scale with the slide like everything else.
export const TEXT_SHADOW_CSS: Record<TextShadow, string | undefined> = {
  none: undefined,
  soft: "0 4px 24px rgba(0, 0, 0, 0.45)",
  strong: "0 3px 6px rgba(0, 0, 0, 0.85), 0 0 40px rgba(0, 0, 0, 0.6)",
}

export const ALIGNMENT_CSS: Record<
  SlideAlignment,
  { justifyContent: "flex-start" | "center" | "flex-end"; textAlign: "left" | "center" | "right" }
> = {
  left: { justifyContent: "flex-start", textAlign: "left" },
  center: { justifyContent: "center", textAlign: "center" },
  right: { justifyContent: "flex-end", textAlign: "right" },
}

// The serif fallback chain keeps text readable while a Google font streams in,
// and is what renders when offline (the family simply never loads).
export function fontFamilyCss(family: string | null | undefined): string | undefined {
  const trimmed = family?.trim()
  if (!trimmed) return undefined
  return `"${trimmed}", Georgia, "Times New Roman", serif`
}

export function mergePresentation(
  partial?: Partial<PresentationSettings> | null,
): PresentationSettings {
  const merged = { ...DEFAULT_PRESENTATION, ...(partial ?? {}) }
  // The reference size defaults to the scripture scale so older settings — and
  // anything that never set it — keep the previous shared-size behavior.
  if (merged.referenceFontScale == null) merged.referenceFontScale = merged.fontScale
  return merged
}
