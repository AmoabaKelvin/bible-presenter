// Per-type slide backgrounds. There is ONE default background; each content
// type (scripture / song / note / dictionary) may optionally override it. A
// slide resolves to `config[kind] ?? config.default`.
//
// This model lives in durable persistence under the "background" key and is
// read both by the operator and, independently, by the projector window (see
// `use-slideshow-projection`). Other units that serialize a "show" must round-
// trip the full `BackgroundConfig`.

import type { BackgroundMediaKind } from "@/lib/image-store"
import type { SlideKind } from "@/components/slide-stage"

export interface BackgroundLayer {
  color: string
  imageId: string | null
  kind: BackgroundMediaKind | null
}

// The four override slots map onto SlideKind: dictionary === "definition".
export type BackgroundTarget = "default" | "scripture" | "song" | "note" | "definition"

export interface BackgroundConfig {
  default: BackgroundLayer
  scripture?: BackgroundLayer | null
  song?: BackgroundLayer | null
  note?: BackgroundLayer | null
  definition?: BackgroundLayer | null
}

// The old persisted value was a single flat layer: `{ color, imageId, kind }`.
type LegacyBackground = {
  color?: string
  imageId?: string | null
  kind?: BackgroundMediaKind | null
}

export const DEFAULT_BACKGROUND_LAYER: BackgroundLayer = {
  color: "#000000",
  imageId: null,
  kind: null,
}

function normalizeLayer(value: unknown): BackgroundLayer | null {
  if (!value || typeof value !== "object") return null
  const layer = value as LegacyBackground
  const kind = layer.kind === "image" || layer.kind === "video" ? layer.kind : null
  return {
    color: typeof layer.color === "string" ? layer.color : "#000000",
    imageId: typeof layer.imageId === "string" ? layer.imageId : null,
    kind,
  }
}

// Accepts either the new config shape OR the legacy flat layer, and always
// returns a valid config with a populated `default`. Per-type slots stay
// undefined when absent so they cleanly inherit the default.
export function normalizeBackgroundConfig(value: unknown): BackgroundConfig {
  if (value && typeof value === "object" && "default" in (value as Record<string, unknown>)) {
    const cfg = value as Record<string, unknown>
    const config: BackgroundConfig = {
      default: normalizeLayer(cfg.default) ?? { ...DEFAULT_BACKGROUND_LAYER },
    }
    for (const key of ["scripture", "song", "note", "definition"] as const) {
      const layer = normalizeLayer(cfg[key])
      if (layer) config[key] = layer
    }
    return config
  }
  // Legacy flat layer (or empty) → wrap as the default, no per-type overrides.
  return { default: normalizeLayer(value) ?? { ...DEFAULT_BACKGROUND_LAYER } }
}

// The active layer for a slide of `kind`. Falls back to the default.
export function resolveLayer(
  config: BackgroundConfig,
  kind: SlideKind | undefined,
): BackgroundLayer {
  if (kind && config[kind]) return config[kind] as BackgroundLayer
  return config.default
}
