// Presentation style for projected slides. These settings live in durable
// persistence under the "presentation" key and are read both by the operator
// (preview/live panels) and, independently, by the projector window — exactly
// like the background settings. See `use-slideshow-projection`.

export type SlideAlignment = "left" | "center" | "right"
export type SlideTextCase = "default" | "uppercase"
export type ScriptureWeight = "light" | "regular" | "semibold" | "bold"
export type ReferenceWeight = "regular" | "semibold" | "bold"

export type ReferencePosition = "above" | "below"

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
}

// Bounds keep the text area from ever collapsing, whatever the user drags to.
export const MARGIN_X_BOUNDS = { min: 0, max: 480, step: 4 }
export const MARGIN_Y_BOUNDS = { min: 0, max: 360, step: 4 }
export const FONT_SCALE_BOUNDS = { min: 0.6, max: 1.6, step: 0.05 }

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
